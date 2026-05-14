import axios from 'axios'
import { JiraActivity, GitHubActivity, SlackActivity, GoogleActivity } from '../types/report.types'

interface DayData {
  date: string
  jira: JiraActivity[]
  github: GitHubActivity[]
  slack: SlackActivity[]
  google?: GoogleActivity[]
}

export interface SummaryResult {
  summary: string
  promptTokens: number
  completionTokens: number
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  } catch {
    return iso.slice(11, 16)
  }
}

function buildJiraText(activities: JiraActivity[]): string {
  if (activities.length === 0) return ''
  const lines = activities.map((a) => {
    const m = a.metadata as Record<string, unknown> | undefined
    const key = a.issueKey
    const title = a.issueSummary ? ` "${a.issueSummary}"` : ''
    const time = fmt(a.createdAt)
    const comment = (m?.comment as string | undefined)?.slice(0, 200)
    const from = m?.from as string | undefined
    const to = m?.to as string | undefined

    switch (a.type) {
      case 'STATUS_CHANGED':
        return `  [${time}] ${key}${title} — status alterado: "${from || '?'}" → "${to || '?'}"`
      case 'ASSIGNEE_CHANGED':
        return `  [${time}] ${key}${title} — responsável: "${from || '?'}" → "${to || '?'}"`
      case 'COMMENT_ADDED':
        return `  [${time}] ${key}${title} — comentário adicionado: "${comment || ''}"`
      case 'COMMENT_EDITED':
        return `  [${time}] ${key}${title} — comentário editado: "${comment || ''}"`
      case 'PRIORITY_CHANGED':
        return `  [${time}] ${key}${title} — prioridade: "${from || '?'}" → "${to || '?'}"`
      case 'ISSUE_CREATED':
        return `  [${time}] ${key}${title} — issue criada`
      case 'ISSUE_RESOLVED':
        return `  [${time}] ${key}${title} — issue resolvida`
      case 'WORKLOG_ADDED':
        return `  [${time}] ${key}${title} — tempo registrado: ${m?.timeSpent || ''}`
      case 'SPRINT_CHANGED':
      case 'SPRINT_ADDED':
        return `  [${time}] ${key}${title} — sprint: "${from || '?'}" → "${to || '?'}"`
      case 'DESCRIPTION_CHANGED':
        return `  [${time}] ${key}${title} — descrição atualizada`
      default:
        return `  [${time}] ${key}${title} — ${a.type.toLowerCase().replace(/_/g, ' ')}${from && to ? `: "${from}" → "${to}"` : ''}`
    }
  })
  return `=== JIRA (${activities.length} atividade${activities.length !== 1 ? 's' : ''}) ===\n${lines.join('\n')}`
}

function buildGitHubText(activities: GitHubActivity[]): string {
  if (activities.length === 0) return ''
  const lines = activities.map((a) => {
    const m = a.metadata as Record<string, unknown> | undefined
    const time = fmt(a.createdAt)
    const title = a.title ? ` "${a.title}"` : ''

    switch (a.type) {
      case 'COMMIT': {
        const ins = (m?.insertions as number) ?? 0
        const del = (m?.deletions as number) ?? 0
        const files = (m?.filesChanged as number) ?? 0
        const branch = m?.branch ? ` [${m.branch}]` : ''
        return `  [${time}] COMMIT em ${a.repo}${branch}: ${a.title || ''}  (+${ins}/-${del}, ${files} arquivo${files !== 1 ? 's' : ''})`
      }
      case 'PR_OPENED':
        return `  [${time}] PR aberto em ${a.repo}:${title}`
      case 'PR_MERGED':
        return `  [${time}] PR mergeado em ${a.repo}:${title}`
      case 'PR_CLOSED':
        return `  [${time}] PR fechado sem merge em ${a.repo}:${title}`
      case 'PR_APPROVED':
        return `  [${time}] Aprovou PR em ${a.repo}:${title}`
      case 'PR_CHANGES_REQUESTED':
        return `  [${time}] Solicitou alterações em PR de ${a.repo}:${title}`
      case 'PR_REVIEWED':
        return `  [${time}] Revisou PR em ${a.repo}:${title}`
      case 'PR_COMMENTED':
      case 'REVIEW_COMMENT':
      case 'ISSUE_COMMENT': {
        const body = (m?.comment as string | undefined ?? m?.body as string | undefined)?.slice(0, 120)
        return `  [${time}] Comentou em ${a.repo}:${title}${body ? ` — "${body}"` : ''}`
      }
      case 'BRANCH_CREATED':
        return `  [${time}] Branch criada em ${a.repo}: ${m?.branch || ''}`
      case 'RELEASE_PUBLISHED':
        return `  [${time}] Release publicada em ${a.repo}: ${m?.tagName || ''}${m?.prerelease ? ' (pre-release)' : ''}`
      default:
        return `  [${time}] ${a.type.replace(/_/g, ' ')} em ${a.repo}${title}`
    }
  })

  const commits = activities.filter((a) => a.type === 'COMMIT')
  const totalIns = commits.reduce((n, a) => n + (((a.metadata as Record<string, unknown>)?.insertions as number) ?? 0), 0)
  const totalDel = commits.reduce((n, a) => n + (((a.metadata as Record<string, unknown>)?.deletions as number) ?? 0), 0)
  const stats = commits.length > 0 ? `  Totais do dia: ${commits.length} commit(s), +${totalIns}/-${totalDel} linhas\n` : ''

  return `=== GITHUB (${activities.length} atividade${activities.length !== 1 ? 's' : ''}) ===\n${stats}${lines.join('\n')}`
}

function buildSlackText(activities: SlackActivity[]): string {
  if (activities.length === 0) return ''
  const lines: string[] = []

  const calls = activities.filter((a) => a.type === 'CALL_SUMMARY')
  const circuits = activities.filter((a) => a.type === 'DISCUSSION_CIRCUIT')
  const msgs = activities.filter((a) => ['MESSAGE_SENT', 'THREAD_STARTED', 'THREAD_REPLY', 'MESSAGE_EDITED'].includes(a.type))
  const dms = activities.filter((a) => ['DM_SENT', 'DM_RECEIVED'].includes(a.type))

  for (const a of calls) {
    const m = a.metadata as Record<string, unknown> | undefined
    const dur = m?.durationMinutes as number | undefined
    const participants = (m?.participants as string[] | undefined)?.join(', ')
    const ch = a.channelName ?? a.channel
    const time = fmt(a.createdAt)
    const typeLabel = m?.callType === 'channel_huddle' ? 'Círculo em canal' : m?.callType === 'group_huddle' ? 'Círculo em grupo' : 'Círculo/Chamada'
    lines.push(`  [${time}] ${typeLabel} em ${ch}${participants ? ` com ${participants}` : ''}${dur ? ` — ${dur} min` : ''}`)
    const aiNotes = m?.aiNotes as string | undefined
    if (aiNotes && aiNotes.length > 80) lines.push(`    Anotações IA: "${aiNotes.slice(0, 200)}"`)
  }

  for (const a of circuits) {
    const m = a.metadata as Record<string, unknown> | undefined
    const dur = m?.durationMinutes as number | undefined
    const participants = (m?.participants as string[] | undefined)?.join(', ')
    const ch = a.channelName ?? a.channel
    const time = fmt(a.createdAt)
    const aiSummary = m?.aiSummary as string | undefined
    lines.push(`  [${time}] Circuito em ${ch}${participants ? ` com ${participants}` : ''}${dur ? ` — ${dur} min` : ''}`)
    if (aiSummary) lines.push(`    Resumo: "${aiSummary.slice(0, 200)}"`)
  }

  if (msgs.length > 0) {
    const byChannel = msgs.reduce<Record<string, number>>((acc, a) => {
      const ch = a.channelName ?? a.channel
      acc[ch] = (acc[ch] ?? 0) + 1
      return acc
    }, {})
    const channelSummary = Object.entries(byChannel).map(([ch, n]) => `${n} em ${ch}`).join(', ')
    lines.push(`  Mensagens em canais: ${channelSummary}`)
  }

  if (dms.length > 0) {
    const sent = dms.filter((a) => a.type === 'DM_SENT').length
    const recv = dms.filter((a) => a.type === 'DM_RECEIVED').length
    lines.push(`  DMs: ${sent} enviada(s), ${recv} recebida(s)`)
  }

  return `=== SLACK (${activities.length} atividade${activities.length !== 1 ? 's' : ''}) ===\n${lines.join('\n')}`
}

function buildGoogleText(activities: GoogleActivity[]): string {
  if (activities.length === 0) return ''
  const lines = activities.map((a) => {
    const m = a.metadata as Record<string, unknown> | undefined
    const time = fmt(a.createdAt)
    const dur = m?.durationMinutes as number | undefined

    if (a.type === 'CALENDAR_EVENT') {
      const attendees = (m?.attendees as string[] | undefined) ?? []
      const location = m?.location as string | undefined
      const description = (m?.description as string | undefined)?.slice(0, 100)
      const response = m?.userResponseStatus as string | undefined
      const responseLabel: Record<string, string> = { accepted: 'aceito', tentative: 'talvez', needsAction: 'sem resposta' }
      return [
        `  [${time}] ${a.title}${dur ? ` (${dur} min)` : ''}${attendees.length > 0 ? ` — com: ${attendees.slice(0, 5).join(', ')}` : ''}`,
        location ? `    Local: ${location}` : '',
        description ? `    Descrição: "${description}"` : '',
        response && responseLabel[response] ? `    Resposta: ${responseLabel[response]}` : '',
      ].filter(Boolean).join('\n')
    }

    const participants = (m?.participants as string[] | undefined) ?? []
    return `  [${time}] Google Meet${dur ? ` (${dur} min)` : ''}${participants.length > 0 ? ` — participantes: ${participants.slice(0, 5).join(', ')}` : ''}`
  })

  return `=== GOOGLE CALENDAR & MEET (${activities.length} evento${activities.length !== 1 ? 's' : ''}) ===\n${lines.join('\n')}`
}

/**
 * Generates a comprehensive first-person executive summary for a single day.
 * Uses human-readable text context instead of raw JSON.
 */
export async function generateDaySummary(
  apiKey: string,
  dayData: DayData,
  customInstructions?: string
): Promise<SummaryResult | undefined> {
  try {
    const sections: string[] = [`📅 Data: ${dayData.date}\n`]
    if (dayData.jira.length > 0) sections.push(buildJiraText(dayData.jira))
    if (dayData.github.length > 0) sections.push(buildGitHubText(dayData.github))
    if (dayData.slack.length > 0) sections.push(buildSlackText(dayData.slack))
    if ((dayData.google ?? []).length > 0) sections.push(buildGoogleText(dayData.google ?? []))

    const context = sections.join('\n\n')

    const systemPrompt = [
      'Você é um assistente técnico que escreve resumos executivos de atividades de desenvolvimento no estilo de uma folha de ponto narrativa.',
      'Escreva em primeira pessoa, em prosa corrida — NÃO use listas, NÃO separe por plataforma, NÃO use títulos ou seções.',
      'Narre o que foi feito no dia como se fosse um relato de ponto: o que foi trabalhado, quais tarefas foram movimentadas, quais PRs foram feitos, que reuniões ou chamadas aconteceram e o que foi tratado nelas.',
      'Quando houver conexão entre atividades de plataformas diferentes (ex: um commit relacionado a uma issue do Jira, uma reunião que resultou numa ação técnica), mencione essa relação de forma natural no texto.',
      'Seja direto e factual: sem adjetivos, sem frases de avaliação como "dia produtivo", sem horários específicos, sem introduções genéricas. Vá direto ao que foi feito.',
      'Escreva no mesmo idioma dos dados (português se os dados estiverem em português).',
      customInstructions ? `\nInstruções adicionais: ${customInstructions}` : '',
    ].filter(Boolean).join(' ')

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        max_tokens: 900,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Atividades do dia ${dayData.date}:\n\n${context}` },
        ],
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 45000,
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
