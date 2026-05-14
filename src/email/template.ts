export interface ReportPayload {
  jobId: string
  queuedAt: string
  reportEmail: string
  period: {
    startDate: string | null
    endDate: string | null
  }
  integrations: {
    jira?: {
      credentials: { baseUrl: string; email: string; apiToken: string }
      projectIds: string[]
    }
    github?: {
      token: string
      orgLogins: string[]
      repoFullNames: string[]
    }
    slack?: {
      token: string
      channelIds: string[]
      includeDirectMessages: boolean
    }
    openai?: {
      apiKey: string
    }
  }
}

/**
 * Builds the markdown content for the daily report email attachment.
 * Sensitive credentials are intentionally excluded from the template.
 */
export function buildReportMarkdown(payload: ReportPayload): string {
  const { jobId, queuedAt, period, integrations } = payload

  const generatedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const queuedAtFormatted = new Date(queuedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const lines: string[] = []

  lines.push(`# Relatório Diário`)
  lines.push(``)
  lines.push(`> Gerado em: **${generatedAt}** | Enfileirado em: ${queuedAtFormatted}`)
  lines.push(`> Job ID: \`${jobId}\``)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  lines.push(`## 📅 Período analisado`)
  lines.push(``)
  lines.push(`| Campo | Valor |`)
  lines.push(`|---|---|`)
  lines.push(`| Início | ${period.startDate ?? '—'} |`)
  lines.push(`| Fim    | ${period.endDate ?? '—'} |`)
  lines.push(``)

  if (integrations.jira) {
    lines.push(`---`)
    lines.push(``)
    lines.push(`## 🔵 Jira`)
    lines.push(``)
    lines.push(`**Workspace:** ${integrations.jira.credentials.baseUrl}`)
    lines.push(``)
    if (integrations.jira.projectIds.length > 0) {
      lines.push(`**Projetos analisados:**`)
      lines.push(``)
      integrations.jira.projectIds.forEach((id) => lines.push(`- ${id}`))
    } else {
      lines.push(`_Nenhum projeto selecionado._`)
    }
    lines.push(``)
    lines.push(`> ℹ️ _Os dados do Jira serão preenchidos aqui pelo processador do relatório._`)
    lines.push(``)
  }

  if (integrations.github) {
    lines.push(`---`)
    lines.push(``)
    lines.push(`## ⚫ GitHub`)
    lines.push(``)
    if (integrations.github.orgLogins.length > 0) {
      lines.push(`**Organizações:**`)
      lines.push(``)
      integrations.github.orgLogins.forEach((org) => lines.push(`- ${org}`))
      lines.push(``)
    }
    if (integrations.github.repoFullNames.length > 0) {
      lines.push(`**Repositórios analisados:**`)
      lines.push(``)
      integrations.github.repoFullNames.forEach((repo) => lines.push(`- \`${repo}\``))
    } else {
      lines.push(`_Todos os repositórios acessíveis._`)
    }
    lines.push(``)
    lines.push(`> ℹ️ _Os dados do GitHub serão preenchidos aqui pelo processador do relatório._`)
    lines.push(``)
  }

  if (integrations.slack) {
    lines.push(`---`)
    lines.push(``)
    lines.push(`## 🟢 Slack`)
    lines.push(``)
    if (integrations.slack.channelIds.length > 0) {
      lines.push(`**Canais analisados:**`)
      lines.push(``)
      integrations.slack.channelIds.forEach((id) => lines.push(`- \`${id}\``))
      lines.push(``)
    }
    lines.push(`**Chats 1:1:** ${integrations.slack.includeDirectMessages ? 'Sim' : 'Não'}`)
    lines.push(``)
    lines.push(`> ℹ️ _Os dados do Slack serão preenchidos aqui pelo processador do relatório._`)
    lines.push(``)
  }

  if (integrations.openai) {
    lines.push(`---`)
    lines.push(``)
    lines.push(`## 🤖 OpenAI`)
    lines.push(``)
    lines.push(`_Análise gerada por inteligência artificial com base nos dados coletados acima._`)
    lines.push(``)
    lines.push(`> ℹ️ _O resumo gerado pela IA será inserido aqui pelo processador do relatório._`)
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(``)
  lines.push(`*Relatório gerado automaticamente pelo [Daily Reports](https://github.com)*`)

  return lines.join('\n')
}
