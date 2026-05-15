import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { GitHubActivity, GitHubActivityType } from '../types/report.types'
import { step } from '../logger'

const REPO_CONCURRENCY = 3
const COMMIT_DETAIL_CONCURRENCY = 10
const PR_DETAIL_CONCURRENCY = 5

interface GitHubUser {
  login: string
  id: number
  avatar_url?: string
}

interface RawCommit {
  sha: string
  commit: {
    message: string
    author: { name: string; email: string; date: string }
    committer: { name: string; email: string; date: string }
  }
  author: GitHubUser | null
  committer: GitHubUser | null
  html_url: string
  parents: Array<{ sha: string }>
  stats?: { additions: number; deletions: number; total: number }
  files?: Array<{ filename: string; status: string; additions: number; deletions: number; changes: number; patch?: string }>
}

interface RawPR {
  number: number
  title: string
  state: string
  draft: boolean
  user: GitHubUser
  created_at: string
  updated_at: string
  closed_at: string | null
  merged_at: string | null
  head: { ref: string; sha: string }
  base: { ref: string }
  html_url: string
  labels: Array<{ name: string }>
  assignees: Array<GitHubUser>
  milestone: { title: string } | null
}

interface RawReview {
  id: number
  user: GitHubUser
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  body: string
  submitted_at: string
  commit_id: string
  html_url: string
}

interface RawReviewComment {
  id: number
  pull_request_review_id: number | null
  pull_request_url: string
  user: GitHubUser
  body: string
  path: string
  diff_hunk: string
  created_at: string
  updated_at: string
  html_url: string
  in_reply_to_id?: number
}

interface RawIssueComment {
  id: number
  user: GitHubUser
  body: string
  created_at: string
  updated_at: string
  html_url: string
  issue_url: string
}

interface RawTimelineEvent {
  id?: number
  node_id?: string
  event: string
  actor?: GitHubUser
  created_at?: string
  label?: { name: string; color: string }
  assignee?: GitHubUser
  assigner?: GitHubUser
  requested_reviewer?: GitHubUser
  milestone?: { title: string }
  rename?: { from: string; to: string }
  commit_id?: string
}

interface RawRelease {
  id: number
  tag_name: string
  name: string | null
  draft: boolean
  prerelease: boolean
  created_at: string
  published_at: string | null
  author: GitHubUser
  html_url: string
}

interface RawUserEvent {
  id: string
  type: string
  actor: GitHubUser
  repo: { id: number; name: string; url: string }
  payload: Record<string, unknown>
  created_at: string
}

function createClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'daily-reports-app',
    },
    timeout: 30_000,
  })
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractRateLimit(res: AxiosResponse): { remaining: number; resetAt: number } {
  const remaining = parseInt(res.headers['x-ratelimit-remaining'] ?? '999', 10)
  const resetAt = parseInt(res.headers['x-ratelimit-reset'] ?? '0', 10) * 1000
  return { remaining, resetAt }
}

async function checkRateLimit(res: AxiosResponse): Promise<void> {
  const { remaining, resetAt } = extractRateLimit(res)
  if (remaining < 50) {
    const waitMs = Math.max(0, resetAt - Date.now()) + 2000
    step(`⚫ GitHub — rate limit próximo (${remaining} req restantes), aguardando ${Math.ceil(waitMs / 1000)}s...`)
    await sleep(waitMs)
  }
}

async function paginateAll<T>(
  client: AxiosInstance,
  url: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const results: T[] = []
  let nextUrl: string | null = url

  while (nextUrl) {
    const isAbsolute = nextUrl.startsWith('https://')
    const res = isAbsolute
      ? await client.get<T[]>(nextUrl)
      : await client.get<T[]>(nextUrl, { params })

    const data = Array.isArray(res.data) ? res.data : []
    results.push(...data)

    await checkRateLimit(res)

    const linkHeader = res.headers['link'] as string | undefined
    const match = linkHeader?.match(/<([^>]+)>;\s*rel="next"/)
    nextUrl = match ? match[1] : null

    params = {}
  }

  return results
}

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

function isoDate(iso: string): string {
  return iso.slice(0, 10)
}

function inRange(dateStr: string | null | undefined, start: string, end: string): boolean {
  if (!dateStr) return false
  const d = isoDate(dateStr)
  return d >= start && d <= end
}

function prNumber(pullRequestUrl: string): number {
  const parts = pullRequestUrl.split('/')
  return parseInt(parts[parts.length - 1], 10)
}

/**
 * Fetches the authenticated user login from GET /user.
 */
async function fetchUserLogin(client: AxiosInstance): Promise<string> {
  const res = await client.get<{ login: string }>('/user')
  await checkRateLimit(res)
  return res.data.login
}

/**
 * Fetches all commits by the user in the date range for a single repo,
 * then concurrently enriches each with stats and files.
 */
async function fetchCommits(
  client: AxiosInstance,
  owner: string,
  repo: string,
  userLogin: string,
  startDate: string,
  endDate: string
): Promise<RawCommit[]> {
  const list = await paginateAll<RawCommit>(client, `/repos/${owner}/${repo}/commits`, {
    author: userLogin,
    since: `${startDate}T00:00:00Z`,
    until: `${endDate}T23:59:59Z`,
    per_page: 100,
  })

  const userCommits = list.filter(
    (c) => !c.author || c.author.login === userLogin
  )

  if (userCommits.length === 0) return []

  step(`⚫ GitHub — ${owner}/${repo}: ${userCommits.length} commit(s), buscando detalhes...`)

  const tasks = userCommits.map((c) => async (): Promise<RawCommit> => {
    try {
      const res = await client.get<RawCommit>(`/repos/${owner}/${repo}/commits/${c.sha}`)
      await checkRateLimit(res)
      return res.data
    } catch {
      return c
    }
  })

  return runWithConcurrency(tasks, COMMIT_DETAIL_CONCURRENCY)
}

/**
 * Fetches all review comments across all PRs in the repo since startDate,
 * filtered to those authored by the user.
 */
async function fetchRepoReviewComments(
  client: AxiosInstance,
  owner: string,
  repo: string,
  userLogin: string,
  startDate: string
): Promise<{ comments: RawReviewComment[]; reviewedPrNumbers: Set<number> }> {
  const all = await paginateAll<RawReviewComment>(client, `/repos/${owner}/${repo}/pulls/comments`, {
    since: `${startDate}T00:00:00Z`,
    sort: 'created',
    direction: 'asc',
    per_page: 100,
  })

  const comments = all.filter((c) => c.user?.login === userLogin)
  const reviewedPrNumbers = new Set(comments.map((c) => prNumber(c.pull_request_url)))
  return { comments, reviewedPrNumbers }
}

/**
 * Fetches all issue/PR comments across the repo since startDate,
 * filtered to those authored by the user.
 */
async function fetchRepoIssueComments(
  client: AxiosInstance,
  owner: string,
  repo: string,
  userLogin: string,
  startDate: string
): Promise<RawIssueComment[]> {
  const all = await paginateAll<RawIssueComment>(client, `/repos/${owner}/${repo}/issues/comments`, {
    since: `${startDate}T00:00:00Z`,
    sort: 'created',
    direction: 'asc',
    per_page: 100,
  })
  return all.filter((c) => c.user?.login === userLogin)
}

/**
 * Fetches all PRs updated since startDate, stopping early when results are fully outside range.
 * Returns PRs authored by user OR with PR numbers that appear in the reviewedPrNumbers set.
 */
async function fetchRelevantPRs(
  client: AxiosInstance,
  owner: string,
  repo: string,
  userLogin: string,
  startDate: string,
  endDate: string,
  reviewedPrNumbers: Set<number>
): Promise<RawPR[]> {
  const relevant: RawPR[] = []
  let page = 1

  while (true) {
    const res = await client.get<RawPR[]>(`/repos/${owner}/${repo}/pulls`, {
      params: { state: 'all', sort: 'updated', direction: 'desc', per_page: 100, page },
    })
    await checkRateLimit(res)

    const items = res.data
    if (!items || items.length === 0) break

    let allOutOfRange = true
    for (const pr of items) {
      const updatedDay = isoDate(pr.updated_at)
      if (updatedDay >= startDate) allOutOfRange = false

      const authoredInRange =
        pr.user?.login === userLogin &&
        (inRange(pr.created_at, startDate, endDate) ||
          inRange(pr.closed_at, startDate, endDate) ||
          inRange(pr.merged_at, startDate, endDate))

      const reviewedInRange = reviewedPrNumbers.has(pr.number)

      if (authoredInRange || reviewedInRange) {
        relevant.push(pr)
      }
    }

    const linkHeader = res.headers['link'] as string | undefined
    const hasNext = linkHeader?.includes('rel="next"')
    if (!hasNext || allOutOfRange) break
    page++
  }

  return relevant
}

/**
 * Fetches reviews for a PR, filtered to those by the user and submitted in range.
 */
async function fetchPRReviews(
  client: AxiosInstance,
  owner: string,
  repo: string,
  prNum: number,
  userLogin: string,
  startDate: string,
  endDate: string
): Promise<RawReview[]> {
  const all = await paginateAll<RawReview>(client, `/repos/${owner}/${repo}/pulls/${prNum}/reviews`, {
    per_page: 100,
  })
  return all.filter(
    (r) => r.user?.login === userLogin && inRange(r.submitted_at, startDate, endDate)
  )
}

/**
 * Fetches the timeline for a PR/issue, filtered to events by the user in range.
 */
async function fetchPRTimeline(
  client: AxiosInstance,
  owner: string,
  repo: string,
  prNum: number,
  userLogin: string,
  startDate: string,
  endDate: string
): Promise<RawTimelineEvent[]> {
  const all = await paginateAll<RawTimelineEvent>(
    client,
    `/repos/${owner}/${repo}/issues/${prNum}/timeline`,
    { per_page: 100 }
  )
  return all.filter((e) => {
    if (!e.created_at) return false
    if (!inRange(e.created_at, startDate, endDate)) return false
    const actor = e.actor?.login
    if (!actor) return false
    if (['labeled', 'unlabeled', 'assigned', 'unassigned', 'milestoned', 'demilestoned',
      'ready_for_review', 'head_ref_force_pushed', 'reopened', 'closed', 'converted_to_draft'].includes(e.event)) {
      return actor === userLogin
    }
    if (e.event === 'review_requested') {
      return e.requested_reviewer?.login === userLogin
    }
    return false
  })
}

/**
 * Fetches releases published in range by the user.
 */
async function fetchReleases(
  client: AxiosInstance,
  owner: string,
  repo: string,
  userLogin: string,
  startDate: string,
  endDate: string
): Promise<RawRelease[]> {
  const all = await paginateAll<RawRelease>(client, `/repos/${owner}/${repo}/releases`, {
    per_page: 100,
  })
  return all.filter(
    (r) =>
      !r.draft &&
      r.author?.login === userLogin &&
      r.published_at &&
      inRange(r.published_at, startDate, endDate)
  )
}

/**
 * Fetches all user events relevant to the given repos and date range.
 * Limited to 10 pages (GitHub caps event history at ~300 events / 90 days).
 * Returns both the raw events and a per-repo map of PR numbers the user reviewed
 * (from PullRequestReviewEvent), to supplement inline-comment-based discovery.
 */
async function fetchUserEvents(
  client: AxiosInstance,
  userLogin: string,
  repoScope: Set<string>,
  startDate: string,
  endDate: string
): Promise<{ events: RawUserEvent[]; reviewedPrsByRepo: Map<string, Set<number>> }> {
  const events: RawUserEvent[] = []
  const reviewedPrsByRepo = new Map<string, Set<number>>()
  let page = 1
  const MAX_PAGES = 10

  while (page <= MAX_PAGES) {
    let res: AxiosResponse<RawUserEvent[]>
    try {
      res = await client.get<RawUserEvent[]>(`/users/${userLogin}/events`, {
        params: { per_page: 100, page },
      })
    } catch {
      break
    }
    await checkRateLimit(res)

    const items = res.data ?? []
    if (items.length === 0) break

    let allBeforeRange = true
    for (const ev of items) {
      if (!ev.created_at) continue
      const day = isoDate(ev.created_at)
      if (day > endDate) continue
      if (day < startDate) continue
      allBeforeRange = false

      if (ev.actor?.login !== userLogin) continue
      if (!repoScope.has(ev.repo?.name)) continue

      events.push(ev)

      if (ev.type === 'PullRequestReviewEvent') {
        const pr = (ev.payload as { pull_request?: { number?: number } }).pull_request
        if (pr?.number) {
          const repoName = ev.repo.name
          if (!reviewedPrsByRepo.has(repoName)) reviewedPrsByRepo.set(repoName, new Set())
          reviewedPrsByRepo.get(repoName)!.add(pr.number)
        }
      }
    }

    const linkHeader = res.headers['link'] as string | undefined
    if (!linkHeader?.includes('rel="next"') || allBeforeRange) break
    page++
  }

  return { events, reviewedPrsByRepo }
}

function addActivity(
  byDay: Map<string, GitHubActivity[]>,
  seen: Set<string>,
  dedupeKey: string,
  activity: GitHubActivity
): void {
  if (seen.has(dedupeKey)) return
  seen.add(dedupeKey)

  const day = isoDate(activity.createdAt)
  const list = byDay.get(day) ?? []
  list.push(activity)
  byDay.set(day, list)
}

/**
 * Extracts all real GitHub activities for the given token, repos, and date range.
 * Returns activities grouped by day (YYYY-MM-DD).
 */
export async function extractGitHubActivities(
  token: string,
  repoFullNames: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, GitHubActivity[]>> {
  const client = createClient(token)
  const byDay = new Map<string, GitHubActivity[]>()
  const seen = new Set<string>()

  if (repoFullNames.length === 0) return byDay

  step(`⚫ GitHub — resolvendo usuário autenticado...`)
  const userLogin = await fetchUserLogin(client)
  step(`⚫ GitHub — usuário: ${userLogin}`)

  const repoScope = new Set(repoFullNames)

  step(`⚫ GitHub — buscando eventos do usuário (reviews, branches, pushes)...`)
  const { events: userEvents, reviewedPrsByRepo } = await fetchUserEvents(
    client, userLogin, repoScope, startDate, endDate
  )
  step(`⚫ GitHub — ${userEvents.length} evento(s) encontrado(s)`)

  const repoTasks = repoFullNames.map((fullName) => async () => {
    const [owner, repo] = fullName.split('/')
    if (!owner || !repo) return

    step(`⚫ GitHub — processando ${fullName}...`)

    let commits: RawCommit[] = []
    let reviewComments: RawReviewComment[] = []
    let reviewedPrNumbers = new Set<number>()
    let issueComments: RawIssueComment[] = []
    let releases: RawRelease[] = []

    try {
      const results = await Promise.all([
        fetchCommits(client, owner, repo, userLogin, startDate, endDate),
        fetchRepoReviewComments(client, owner, repo, userLogin, startDate),
        fetchRepoIssueComments(client, owner, repo, userLogin, startDate),
        fetchReleases(client, owner, repo, userLogin, startDate, endDate),
      ])
      commits = results[0]
      ;({ comments: reviewComments, reviewedPrNumbers } = results[1])
      issueComments = results[2]
      releases = results[3]

      const fromEvents = reviewedPrsByRepo.get(fullName) ?? new Set<number>()
      fromEvents.forEach((n) => reviewedPrNumbers.add(n))
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        step(`⚫ GitHub — ${fullName}: repositório vazio, ignorando`)
        return
      }
      throw err
    }

    let relevantPRs: RawPR[] = []
    try {
      relevantPRs = await fetchRelevantPRs(
        client, owner, repo, userLogin, startDate, endDate, reviewedPrNumbers
      )
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        step(`⚫ GitHub — ${fullName}: sem PRs (repositório vazio)`)
      } else {
        throw err
      }
    }

    const prDetailTasks = relevantPRs.map((pr) => async () => {
      const [reviews, timeline] = await Promise.all([
        fetchPRReviews(client, owner, repo, pr.number, userLogin, startDate, endDate),
        fetchPRTimeline(client, owner, repo, pr.number, userLogin, startDate, endDate),
      ])
      return { pr, reviews, timeline }
    })

    const prDetails = await runWithConcurrency(prDetailTasks, PR_DETAIL_CONCURRENCY)

    // ── COMMITS ──────────────────────────────────────────────────────────────
    for (const c of commits) {
      const date = c.commit.author.date || c.commit.committer.date
      if (!inRange(date, startDate, endDate)) continue

      addActivity(byDay, seen, `COMMIT:${fullName}:${c.sha}`, {
        type: 'COMMIT',
        repo: fullName,
        title: c.commit.message.split('\n')[0],
        sha: c.sha,
        url: c.html_url,
        author: userLogin,
        createdAt: date,
        metadata: {
          message: c.commit.message,
          filesChanged: c.files?.length ?? 0,
          insertions: c.stats?.additions ?? 0,
          deletions: c.stats?.deletions ?? 0,
          files: c.files?.map((f) => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions })) ?? [],
          parents: c.parents.length,
        },
      })
    }

    // ── REVIEW COMMENTS (inline code comments) ────────────────────────────
    for (const rc of reviewComments) {
      if (!inRange(rc.created_at, startDate, endDate)) continue

      addActivity(byDay, seen, `REVIEW_COMMENT:${fullName}:${rc.id}`, {
        type: 'REVIEW_COMMENT',
        repo: fullName,
        url: rc.html_url,
        author: userLogin,
        createdAt: rc.created_at,
        metadata: {
          prNumber: prNumber(rc.pull_request_url),
          path: rc.path,
          comment: rc.body,
          diffHunk: rc.diff_hunk,
          isReply: !!rc.in_reply_to_id,
        },
      })
    }

    // ── ISSUE / PR COMMENTS ───────────────────────────────────────────────
    for (const ic of issueComments) {
      if (!inRange(ic.created_at, startDate, endDate)) continue

      const issueNum = parseInt(ic.issue_url.split('/').pop() ?? '0', 10)
      const isOnPR = !!relevantPRs.find((p) => p.number === issueNum) ||
        ic.html_url.includes('/pull/')

      addActivity(byDay, seen, `ISSUE_COMMENT:${fullName}:${ic.id}`, {
        type: 'ISSUE_COMMENT',
        repo: fullName,
        url: ic.html_url,
        author: userLogin,
        createdAt: ic.created_at,
        metadata: { issueNumber: issueNum, comment: ic.body, isOnPR },
      })
    }

    // ── RELEASES ──────────────────────────────────────────────────────────
    for (const r of releases) {
      const date = r.published_at!
      addActivity(byDay, seen, `RELEASE_PUBLISHED:${fullName}:${r.id}`, {
        type: 'RELEASE_PUBLISHED',
        repo: fullName,
        title: r.name ?? r.tag_name,
        url: r.html_url,
        author: userLogin,
        createdAt: date,
        metadata: { tagName: r.tag_name, prerelease: r.prerelease },
      })
    }

    // ── PR-LEVEL EVENTS ──────────────────────────────────────────────────
    for (const { pr, reviews, timeline } of prDetails) {
      const prBase = {
        repo: fullName,
        title: pr.title,
        url: pr.html_url,
        author: userLogin,
        metadata: { prNumber: pr.number, title: pr.title, branch: pr.head.ref, baseBranch: pr.base.ref },
      }

      // PR state events (authored PRs only)
      if (pr.user?.login === userLogin) {
        if (inRange(pr.created_at, startDate, endDate)) {
          const type: GitHubActivityType = pr.draft ? 'PR_DRAFT_CREATED' : 'PR_OPENED'
          addActivity(byDay, seen, `${type}:${fullName}:${pr.number}:opened`, {
            ...prBase,
            type,
            createdAt: pr.created_at,
          })
        }

        if (pr.merged_at && inRange(pr.merged_at, startDate, endDate)) {
          addActivity(byDay, seen, `PR_MERGED:${fullName}:${pr.number}`, {
            ...prBase,
            type: 'PR_MERGED',
            createdAt: pr.merged_at,
          })
        } else if (pr.closed_at && !pr.merged_at && inRange(pr.closed_at, startDate, endDate)) {
          addActivity(byDay, seen, `PR_CLOSED:${fullName}:${pr.number}`, {
            ...prBase,
            type: 'PR_CLOSED',
            createdAt: pr.closed_at,
          })
        }
      }

      // Reviews
      for (const review of reviews) {
        const typeMap: Record<string, GitHubActivityType> = {
          APPROVED: 'PR_APPROVED',
          CHANGES_REQUESTED: 'PR_CHANGES_REQUESTED',
          COMMENTED: 'PR_REVIEWED',
          DISMISSED: 'PR_REVIEWED',
        }
        const actType = typeMap[review.state]
        if (!actType) continue

        addActivity(byDay, seen, `${actType}:${fullName}:${pr.number}:${review.id}`, {
          ...prBase,
          type: actType,
          createdAt: review.submitted_at,
          metadata: {
            ...prBase.metadata,
            reviewId: review.id,
            body: review.body,
            state: review.state,
          },
        })
      }

      // Timeline events
      for (const ev of timeline) {
        const date = ev.created_at!
        const base = { ...prBase, createdAt: date }

        if (ev.event === 'labeled' && ev.label) {
          addActivity(byDay, seen, `LABEL_ADDED:${fullName}:${pr.number}:${ev.label.name}:${date}`, {
            ...base,
            type: 'LABEL_ADDED',
            metadata: { ...prBase.metadata, label: ev.label.name },
          })
        } else if (ev.event === 'unlabeled' && ev.label) {
          addActivity(byDay, seen, `LABEL_REMOVED:${fullName}:${pr.number}:${ev.label.name}:${date}`, {
            ...base,
            type: 'LABEL_REMOVED',
            metadata: { ...prBase.metadata, label: ev.label.name },
          })
        } else if (ev.event === 'assigned' || ev.event === 'unassigned') {
          addActivity(byDay, seen, `ASSIGNEE_CHANGED:${fullName}:${pr.number}:${ev.event}:${ev.assignee?.login}:${date}`, {
            ...base,
            type: 'ASSIGNEE_CHANGED',
            metadata: { ...prBase.metadata, assignee: ev.assignee?.login, action: ev.event },
          })
        } else if (ev.event === 'milestoned' || ev.event === 'demilestoned') {
          addActivity(byDay, seen, `MILESTONE_CHANGED:${fullName}:${pr.number}:${ev.event}:${date}`, {
            ...base,
            type: 'MILESTONE_CHANGED',
            metadata: { ...prBase.metadata, milestone: ev.milestone?.title, action: ev.event },
          })
        } else if (ev.event === 'ready_for_review') {
          addActivity(byDay, seen, `PR_READY_FOR_REVIEW:${fullName}:${pr.number}`, {
            ...base,
            type: 'PR_READY_FOR_REVIEW',
          })
        } else if (ev.event === 'head_ref_force_pushed') {
          addActivity(byDay, seen, `FORCE_PUSH:${fullName}:${pr.number}:${date}`, {
            ...base,
            type: 'FORCE_PUSH',
            metadata: { ...prBase.metadata, commitId: ev.commit_id },
          })
        } else if (ev.event === 'reopened') {
          addActivity(byDay, seen, `PR_REOPENED:${fullName}:${pr.number}:${date}`, {
            ...base,
            type: 'PR_REOPENED',
          })
        } else if (ev.event === 'review_requested') {
          addActivity(byDay, seen, `REVIEW_REQUESTED:${fullName}:${pr.number}:${date}`, {
            ...base,
            type: 'REVIEW_REQUESTED',
            metadata: { ...prBase.metadata, requestedBy: ev.actor?.login },
          })
        }
      }
    }

    step(`⚫ GitHub — ${fullName}: processamento concluído`)
  })

  await runWithConcurrency(repoTasks, REPO_CONCURRENCY)

  // ── USER EVENTS (branch lifecycle + force push) ────────────────────────
  for (const ev of userEvents) {
    const repoName = ev.repo?.name
    if (!repoName || !repoScope.has(repoName)) continue

    const payload = ev.payload

    if (ev.type === 'CreateEvent' && payload.ref_type === 'branch') {
      addActivity(byDay, seen, `BRANCH_CREATED:${repoName}:${payload.ref}:${ev.created_at}`, {
        type: 'BRANCH_CREATED',
        repo: repoName,
        author: userLogin,
        createdAt: ev.created_at,
        metadata: { branch: payload.ref as string },
      })
    } else if (ev.type === 'DeleteEvent' && payload.ref_type === 'branch') {
      addActivity(byDay, seen, `BRANCH_DELETED:${repoName}:${payload.ref}:${ev.created_at}`, {
        type: 'BRANCH_DELETED',
        repo: repoName,
        author: userLogin,
        createdAt: ev.created_at,
        metadata: { branch: payload.ref as string },
      })
    } else if (ev.type === 'PushEvent' && payload.forced === true) {
      addActivity(byDay, seen, `FORCE_PUSH:${repoName}:${payload.ref}:${ev.created_at}`, {
        type: 'FORCE_PUSH',
        repo: repoName,
        author: userLogin,
        createdAt: ev.created_at,
        metadata: {
          branch: (payload.ref as string)?.replace('refs/heads/', ''),
          commits: (payload.size as number) ?? 0,
        },
      })
    }
  }

  // Sort each day's activities chronologically
  for (const [day, activities] of byDay.entries()) {
    byDay.set(day, activities.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
  }

  const total = [...byDay.values()].reduce((n, arr) => n + arr.length, 0)
  step(`⚫ GitHub — ${total} atividade(s) extraída(s) em ${byDay.size} dia(s)`)

  return byDay
}
