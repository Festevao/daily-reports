import axios from 'axios'
import { JiraActivity, GitHubActivity, SlackActivity } from '../types/report.types'

interface DayData {
  date: string
  jira: JiraActivity[]
  github: GitHubActivity[]
  slack: SlackActivity[]
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
    const payload = {
      date: dayData.date,
      jira: truncateComments(dayData.jira),
      github: dayData.github,
      slack: dayData.slack,
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
