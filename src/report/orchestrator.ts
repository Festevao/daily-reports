import { extractJiraActivities } from '../extractors/jira.extractor'
import { extractGitHubActivities } from '../extractors/github.extractor'
import { extractSlackActivities } from '../extractors/slack.extractor'
import { generateDaySummary } from '../extractors/openai.summarizer'
import { DailyReport, OpenAIUsage, ReportOutput } from '../types/report.types'
import { ReportPayload } from '../email/template'
import { step } from '../logger'

const GPT4O_MINI_INPUT_COST_PER_TOKEN = 0.15 / 1_000_000
const GPT4O_MINI_OUTPUT_COST_PER_TOKEN = 0.60 / 1_000_000

function expandDateRange(startDate: string, endDate: string): string[] {
  const days: string[] = []
  const current = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')

  while (current <= end) {
    days.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return days
}

/**
 * Orchestrates the full report generation pipeline:
 * expands date range, runs all extractors in parallel per day,
 * optionally calls OpenAI for summaries, and returns a ReportOutput.
 */
export async function buildReport(payload: ReportPayload): Promise<ReportOutput> {
  const { jobId, period, integrations } = payload
  const startDate = period.startDate ?? new Date().toISOString().slice(0, 10)
  const endDate = period.endDate ?? startDate

  const days = expandDateRange(startDate, endDate)
  step(`📆 período expandido — ${days.length} dia(s): ${startDate} → ${endDate}`)

  let jiraByDay: Map<string, import('../types/report.types').JiraActivity[]> = new Map()

  if (integrations.jira) {
    step(`🔵 Jira — buscando atividades em ${integrations.jira.projectIds.length} projeto(s)...`)
    jiraByDay = await extractJiraActivities(
      integrations.jira.credentials,
      integrations.jira.projectIds,
      startDate,
      endDate
    )
    const total = [...jiraByDay.values()].reduce((a, v) => a + v.length, 0)
    step(`🔵 Jira — ${total} atividade(s) extraída(s)`)
  }

  if (integrations.github) {
    step(`⚫ GitHub — gerando dados para ${integrations.github.repoFullNames.length} repositório(s) (mock)`)
  }

  if (integrations.slack) {
    step(`🟢 Slack — gerando dados para ${integrations.slack.channelIds.length} canal(is) (mock)`)
  }

  const hasOpenAI = !!integrations.openai?.apiKey
  if (hasOpenAI) {
    step(`🤖 OpenAI — resumos diários ativados (gpt-4o-mini)`)
  }

  const dailyReports: DailyReport[] = []
  let totalPromptTokens = 0
  let totalCompletionTokens = 0

  for (const date of days) {
    const jira = jiraByDay.get(date) ?? []

    const github = integrations.github
      ? extractGitHubActivities(integrations.github.token, integrations.github.repoFullNames, date)
      : []

    const slack = integrations.slack
      ? extractSlackActivities(
          integrations.slack.token,
          integrations.slack.channelIds,
          integrations.slack.includeDirectMessages,
          date
        )
      : []

    let aiSummary: string | undefined

    const hasData = jira.length > 0 || github.length > 0 || slack.length > 0
    if (hasOpenAI && hasData) {
      step(`🤖 gerando resumo IA para ${date}...`)
      const result = await generateDaySummary(integrations.openai!.apiKey, { date, jira, github, slack })
      if (result) {
        aiSummary = result.summary
        totalPromptTokens += result.promptTokens
        totalCompletionTokens += result.completionTokens
        step(`🤖 resumo IA gerado para ${date} (tokens: ${result.promptTokens}in + ${result.completionTokens}out)`)
      }
    }

    dailyReports.push({ date, jira, github, slack, aiSummary })
  }

  dailyReports.sort((a, b) => a.date.localeCompare(b.date))

  let openaiUsage: OpenAIUsage | undefined
  if (hasOpenAI && (totalPromptTokens > 0 || totalCompletionTokens > 0)) {
    const estimatedCostUsd =
      totalPromptTokens * GPT4O_MINI_INPUT_COST_PER_TOKEN +
      totalCompletionTokens * GPT4O_MINI_OUTPUT_COST_PER_TOKEN
    openaiUsage = {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
      estimatedCostUsd,
    }
    step(`🤖 OpenAI total — ${openaiUsage.totalTokens} tokens — custo estimado: $${estimatedCostUsd.toFixed(6)} USD`)
  }

  return {
    jobId,
    period: { startDate, endDate },
    generatedAt: new Date().toISOString(),
    days: dailyReports,
    openaiUsage,
    jiraBaseUrl: integrations.jira?.credentials.baseUrl,
  }
}
