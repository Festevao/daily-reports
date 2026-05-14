import axios from 'axios'
import { JiraActivity, GitHubActivity, SlackActivity } from '../types/report.types'

interface DayData {
  date: string
  jira: JiraActivity[]
  github: GitHubActivity[]
  slack: SlackActivity[]
}

function buildGitHubStats(activities: GitHubActivity[]): Record<string, unknown> {
  const commits = activities.filter((a) => a.type === 'COMMIT')
  const meta = (a: GitHubActivity) => a.metadata as Record<string, unknown> | undefined

  const totalInsertions = commits.reduce((n, a) => n + ((meta(a)?.insertions as number) ?? 0), 0)
  const totalDeletions = commits.reduce((n, a) => n + ((meta(a)?.deletions as number) ?? 0), 0)
  const uniqueFiles = new Set(
    commits.flatMap((a) => ((meta(a)?.files as Array<{ filename: string }>) ?? []).map((f) => f.filename))
  )

  return {
    commits: commits.length,
    filesChanged: uniqueFiles.size,
    insertions: totalInsertions,
    deletions: totalDeletions,
    reviews: activities.filter((a) => ['PR_APPROVED', 'PR_CHANGES_REQUESTED', 'PR_REVIEWED'].includes(a.type)).length,
    prsOpened: activities.filter((a) => ['PR_OPENED', 'PR_DRAFT_CREATED'].includes(a.type)).length,
    prsMerged: activities.filter((a) => a.type === 'PR_MERGED').length,
    comments: activities.filter((a) => ['REVIEW_COMMENT', 'ISSUE_COMMENT'].includes(a.type)).length,
  }
}

function buildSlackStats(activities: SlackActivity[]): Record<string, unknown> {
  const circuits = activities.filter((a) => a.type === 'DISCUSSION_CIRCUIT')
  const totalCircuitMinutes = circuits.reduce(
    (n, a) => n + (((a.metadata as Record<string, unknown>)?.durationMinutes as number) ?? 0),
    0
  )
  return {
    messagesSent: activities.filter((a) => a.type === 'MESSAGE_SENT').length,
    threadsStarted: activities.filter((a) => a.type === 'THREAD_STARTED').length,
    threadReplies: activities.filter((a) => a.type === 'THREAD_REPLY').length,
    dmsSent: activities.filter((a) => a.type === 'DM_SENT').length,
    dmsReceived: activities.filter((a) => a.type === 'DM_RECEIVED').length,
    reactionsAdded: activities.filter((a) => a.type === 'REACTION_ADDED').length,
    reactionsReceived: activities.filter((a) => a.type === 'REACTION_RECEIVED').length,
    calls: activities.filter((a) => a.type === 'CALL_SUMMARY').length,
    discussionCircuits: circuits.length,
    totalDiscussionMinutes: totalCircuitMinutes,
    circuitTopics: circuits.map((c) => {
      const m = c.metadata as Record<string, unknown> | undefined
      return {
        channel: c.channelName ?? c.channel,
        durationMinutes: m?.durationMinutes,
        participants: m?.participants,
        firstMessage: (m?.firstMessage as string | undefined)?.slice(0, 120),
        aiSummary: (m?.aiSummary as string | undefined)?.slice(0, 200),
      }
    }),
  }
}

export interface SummaryResult {
  summary: string
  promptTokens: number
  completionTokens: number
}

function truncateComments(activities: JiraActivity[]): JiraActivity[] {
  return activities.map((a) => {
    if (!a.metadata?.comment) return a
    return {
      ...a,
      metadata: {
        ...a.metadata,
        comment: String(a.metadata.comment).slice(0, 200),
      },
    }
  })
}

/**
 * Generates an executive AI summary for a single day using gpt-4o-mini.
 * Returns undefined on any error to avoid blocking the report.
 */
export async function generateDaySummary(
  apiKey: string,
  dayData: DayData
): Promise<SummaryResult | undefined> {
  try {
    const githubStats = buildGitHubStats(dayData.github)
    const slackStats = buildSlackStats(dayData.slack)
    const payload = {
      date: dayData.date,
      jira: truncateComments(dayData.jira),
      githubStats,
      github: dayData.github.map((a) => ({
        type: a.type,
        repo: a.repo,
        title: a.title,
        createdAt: a.createdAt,
        metadata: (() => {
          const m = a.metadata as Record<string, unknown> | undefined
          if (!m) return undefined
          const { files: _, ...rest } = m as Record<string, unknown> & { files?: unknown }
          const comment = (rest.comment as string | undefined)?.slice(0, 150)
          const body = (rest.body as string | undefined)?.slice(0, 150)
          return { ...rest, ...(comment !== undefined ? { comment } : {}), ...(body !== undefined ? { body } : {}) }
        })(),
      })),
      slackStats,
      slack: dayData.slack.map((a) => ({
        type: a.type,
        channel: a.channelName ?? a.channel,
        createdAt: a.createdAt,
        metadata: (() => {
          const m = a.metadata as Record<string, unknown> | undefined
          if (!m) return undefined
          if (a.type === 'DISCUSSION_CIRCUIT') return m
          const text = (m.text as string | undefined)?.slice(0, 120)
          return { ...(text !== undefined ? { text } : {}), ...(m.reaction ? { reaction: m.reaction } : {}) }
        })(),
      })),
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content:
              'You are a technical assistant that writes concise executive summaries of a developer\'s workday. ' +
              'Based on the provided JSON data of Jira, GitHub, and Slack activities, write a 3–5 sentence summary highlighting: ' +
              'what was accomplished, any blockers or reviews, and collaboration highlights. ' +
              'Be direct and professional. Use the same language as the activity data (Portuguese if data is in Portuguese).',
          },
          {
            role: 'user',
            content: `Daily activity data for ${dayData.date}:\n${JSON.stringify(payload)}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    )

    const data = response.data as {
      choices: Array<{ message: { content: string } }>
      usage: { prompt_tokens: number; completion_tokens: number }
    }

    const summary = data.choices?.[0]?.message?.content?.trim()
    if (!summary) return undefined

    return {
      summary,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    }
  } catch {
    return undefined
  }
}
