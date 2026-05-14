import axios, { AxiosInstance } from 'axios'
import { JiraActivity, JiraActivityType } from '../types/report.types'
import { step } from '../logger'

const JQL_PROJECT_GROUP_SIZE = 10
const JQL_CONCURRENT = 3
const JQL_MAX_RESULTS = 100

const CHANGELOG_BATCH_SIZE = 1000
const CHANGELOG_BATCH_CONCURRENT = 3
const CHANGELOG_MAX_RESULTS_PER_PAGE = 1000

const COMMENT_COMPLETION_CONCURRENT = 5
const WORKLOG_COMPLETION_CONCURRENT = 5

let _sampledJQL = false
let _sampledBulkfetch = false
let _sampledPerIssueChangelog = false
let _sampledComment = false
let _sampledWorklog = false

interface JiraCredentials {
  baseUrl: string
  email: string
  apiToken: string
  accountId: string
}

interface ChangelogItem {
  field: string
  fieldtype: string
  fieldId?: string
  from: string | null
  fromString: string | null
  to: string | null
  toString: string | null
}

interface ChangelogHistory {
  id: string
  author?: { accountId: string; displayName: string }
  created: string
  items: ChangelogItem[]
}

interface IssueComment {
  id: string
  author?: { accountId: string; displayName: string }
  body: { content?: Array<{ content?: Array<{ text?: string }> }> }
  created: string
  updated: string
}

interface IssueWorklog {
  author?: { accountId: string; displayName: string }
  started: string
  timeSpent: string
  timeSpentSeconds: number
}

interface JiraIssue {
  id: string
  key: string
  fields: {
    summary: string
    created: string
    reporter?: { accountId: string; displayName: string }
    assignee?: { accountId: string; displayName: string }
    comment?: {
      total: number
      maxResults: number
      comments: IssueComment[]
    }
    worklog?: {
      total: number
      maxResults: number
      worklogs: IssueWorklog[]
    }
  }
}

/**
 * Runs an array of async tasks with a maximum concurrency limit.
 */
async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let index = 0

  async function worker() {
    while (index < tasks.length) {
      const i = index++
      results[i] = await tasks[i]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
}

function createClient(credentials: JiraCredentials): AxiosInstance {
  return axios.create({
    baseURL: `${credentials.baseUrl}/rest/api/3`,
    auth: { username: credentials.email, password: credentials.apiToken },
    headers: { Accept: 'application/json' },
    timeout: 60_000,
  })
}

function isoDate(iso: unknown): string {
  if (!iso) return ''
  const str = typeof iso === 'string' ? iso : String(iso)
  return str.slice(0, 10)
}

function extractTextFromAdf(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const doc = body as { content?: Array<{ content?: Array<{ text?: string }> }> }
  const texts: string[] = []
  for (const block of doc.content ?? []) {
    for (const inline of block.content ?? []) {
      if (inline.text) texts.push(inline.text)
    }
  }
  return texts.join(' ')
}

function mapChangelogItemToType(item: ChangelogItem): JiraActivityType | string {
  const field = item.field?.toLowerCase() ?? ''
  const fieldId = item.fieldId?.toLowerCase() ?? ''

  if (field === 'status') {
    const to = (item.toString ?? '').toLowerCase()
    const from = (item.fromString ?? '').toLowerCase()
    if (to === 'done' || to === 'closed' || to === 'resolved') return 'ISSUE_RESOLVED'
    if ((to === 'to do' || to === 'open' || to === 'backlog') && from !== '') return 'ISSUE_REOPENED'
    return 'STATUS_CHANGED'
  }
  if (field === 'assignee') return 'ASSIGNEE_CHANGED'
  if (field === 'priority') return 'PRIORITY_CHANGED'
  if (field === 'sprint') {
    if (!item.from && item.to) return 'SPRINT_ADDED'
    if (item.from && !item.to) return 'SPRINT_REMOVED'
    return 'SPRINT_CHANGED'
  }
  if (field === 'epic link' || field === 'parent' || fieldId === 'parent') return 'EPIC_CHANGED'
  if (field === 'story points' || fieldId === 'story_points' || fieldId === 'customfield_10016' || field === 'story point estimate') return 'STORY_POINTS_CHANGED'
  if (field === 'duedate' || field === 'due date') return 'DUE_DATE_CHANGED'
  if (field === 'description') return 'DESCRIPTION_CHANGED'
  if (field === 'summary') return 'SUMMARY_CHANGED'
  if (field === 'labels') return 'LABELS_CHANGED'
  if (field === 'component' || field === 'components') return 'COMPONENTS_CHANGED'
  if (field === 'fix version' || field === 'fixversions') return 'FIX_VERSION_CHANGED'
  if (field === 'flagged' || fieldId === 'flagged') return 'FLAGGED_CHANGED'
  if (field === 'issuelinks' || field === 'link') return 'ISSUE_LINK_CHANGED'
  if (field === 'attachment') return item.to ? 'ATTACHMENT_ADDED' : 'ATTACHMENT_REMOVED'
  if (field === 'watchers' || field === 'watcher') return 'WATCHER_CHANGED'
  if (field === 'resolution') return 'RESOLUTION_CHANGED'

  return 'FIELD_CHANGED'
}

function normalizeChangelogItem(
  item: ChangelogItem,
  history: ChangelogHistory,
  issue: JiraIssue
): JiraActivity {
  const type = mapChangelogItemToType(item)
  const metadata: Record<string, unknown> = {}

  if (item.fromString !== null) metadata.from = item.fromString
  if (item.toString !== null) metadata.to = item.toString
  if (item.fromString !== null && item.toString === null) metadata.to = null
  if (type === 'FIELD_CHANGED') metadata.field = item.field

  if (type === 'FLAGGED_CHANGED') {
    metadata.blocked = !!(item.toString?.toLowerCase().includes('impediment') || item.toString?.toLowerCase().includes('flagged'))
  }

  return {
    type,
    issueKey: issue.key,
    issueSummary: issue.fields.summary,
    author: history.author?.displayName ?? 'unknown',
    createdAt: history.created,
    metadata,
  }
}

/**
 * Fetches all issues for a single group of projects, handling pagination via nextPageToken.
 */
async function fetchIssuesForGroup(
  client: AxiosInstance,
  projectIds: string[],
  startDate: string,
  endDate: string,
  groupLabel: string
): Promise<JiraIssue[]> {
  const jql = `project IN (${projectIds.join(',')}) AND updated >= "${startDate}" AND updated <= "${endDate}" ORDER BY updated ASC`
  const fields = ['summary', 'comment', 'worklog', 'created', 'reporter', 'assignee']
  let nextPageToken: string | undefined
  const issues: JiraIssue[] = []

  while (true) {
    const body: Record<string, unknown> = { jql, fields, maxResults: JQL_MAX_RESULTS }
    if (nextPageToken) body.nextPageToken = nextPageToken

    const response = await client.post('/search/jql', body)
    const data = response.data as { issues: JiraIssue[]; isLast: boolean; nextPageToken?: string }

    if (!_sampledJQL) {
      _sampledJQL = true
      const sample = { ...data, issues: data.issues?.slice(0, 1) }
      step(`🔬 [SAMPLE] POST /search/jql → ${JSON.stringify(sample).slice(0, 800)}`)
    }

    issues.push(...data.issues)

    if (data.isLast || !data.nextPageToken) break
    nextPageToken = data.nextPageToken
  }

  if (issues.length > 0) {
    step(`🔵 Jira — grupo [${groupLabel}]: ${issues.length} issue(s)`)
  }

  return issues
}

/**
 * Splits projects into groups and fetches all issues concurrently.
 */
async function fetchAllIssues(
  client: AxiosInstance,
  projectIds: string[],
  startDate: string,
  endDate: string
): Promise<JiraIssue[]> {
  const groups: string[][] = []
  for (let i = 0; i < projectIds.length; i += JQL_PROJECT_GROUP_SIZE) {
    groups.push(projectIds.slice(i, i + JQL_PROJECT_GROUP_SIZE))
  }

  step(`🔵 Jira — buscando issues em ${groups.length} grupo(s) de projetos (concorrência: ${Math.min(JQL_CONCURRENT, groups.length)})...`)

  const tasks = groups.map((group, idx) => () =>
    fetchIssuesForGroup(client, group, startDate, endDate, `${idx + 1}/${groups.length}`)
  )

  const results = await runWithConcurrency(tasks, JQL_CONCURRENT)
  const allIssues = results.flat()

  step(`🔵 Jira — ${allIssues.length} issue(s) carregada(s) no total`)
  return allIssues
}

/**
 * Returns the complete comment list for an issue.
 * When the inline response is truncated (total > returned length),
 * fetches the remaining pages via GET /issue/{key}/comment.
 */
async function fetchCompleteComments(client: AxiosInstance, issue: JiraIssue): Promise<IssueComment[]> {
  const inline = issue.fields.comment
  if (!inline) return []
  if (inline.total <= inline.comments.length) return inline.comments

  const all: IssueComment[] = [...inline.comments]
  let startAt = inline.comments.length

  while (startAt < inline.total) {
    const res = await client.get(`/issue/${issue.key}/comment`, {
      params: { startAt, maxResults: 100, orderBy: 'created' },
    })
    const page = res.data as { comments: IssueComment[]; total: number }

    if (!_sampledComment) {
      _sampledComment = true
      const sample = { issueKey: issue.key, total: page.total, commentsCount: page.comments?.length, firstComment: page.comments?.[0] }
      step(`🔬 [SAMPLE] GET /issue/${issue.key}/comment → ${JSON.stringify(sample).slice(0, 800)}`)
    }

    all.push(...page.comments)
    startAt += page.comments.length
    if (startAt >= page.total) break
  }

  return all
}

/**
 * Returns the complete worklog list for an issue.
 * When the inline response is truncated (total > returned length),
 * fetches the remaining pages via GET /issue/{key}/worklog.
 */
async function fetchCompleteWorklogs(client: AxiosInstance, issue: JiraIssue): Promise<IssueWorklog[]> {
  const inline = issue.fields.worklog
  if (!inline) return []
  if (inline.total <= inline.worklogs.length) return inline.worklogs

  const all: IssueWorklog[] = [...inline.worklogs]
  let startAt = inline.worklogs.length

  while (startAt < inline.total) {
    const res = await client.get(`/issue/${issue.key}/worklog`, {
      params: { startAt, maxResults: 100 },
    })
    const page = res.data as { worklogs: IssueWorklog[]; total: number }

    if (!_sampledWorklog) {
      _sampledWorklog = true
      const sample = { issueKey: issue.key, total: page.total, worklogsCount: page.worklogs?.length, firstWorklog: page.worklogs?.[0] }
      step(`🔬 [SAMPLE] GET /issue/${issue.key}/worklog → ${JSON.stringify(sample).slice(0, 800)}`)
    }

    all.push(...page.worklogs)
    startAt += page.worklogs.length
    if (startAt >= page.total) break
  }

  return all
}

/**
 * Fetches all changelogs for a single batch of issue IDs via bulkfetch, handling pagination.
 * issueId is always normalised to String to guard against numeric IDs in the API response.
 */
async function fetchChangelogBatch(
  client: AxiosInstance,
  issueIds: string[],
  batchLabel: string
): Promise<Map<string, ChangelogHistory[]>> {
  const result = new Map<string, ChangelogHistory[]>()
  let nextPageToken: string | undefined
  let pages = 0

  do {
    const body: Record<string, unknown> = {
      issueIdsOrKeys: issueIds,
      maxResults: CHANGELOG_MAX_RESULTS_PER_PAGE,
    }
    if (nextPageToken) body.nextPageToken = nextPageToken

    const response = await client.post('/changelog/bulkfetch', body)
    const data = response.data as {
      issueChangeLogs: Array<{ issueId: string | number; changeHistories: ChangelogHistory[] }>
      nextPageToken?: string
    }

    if (!_sampledBulkfetch) {
      _sampledBulkfetch = true
      const firstEntry = data.issueChangeLogs?.[0]
      const sample = {
        nextPageToken: data.nextPageToken,
        issueChangeLogsCount: data.issueChangeLogs?.length,
        firstEntry: firstEntry
          ? { issueId: firstEntry.issueId, changeHistoriesCount: firstEntry.changeHistories?.length, firstHistory: firstEntry.changeHistories?.[0] }
          : null,
      }
      step(`🔬 [SAMPLE] POST /changelog/bulkfetch → ${JSON.stringify(sample).slice(0, 800)}`)
    }

    for (const entry of data.issueChangeLogs ?? []) {
      const id = String(entry.issueId)
      const existing = result.get(id) ?? []
      result.set(id, existing.concat(entry.changeHistories ?? []))
    }

    pages++
    nextPageToken = data.nextPageToken
  } while (nextPageToken)

  step(`🔵 Jira — lote changelog [${batchLabel}]: ${issueIds.length} issues, ${pages} página(s), ${result.size} com histórico`)
  return result
}

/**
 * Fetches complete changelogs for a list of issues individually via GET /issue/{key}/changelog.
 * More reliable than bulkfetch; used as authoritative source for the small "touched" set.
 */
async function fetchChangelogForIssues(
  client: AxiosInstance,
  issues: JiraIssue[],
  concurrency: number
): Promise<Map<string, ChangelogHistory[]>> {
  const result = new Map<string, ChangelogHistory[]>()

  const tasks = issues.map((issue) => async () => {
    const histories: ChangelogHistory[] = []
    let startAt = 0

    while (true) {
      const response = await client.get(`/issue/${issue.key}/changelog`, {
        params: { startAt, maxResults: 100 },
      })
      const data = response.data as { values: ChangelogHistory[]; isLast: boolean; total: number }

      if (!_sampledPerIssueChangelog) {
        _sampledPerIssueChangelog = true
        const sample = { issueKey: issue.key, total: data.total, isLast: data.isLast, valuesCount: data.values?.length, firstEntry: data.values?.[0] }
        step(`🔬 [SAMPLE] GET /issue/${issue.key}/changelog → ${JSON.stringify(sample).slice(0, 800)}`)
      }

      histories.push(...(data.values ?? []))
      if (data.isLast || histories.length >= data.total) break
      startAt += 100
    }

    result.set(issue.id, histories)
  })

  await runWithConcurrency(tasks, concurrency)
  return result
}

/**
 * Fetches all changelogs using bulkfetch in parallel batches.
 * Falls back to per-issue changelog if bulkfetch is unavailable.
 */
async function fetchChangelogs(
  client: AxiosInstance,
  issues: JiraIssue[]
): Promise<Map<string, ChangelogHistory[]>> {
  const issueIds = issues.map((i) => i.id)

  const batches: string[][] = []
  for (let i = 0; i < issueIds.length; i += CHANGELOG_BATCH_SIZE) {
    batches.push(issueIds.slice(i, i + CHANGELOG_BATCH_SIZE))
  }

  step(`🔵 Jira — extraindo changelogs: ${batches.length} lote(s) de até ${CHANGELOG_BATCH_SIZE} issues (concorrência: ${Math.min(CHANGELOG_BATCH_CONCURRENT, batches.length)})...`)

  try {
    const tasks = batches.map((batch, idx) => () =>
      fetchChangelogBatch(client, batch, `${idx + 1}/${batches.length}`)
    )

    const batchResults = await runWithConcurrency(tasks, CHANGELOG_BATCH_CONCURRENT)

    const merged = new Map<string, ChangelogHistory[]>()
    for (const batchMap of batchResults) {
      for (const [issueId, histories] of batchMap.entries()) {
        const existing = merged.get(issueId) ?? []
        merged.set(issueId, existing.concat(histories))
      }
    }

    step(`🔵 Jira — changelogs extraídos (${merged.size} issues com histórico)`)
    return merged
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status && status >= 400 && status < 500) {
      step(`🔵 Jira — bulkfetch indisponível (HTTP ${status}), usando changelog por issue...`)
      return await fetchChangelogPerIssue(client, issues)
    }
    throw err
  }
}

/**
 * Fallback: fetches changelogs one issue at a time.
 */
async function fetchChangelogPerIssue(
  client: AxiosInstance,
  issues: JiraIssue[]
): Promise<Map<string, ChangelogHistory[]>> {
  const result = new Map<string, ChangelogHistory[]>()
  const total = issues.length
  let done = 0

  for (const issue of issues) {
    const histories: ChangelogHistory[] = []
    let startAt = 0
    const maxResults = 100

    while (true) {
      const response = await client.get(`/issue/${issue.key}/changelog`, {
        params: { startAt, maxResults },
      })

      const data = response.data as {
        values: ChangelogHistory[]
        isLast: boolean
        total: number
      }

      histories.push(...data.values)

      if (data.isLast || histories.length >= data.total) break
      startAt += maxResults
    }

    if (histories.length > 0) {
      result.set(issue.id, histories)
    }

    done++
    if (done % 10 === 0 || done === total) {
      step(`🔵 Jira — changelogs: ${done}/${total} issues processadas`)
    }
  }

  return result
}

/**
 * Extracts all Jira activities within the date range for the given user (accountId),
 * scoped to the selected project IDs. Returns activities grouped by day (YYYY-MM-DD).
 *
 * Only actions directly performed by the user (matching accountId) are included.
 * Changelogs are fetched via bulkfetch for all issues, with per-issue fetches overriding
 * bulkfetch data for "touched" issues (reporter / assignee / inline comment author) to ensure
 * reliable coverage of the issues the user actively worked on.
 */
export async function extractJiraActivities(
  credentials: JiraCredentials,
  projectIds: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, JiraActivity[]>> {
  _sampledJQL = false
  _sampledBulkfetch = false
  _sampledPerIssueChangelog = false
  _sampledComment = false
  _sampledWorklog = false

  const client = createClient(credentials)
  const byDay = new Map<string, JiraActivity[]>()

  const addActivity = (activity: JiraActivity) => {
    const day = isoDate(activity.createdAt)
    if (!day || day < startDate || day > endDate) return
    const list = byDay.get(day) ?? []
    list.push(activity)
    byDay.set(day, list)
  }

  const issues = await fetchAllIssues(client, projectIds, startDate, endDate)
  if (issues.length === 0) return byDay

  const issueMap = new Map(issues.map((i) => [i.id, i]))

  // ISSUE_CREATED: issues created by the user in the period
  for (const issue of issues) {
    const createdDay = isoDate(issue.fields.created)
    if (
      createdDay >= startDate &&
      createdDay <= endDate &&
      issue.fields.reporter?.accountId === credentials.accountId
    ) {
      addActivity({
        type: 'ISSUE_CREATED',
        issueKey: issue.key,
        issueSummary: issue.fields.summary,
        author: issue.fields.reporter.displayName,
        createdAt: issue.fields.created,
        metadata: {},
      })
    }
  }

  // Pass 1 — build initial touched set from inline data (reporter / assignee / inline comments)
  const touchedIssueIds = new Set(
    issues
      .filter(
        (i) =>
          i.fields.reporter?.accountId === credentials.accountId ||
          i.fields.assignee?.accountId === credentials.accountId ||
          i.fields.comment?.comments.some((c) => c.author?.accountId === credentials.accountId)
      )
      .map((i) => i.id)
  )

  step(`🔵 Jira — ${touchedIssueIds.size} issue(s) tocadas pelo usuário (inline: reporter/assignee/comentário)`)

  const touchedIssuesList = issues.filter((i) => touchedIssueIds.has(i.id))

  // Run bulkfetch (all issues) and per-issue fetch (touched issues only) in parallel.
  // Per-issue results are authoritative for touched issues and override bulkfetch.
  const [changelogs, touchedChangelogs] = await Promise.all([
    fetchChangelogs(client, issues),
    touchedIssuesList.length > 0
      ? fetchChangelogForIssues(client, touchedIssuesList, 5)
      : Promise.resolve(new Map<string, ChangelogHistory[]>()),
  ])

  if (touchedIssuesList.length > 0) {
    step(`🔵 Jira — changelogs individuais das ${touchedIssuesList.length} issues tocadas obtidos`)
    for (const [issueId, histories] of touchedChangelogs.entries()) {
      changelogs.set(issueId, histories)
    }
  }

  // Diagnostic: log the raw structure of the first changelog entry (one-shot)
  for (const [, histories] of changelogs.entries()) {
    if (histories.length > 0) {
      step(`🔵 Jira — [DIAG] 1ª entrada changelog: ${JSON.stringify(histories[0]).slice(0, 500)}`)
      break
    }
  }

  let totalHistories = 0
  let matchedByAuthor = 0
  const seenAccountIds = new Set<string>()

  for (const [issueId, histories] of changelogs.entries()) {
    const issue = issueMap.get(issueId)
    if (!issue) continue

    for (const history of histories) {
      if (!history.author?.accountId) continue
      totalHistories++
      seenAccountIds.add(history.author.accountId)

      const day = isoDate(history.created)
      if (!day || day < startDate || day > endDate) continue

      if (history.author.accountId !== credentials.accountId) continue

      matchedByAuthor++
      for (const item of history.items) {
        addActivity(normalizeChangelogItem(item, history, issue))
      }
    }
  }

  if (totalHistories === 0) {
    step(`⚠️ Jira — nenhum histórico de changelog encontrado nas ${issues.length} issue(s)`)
  } else {
    step(`🔵 Jira — changelog: ${totalHistories} entradas | ${matchedByAuthor} ações próprias`)
    if (matchedByAuthor === 0) {
      step(`⚠️ Jira — accountId configurado: "${credentials.accountId}"`)
      const sample = [...seenAccountIds].slice(0, 5).join(', ')
      step(`⚠️ Jira — accountIds vistos nos changelogs: ${sample}${seenAccountIds.size > 5 ? ` (+${seenAccountIds.size - 5})` : ''}`)
    }
  }

  // Comments: complete fetch for truncated issues, concurrent
  const issuesWithTruncatedComments = issues.filter((i) => {
    const c = i.fields.comment
    return c && c.total > c.comments.length
  })

  if (issuesWithTruncatedComments.length > 0) {
    step(`🔵 Jira — completando comentários de ${issuesWithTruncatedComments.length} issue(s) truncada(s)...`)
  }

  const commentTasks = issues.map((issue) => () => fetchCompleteComments(client, issue))
  const allCommentsByIssue = await runWithConcurrency(commentTasks, COMMENT_COMPLETION_CONCURRENT)

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i]
    const comments = allCommentsByIssue[i]

    for (const comment of comments) {
      if (!comment.author?.accountId) continue
      if (comment.author.accountId !== credentials.accountId) continue
      const isEdited = comment.updated !== comment.created
      addActivity({
        type: isEdited ? 'COMMENT_EDITED' : 'COMMENT_ADDED',
        issueKey: issue.key,
        issueSummary: issue.fields.summary,
        author: comment.author.displayName,
        createdAt: isEdited ? comment.updated : comment.created,
        metadata: { comment: extractTextFromAdf(comment.body) },
      })
    }
  }

  // Worklogs: complete fetch for truncated issues, concurrent
  const issuesWithTruncatedWorklogs = issues.filter((i) => {
    const w = i.fields.worklog
    return w && w.total > w.worklogs.length
  })

  if (issuesWithTruncatedWorklogs.length > 0) {
    step(`🔵 Jira — completando worklogs de ${issuesWithTruncatedWorklogs.length} issue(s) truncada(s)...`)
  }

  const worklogTasks = issues.map((issue) => () => fetchCompleteWorklogs(client, issue))
  const allWorklogsByIssue = await runWithConcurrency(worklogTasks, WORKLOG_COMPLETION_CONCURRENT)

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i]
    const worklogs = allWorklogsByIssue[i]

    for (const wl of worklogs) {
      if (!wl.author?.accountId) continue
      if (wl.author.accountId !== credentials.accountId) continue
      addActivity({
        type: 'WORKLOG_ADDED',
        issueKey: issue.key,
        issueSummary: issue.fields.summary,
        author: wl.author.displayName,
        createdAt: wl.started,
        metadata: { timeSpent: wl.timeSpent, timeSpentSeconds: wl.timeSpentSeconds },
      })
    }
  }

  for (const [day, activities] of byDay.entries()) {
    byDay.set(day, activities.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
  }

  return byDay
}
