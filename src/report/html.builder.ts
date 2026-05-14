import { ReportOutput, DailyReport, JiraActivity, GitHubActivity, SlackActivity, GoogleActivity } from '../types/report.types'

const PLATFORM_COLORS = {
  jira: { bg: '#1e40af', text: '#93c5fd', border: '#3b82f6', badge: '#2563eb' },
  github: { bg: '#1f2937', text: '#d1d5db', border: '#6b7280', badge: '#374151' },
  slack: { bg: '#14532d', text: '#86efac', border: '#22c55e', badge: '#15803d' },
  google: { bg: '#1a3a2a', text: '#6ee7b7', border: '#10b981', badge: '#059669' },
  ai: { bg: '#4c1d95', text: '#c4b5fd', border: '#8b5cf6', badge: '#6d28d9' },
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    })
  } catch {
    return iso
  }
}

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-')
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${day} ${months[parseInt(month, 10) - 1]} ${year}`
  } catch {
    return dateStr
  }
}

function esc(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function jiraTypeLabel(type: string): string {
  const map: Record<string, string> = {
    STATUS_CHANGED: '🔄 Status alterado',
    ISSUE_RESOLVED: '✅ Issue resolvida',
    ISSUE_REOPENED: '🔁 Issue reaberta',
    ASSIGNEE_CHANGED: '👤 Responsável alterado',
    PRIORITY_CHANGED: '⚡ Prioridade alterada',
    SPRINT_CHANGED: '🏃 Sprint alterada',
    SPRINT_ADDED: '🏃 Adicionado à sprint',
    SPRINT_REMOVED: '🏃 Removido da sprint',
    EPIC_CHANGED: '🎯 Epic alterado',
    STORY_POINTS_CHANGED: '📊 Story points alterados',
    DUE_DATE_CHANGED: '📅 Due date alterada',
    DESCRIPTION_CHANGED: '📝 Descrição alterada',
    SUMMARY_CHANGED: '✏️ Título alterado',
    LABELS_CHANGED: '🏷️ Labels alteradas',
    COMPONENTS_CHANGED: '🧩 Componentes alterados',
    FIX_VERSION_CHANGED: '🚀 Fix version alterada',
    FLAGGED_CHANGED: '🚩 Flag alterada',
    ISSUE_LINK_CHANGED: '🔗 Link de issue alterado',
    ATTACHMENT_ADDED: '📎 Anexo adicionado',
    ATTACHMENT_REMOVED: '📎 Anexo removido',
    WATCHER_CHANGED: '👁️ Watcher alterado',
    RESOLUTION_CHANGED: '🔖 Resolução alterada',
    COMMENT_ADDED: '💬 Comentário adicionado',
    COMMENT_EDITED: '✏️ Comentário editado',
    WORKLOG_ADDED: '⏱️ Worklog registrado',
    FIELD_CHANGED: '🔧 Campo alterado',
  }
  return map[type] ?? `🔧 ${type}`
}

function githubTypeLabel(type: string): string {
  const map: Record<string, string> = {
    COMMIT: '📦 Commit',
    PUSH: '⬆️ Push',
    PR_OPENED: '🔀 PR aberto',
    PR_CLOSED: '❌ PR fechado',
    PR_MERGED: '✅ PR mergeado',
    PR_REOPENED: '🔁 PR reaberto',
    PR_DRAFT_CREATED: '📝 PR rascunho criado',
    PR_READY_FOR_REVIEW: '👁️ PR pronto para revisão',
    PR_APPROVED: '✅ PR aprovado',
    PR_CHANGES_REQUESTED: '🔄 Alterações solicitadas',
    PR_REVIEWED: '👀 PR revisado',
    PR_COMMENTED: '💬 Comentário em PR',
    REVIEW_COMMENT: '💬 Comentário de revisão',
    ISSUE_COMMENT: '💬 Comentário em issue/PR',
    REVIEW_REQUESTED: '🙋 Revisão solicitada',
    LABEL_ADDED: '🏷️ Label adicionada',
    LABEL_REMOVED: '🏷️ Label removida',
    ASSIGNEE_CHANGED: '👤 Responsável alterado',
    MILESTONE_CHANGED: '🎯 Milestone alterado',
    BRANCH_CREATED: '🌿 Branch criada',
    BRANCH_DELETED: '🗑️ Branch deletada',
    RELEASE_PUBLISHED: '🚀 Release publicada',
    FORCE_PUSH: '⚠️ Force push',
    ISSUE_OPENED: '🐛 Issue aberta',
    ISSUE_CLOSED: '✅ Issue fechada',
    ISSUE_REOPENED: '🔁 Issue reaberta',
    COMMIT_COMMENT: '💬 Comentário em commit',
  }
  return map[type] ?? `📌 ${type}`
}

function slackTypeLabel(type: string): string {
  const map: Record<string, string> = {
    MESSAGE_SENT: '💬 Mensagem enviada',
    THREAD_STARTED: '🧵 Thread iniciada',
    THREAD_REPLY: '↩️ Resposta em thread',
    MESSAGE_EDITED: '✏️ Mensagem editada',
    DM_SENT: '📩 DM enviada',
    DM_RECEIVED: '📨 DM recebida',
    REACTION_ADDED: '😄 Reação adicionada',
    REACTION_RECEIVED: '⭐ Reação recebida',
    DISCUSSION_CIRCUIT: '🔄 Circuito de discussão',
    CALL_SUMMARY: '📞 Chamada / Huddle',
  }
  return map[type] ?? `📣 ${type}`
}

function renderMetadata(meta: Record<string, unknown> | undefined): string {
  if (!meta) return ''

  const hasFrom = 'from' in meta
  const hasTo = 'to' in meta
  const from = meta.from as string | null | undefined
  const to = meta.to as string | null | undefined
  const comment = meta.comment as string | null | undefined
  const timeSpent = meta.timeSpent as string | null | undefined
  const field = meta.field as string | null | undefined

  const parts: string[] = []

  if (hasFrom || hasTo) {
    const fromHtml = hasFrom
      ? (from != null
          ? `<span class="meta-state meta-from">${esc(from)}</span>`
          : `<span class="meta-state meta-null">—</span>`)
      : ''
    const toHtml = hasTo
      ? (to != null
          ? `<span class="meta-state meta-to">${esc(to)}</span>`
          : `<span class="meta-state meta-null">(removido)</span>`)
      : `<span class="meta-state meta-null">(removido)</span>`

    if (fromHtml) {
      parts.push(`<div class="meta-transition">${fromHtml}<span class="meta-arrow">→</span>${toHtml}</div>`)
    } else {
      parts.push(`<div class="meta-transition">${toHtml}</div>`)
    }
  }

  if (comment) {
    parts.push(`<blockquote class="meta-comment-block">${esc(comment)}</blockquote>`)
  }

  if (timeSpent) {
    parts.push(`<span class="meta-tag"><b>⏱ Tempo:</b> ${esc(timeSpent)}</span>`)
  }

  if (field) {
    parts.push(`<span class="meta-tag"><b>Campo:</b> ${esc(field)}</span>`)
  }

  return parts.length > 0 ? `<div class="metadata">${parts.join('')}</div>` : ''
}

function renderJiraActivities(activities: JiraActivity[], jiraBaseUrl?: string): string {
  if (activities.length === 0) return '<p class="empty-state">Nenhuma atividade no Jira neste dia.</p>'
  return activities.map((a) => {
    const issueUrl = jiraBaseUrl ? `${jiraBaseUrl}/browse/${esc(a.issueKey)}` : null
    const issueKeyHtml = issueUrl
      ? `<a class="activity-key" href="${issueUrl}" target="_blank" rel="noopener">${esc(a.issueKey)}</a>`
      : `<span class="activity-key">${esc(a.issueKey)}</span>`
    return `
    <div class="activity-item activity-jira">
      <div class="activity-header">
        <span class="activity-type">${esc(jiraTypeLabel(a.type))}</span>
        ${issueKeyHtml}
        <span class="activity-time">${formatDateTime(a.createdAt)}</span>
      </div>
      ${a.issueSummary ? `<div class="activity-title">${esc(a.issueSummary)}</div>` : ''}
      ${renderMetadata(a.metadata)}
    </div>
  `
  }).join('')
}

function renderGitHubMeta(a: GitHubActivity): string {
  const m = a.metadata as Record<string, unknown> | undefined
  if (!m) return ''
  const parts: string[] = []

  if (a.type === 'COMMIT') {
    const ins = (m.insertions as number) ?? 0
    const del = (m.deletions as number) ?? 0
    const files = (m.filesChanged as number) ?? 0
    if (files > 0 || ins > 0 || del > 0) {
      parts.push(`<div class="gh-stats"><span class="gh-stat-files">📁 ${files} arquivo${files !== 1 ? 's' : ''}</span><span class="gh-stat-add">+${ins}</span><span class="gh-stat-del">−${del}</span></div>`)
    }
    const fileList = m.files as Array<{ filename: string; additions: number; deletions: number }> | undefined
    if (fileList && fileList.length > 0) {
      const rows = fileList.slice(0, 20).map(
        (f) => `<tr><td class="gh-file-name">${esc(f.filename)}</td><td class="gh-file-add">+${f.additions}</td><td class="gh-file-del">−${f.deletions}</td></tr>`
      ).join('')
      parts.push(`<table class="gh-file-table"><tbody>${rows}</tbody></table>`)
      if (fileList.length > 20) parts.push(`<span class="meta-tag">+${fileList.length - 20} arquivo(s) omitido(s)</span>`)
    }
  }

  const body = (m.body as string) || (m.comment as string)
  if (body) {
    parts.push(`<blockquote class="meta-comment-block">${esc(body)}</blockquote>`)
  }

  if (m.path) {
    parts.push(`<span class="meta-tag">📄 <code>${esc(m.path as string)}</code></span>`)
  }

  if (m.branch && a.type !== 'COMMIT') {
    parts.push(`<span class="meta-tag">🌿 ${esc(m.branch as string)}</span>`)
  }

  if (m.label) {
    parts.push(`<span class="meta-tag">🏷️ ${esc(m.label as string)}</span>`)
  }

  if (m.assignee) {
    const action = m.action === 'assigned' ? 'atribuído a' : 'removido de'
    parts.push(`<span class="meta-tag">👤 ${esc(action)} ${esc(m.assignee as string)}</span>`)
  }

  if (m.milestone) {
    const action = m.action === 'milestoned' ? 'adicionado a' : 'removido de'
    parts.push(`<span class="meta-tag">🎯 ${esc(action)} ${esc(m.milestone as string)}</span>`)
  }

  if (m.state && (a.type === 'PR_APPROVED' || a.type === 'PR_CHANGES_REQUESTED' || a.type === 'PR_REVIEWED')) {
    const stateLabel: Record<string, string> = {
      APPROVED: '✅ Aprovado',
      CHANGES_REQUESTED: '🔄 Alterações solicitadas',
      COMMENTED: '💬 Comentado',
      DISMISSED: '🚫 Dispensado',
    }
    parts.push(`<span class="meta-tag">${stateLabel[m.state as string] ?? esc(m.state as string)}</span>`)
  }

  if (m.tagName && a.type === 'RELEASE_PUBLISHED') {
    parts.push(`<span class="meta-tag">🏷️ ${esc(m.tagName as string)}${m.prerelease ? ' <em>(pre-release)</em>' : ''}</span>`)
  }

  return parts.length > 0 ? `<div class="metadata">${parts.join('')}</div>` : ''
}

function renderGitHubActivities(activities: GitHubActivity[]): string {
  if (activities.length === 0) return '<p class="empty-state">Nenhuma atividade no GitHub neste dia.</p>'

  const commits = activities.filter((a) => a.type === 'COMMIT')
  const totalIns = commits.reduce((n, a) => n + (((a.metadata as Record<string, unknown>)?.insertions as number) ?? 0), 0)
  const totalDel = commits.reduce((n, a) => n + (((a.metadata as Record<string, unknown>)?.deletions as number) ?? 0), 0)
  const totalFiles = new Set(
    commits.flatMap((a) => ((a.metadata as Record<string, unknown>)?.files as Array<{filename: string}> ?? []).map((f) => f.filename))
  ).size

  const statsBar = commits.length > 0
    ? `<div class="gh-day-stats">
        <span>📦 ${commits.length} commit${commits.length !== 1 ? 's' : ''}</span>
        <span>📁 ${totalFiles} arquivo${totalFiles !== 1 ? 's' : ''} alterado${totalFiles !== 1 ? 's' : ''}</span>
        <span class="gh-stat-add">+${totalIns} linhas</span>
        <span class="gh-stat-del">−${totalDel} linhas</span>
      </div>`
    : ''

  const items = activities.map((a) => `
    <div class="activity-item activity-github">
      <div class="activity-header">
        <span class="activity-type">${esc(githubTypeLabel(a.type))}</span>
        <span class="activity-key">${esc(a.repo)}</span>
        <span class="activity-time">${formatDateTime(a.createdAt)}</span>
      </div>
      ${a.title ? `<div class="activity-title">${a.url ? `<a href="${esc(a.url)}" target="_blank">${esc(a.title)}</a>` : esc(a.title)}</div>` : ''}
      ${renderGitHubMeta(a)}
    </div>
  `).join('')

  return statsBar + items
}

function renderSlackMeta(a: SlackActivity): string {
  const m = a.metadata as Record<string, unknown> | undefined
  if (!m) return ''
  const parts: string[] = []

  if (a.type === 'CALL_SUMMARY') {
    const dur = m.durationMinutes as number | undefined
    const participants = (m.participants as string[] | undefined) ?? []
    const title = m.title as string | undefined
    const summary = m.summary as string | undefined
    const callType = m.callType as string | undefined
    const chatMessages = m.chatMessages as Array<{ author: string; text: string; createdAt: string; isUser: boolean }> | undefined
    const aiNotes = m.aiNotes as string | undefined
    const aiNotesAvailable = m.aiNotesAvailable as boolean | undefined

    const callTypeLabel: Record<string, string> = {
      huddle: '🎙️ Círculo (DM)',
      channel_huddle: '🎙️ Círculo em canal',
      group_huddle: '🎙️ Círculo em grupo',
      call: '📹 Chamada',
      group_call: '📹 Chamada em grupo',
      ai_summary: '🤖 Resumo IA',
    }

    parts.push(`<div class="slack-circuit-card">`)
    if (title) parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">📞 Título</span><span>${esc(title)}</span></div>`)
    if (callType && callTypeLabel[callType]) parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">🔖 Tipo</span><span>${esc(callTypeLabel[callType])}</span></div>`)
    if (dur !== undefined) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">⏱ Duração</span><span>${dur < 1 ? '< 1 min' : `${dur} min`}</span></div>`)
    }
    if (participants.length > 0) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">👥 Participantes</span><span>${esc(participants.join(', '))}</span></div>`)
    }
    if (summary) {
      parts.push(`<div class="slack-circuit-row slack-circuit-preview"><span class="slack-circuit-label">📝 Resumo IA</span><blockquote class="meta-comment-block">${esc(summary)}</blockquote></div>`)
    }
    if (aiNotes && aiNotes.length > 80) {
      parts.push(`<div class="slack-circuit-row slack-circuit-preview"><span class="slack-circuit-label">🗒️ Anotações IA</span><blockquote class="meta-comment-block">${esc(aiNotes)}</blockquote></div>`)
    } else if (aiNotesAvailable || (aiNotes && aiNotes.length <= 80)) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">🗒️ Anotações IA</span><span class="meta-tag">✅ disponíveis no Slack (canvas)</span></div>`)
    }
    if (chatMessages && chatMessages.length > 0) {
      const rows = chatMessages.map((entry) => {
        const time = entry.createdAt.slice(11, 16)
        const cls = entry.isUser ? 'circuit-msg circuit-msg-user' : 'circuit-msg'
        return `<div class="${cls}"><span class="circuit-msg-author">${esc(entry.author)}</span><span class="circuit-msg-time">${time}</span><span class="circuit-msg-text">${esc(entry.text)}</span></div>`
      }).join('')
      parts.push(`<div class="slack-circuit-row slack-circuit-preview"><span class="slack-circuit-label">💬 Chat da chamada</span><div class="circuit-transcript">${rows}</div></div>`)
    }
    parts.push(`</div>`)
    return `<div class="metadata">${parts.join('')}</div>`
  }

  if (a.type === 'DISCUSSION_CIRCUIT') {
    const participants = (m.participants as string[] | undefined) ?? []
    const dur = m.durationMinutes as number | undefined
    const msgCount = m.messageCount as number | undefined
    const userCount = m.userMessageCount as number | undefined
    const aiSummary = m.aiSummary as string | undefined
    const chatMessages = (m.chatMessages ?? m.transcript) as Array<{ author: string; text: string; createdAt: string; isUser: boolean }> | undefined

    parts.push(`<div class="slack-circuit-card">`)
    if (dur !== undefined) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">⏱ Duração</span><span>${dur < 1 ? '< 1 min' : `${dur} min`}</span></div>`)
    }
    if (msgCount !== undefined) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">💬 Mensagens</span><span>${msgCount}${userCount !== undefined ? ` (${userCount} suas)` : ''}</span></div>`)
    }
    if (participants.length > 0) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">👥 Participantes</span><span>${esc(participants.join(', '))}</span></div>`)
    }
    if (aiSummary) {
      parts.push(`<div class="slack-circuit-row slack-circuit-preview"><span class="slack-circuit-label">🤖 Resumo IA</span><blockquote class="meta-comment-block">${esc(aiSummary)}</blockquote></div>`)
    }
    if (chatMessages && chatMessages.length > 0) {
      const rows = chatMessages.map((entry) => {
        const time = entry.createdAt.slice(11, 16)
        const cls = entry.isUser ? 'circuit-msg circuit-msg-user' : 'circuit-msg'
        return `<div class="${cls}"><span class="circuit-msg-author">${esc(entry.author)}</span><span class="circuit-msg-time">${time}</span><span class="circuit-msg-text">${esc(entry.text)}</span></div>`
      }).join('')
      parts.push(`<div class="slack-circuit-row slack-circuit-preview"><span class="slack-circuit-label">💬 Chat da chamada</span><div class="circuit-transcript">${rows}</div></div>`)
    }
    parts.push(`</div>`)
    return `<div class="metadata">${parts.join('')}</div>`
  }

  const text = (m.text as string | undefined) || (m.comment as string | undefined)
  if (text) {
    parts.push(`<blockquote class="meta-comment-block">${esc(text)}</blockquote>`)
  }

  if (m.reaction) {
    parts.push(`<span class="meta-tag">:${esc(m.reaction as string)}: ${m.count !== undefined ? `×${m.count}` : ''}</span>`)
  }

  if (m.reactors && Array.isArray(m.reactors) && m.reactors.length > 0) {
    parts.push(`<span class="meta-tag">👤 ${esc((m.reactors as string[]).join(', '))}</span>`)
  }

  if (m.to) {
    parts.push(`<span class="meta-tag">→ ${esc(m.to as string)}</span>`)
  }

  if (m.from && a.type === 'DM_RECEIVED') {
    parts.push(`<span class="meta-tag">← de ${esc(m.from as string)}</span>`)
  }

  if (m.threadTs) {
    parts.push(`<span class="meta-tag">🧵 thread</span>`)
  }

  if (m.editedAt) {
    parts.push(`<span class="meta-tag">✏️ editado ${esc(String(m.editedAt).slice(0, 16).replace('T', ' '))}</span>`)
  }

  return parts.length > 0 ? `<div class="metadata">${parts.join('')}</div>` : ''
}

function renderSlackActivities(activities: SlackActivity[]): string {
  if (activities.length === 0) return '<p class="empty-state">Nenhuma atividade no Slack neste dia.</p>'

  const circuits = activities.filter((a) => a.type === 'DISCUSSION_CIRCUIT')
  const msgs = activities.filter((a) => a.type !== 'DISCUSSION_CIRCUIT')

  const callCount = activities.filter((a) => a.type === 'CALL_SUMMARY').length
  const channelMsgCount = activities.filter((a) => ['MESSAGE_SENT', 'THREAD_STARTED', 'THREAD_REPLY', 'MESSAGE_EDITED'].includes(a.type)).length
  const dmSentCount = activities.filter((a) => a.type === 'DM_SENT').length
  const dmRecvCount = activities.filter((a) => a.type === 'DM_RECEIVED').length
  const statsBar = activities.length > 0
    ? `<div class="gh-day-stats">
        ${channelMsgCount > 0 ? `<span>💬 ${channelMsgCount} msg(s) em canal</span>` : ''}
        ${dmSentCount > 0 || dmRecvCount > 0 ? `<span>📩 DMs: ${dmSentCount} enviada(s) / ${dmRecvCount} recebida(s)</span>` : ''}
        ${circuits.length > 0 ? `<span>🔄 ${circuits.length} circuito(s)</span>` : ''}
        ${callCount > 0 ? `<span>📞 ${callCount} chamada(s)</span>` : ''}
        <span>😄 ${activities.filter((a) => a.type === 'REACTION_ADDED').length} reação(ões) dada(s)</span>
        <span>⭐ ${activities.filter((a) => a.type === 'REACTION_RECEIVED').length} reação(ões) recebida(s)</span>
      </div>`
    : ''

  const items = activities.map((a) => `
    <div class="activity-item activity-slack">
      <div class="activity-header">
        <span class="activity-type">${esc(slackTypeLabel(a.type))}</span>
        <span class="activity-key">${esc(a.channelName ?? a.channel)}</span>
        <span class="activity-time">${formatDateTime(a.createdAt)}</span>
      </div>
      ${renderSlackMeta(a)}
    </div>
  `).join('')

  return statsBar + items
}

function googleTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CALENDAR_EVENT: '📅 Evento',
    MEET_CALL: '📹 Google Meet',
  }
  return map[type] ?? `🔗 ${type}`
}

function renderGoogleMeta(a: GoogleActivity): string {
  const m = a.metadata as Record<string, unknown> | undefined
  if (!m) return ''
  const parts: string[] = []

  if (a.type === 'CALENDAR_EVENT') {
    const dur = m.durationMinutes as number | undefined
    const attendees = (m.attendees as string[] | undefined) ?? []
    const description = m.description as string | undefined
    const location = m.location as string | undefined
    const meetLink = m.meetLink as string | undefined
    const htmlLink = m.htmlLink as string | undefined
    const start = m.start as string | undefined
    const end = m.end as string | undefined
    const userResponseStatus = m.userResponseStatus as string | undefined

    const responseLabel: Record<string, string> = {
      accepted: '✅ Aceito',
      tentative: '❓ Talvez',
      needsAction: '⏳ Aguardando resposta',
    }

    parts.push(`<div class="slack-circuit-card">`)
    if (userResponseStatus && responseLabel[userResponseStatus]) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">📋 Sua resposta</span><span class="meta-tag">${esc(responseLabel[userResponseStatus])}</span></div>`)
    }
    if (start && end) {
      const startFmt = new Date(start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
      const endFmt = new Date(end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">🕐 Horário</span><span>${esc(startFmt)} – ${esc(endFmt)}</span></div>`)
    }
    if (dur !== undefined) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">⏱ Duração</span><span>${dur < 1 ? '< 1 min' : `${dur} min`}</span></div>`)
    }
    if (attendees.length > 0) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">👥 Participantes</span><span>${esc(attendees.join(', '))}</span></div>`)
    }
    if (location) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">📍 Local</span><span>${esc(location)}</span></div>`)
    }
    if (description) {
      parts.push(`<div class="slack-circuit-row slack-circuit-preview"><span class="slack-circuit-label">📝 Descrição</span><blockquote class="meta-comment-block">${esc(description)}</blockquote></div>`)
    }
    if (meetLink) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">🎥 Meet</span><span><a href="${esc(meetLink)}" target="_blank" rel="noopener">${esc(meetLink)}</a></span></div>`)
    }
    if (htmlLink) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">🔗 Link</span><span><a href="${esc(htmlLink)}" target="_blank" rel="noopener">Abrir no Google Calendar</a></span></div>`)
    }
    parts.push(`</div>`)
    return `<div class="metadata">${parts.join('')}</div>`
  }

  if (a.type === 'MEET_CALL') {
    const dur = m.durationMinutes as number | undefined
    const participants = (m.participants as string[] | undefined) ?? []
    const meetingUri = m.meetingUri as string | undefined
    const transcript = m.transcript as Array<{ participantName: string; text: string; startTime: string }> | undefined

    parts.push(`<div class="slack-circuit-card">`)
    if (dur !== undefined) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">⏱ Duração</span><span>${dur < 1 ? '< 1 min' : `${dur} min`}</span></div>`)
    }
    if (participants.length > 0) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">👥 Participantes</span><span>${esc(participants.join(', '))}</span></div>`)
    }
    if (meetingUri) {
      parts.push(`<div class="slack-circuit-row"><span class="slack-circuit-label">🔗 Link</span><span><a href="${esc(meetingUri)}" target="_blank" rel="noopener">${esc(meetingUri)}</a></span></div>`)
    }
    if (transcript && transcript.length > 0) {
      const rows = transcript.slice(0, 30).map((e) => {
        const time = e.startTime ? new Date(e.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : ''
        return `<div class="circuit-msg"><span class="circuit-msg-author">${esc(e.participantName)}</span><span class="circuit-msg-time">${time}</span><span class="circuit-msg-text">${esc(e.text)}</span></div>`
      }).join('')
      const moreCount = transcript.length > 30 ? transcript.length - 30 : 0
      parts.push(`<div class="slack-circuit-row slack-circuit-preview"><span class="slack-circuit-label">📝 Transcrição</span><div class="circuit-transcript">${rows}${moreCount > 0 ? `<div class="circuit-msg"><span class="circuit-msg-text meta-tag">+${moreCount} entrada(s) omitida(s)</span></div>` : ''}</div></div>`)
    }
    parts.push(`</div>`)
    return `<div class="metadata">${parts.join('')}</div>`
  }

  return ''
}

function renderGoogleActivities(activities: GoogleActivity[]): string {
  if (activities.length === 0) return '<p class="empty-state">Nenhuma atividade do Google neste dia.</p>'

  const calEvents = activities.filter((a) => a.type === 'CALENDAR_EVENT')
  const meetCalls = activities.filter((a) => a.type === 'MEET_CALL')

  const statsBar = `<div class="gh-day-stats">
    ${calEvents.length > 0 ? `<span>📅 ${calEvents.length} evento${calEvents.length !== 1 ? 's' : ''} no Calendar</span>` : ''}
    ${meetCalls.length > 0 ? `<span>📹 ${meetCalls.length} chamada${meetCalls.length !== 1 ? 's' : ''} no Meet</span>` : ''}
  </div>`

  const items = activities.map((a) => `
    <div class="activity-item activity-google">
      <div class="activity-header">
        <span class="activity-type">${esc(googleTypeLabel(a.type))}</span>
        <span class="activity-key">${esc(a.title)}</span>
        <span class="activity-time">${formatDateTime(a.createdAt)}</span>
      </div>
      ${renderGoogleMeta(a)}
    </div>
  `).join('')

  return statsBar + items
}

function renderDaySection(day: DailyReport, index: number, jiraBaseUrl?: string): string {
  const hasJira = day.jira.length > 0
  const hasGitHub = day.github.length > 0
  const hasSlack = day.slack.length > 0
  const hasGoogle = (day.google ?? []).length > 0
  const total = day.jira.length + day.github.length + day.slack.length + (day.google ?? []).length

  const firstActive = hasJira ? 'jira' : hasGitHub ? 'github' : hasSlack ? 'slack' : 'google'

  const tabs = [
    hasJira ? `<button class="tab-btn ${firstActive === 'jira' ? 'active' : ''}" data-tab="jira-${index}" onclick="switchTab(this, 'jira-${index}')">🔵 Jira <span class="tab-count">${day.jira.length}</span></button>` : '',
    hasGitHub ? `<button class="tab-btn ${firstActive === 'github' ? 'active' : ''}" data-tab="github-${index}" onclick="switchTab(this, 'github-${index}')">⚫ GitHub <span class="tab-count">${day.github.length}</span></button>` : '',
    hasSlack ? `<button class="tab-btn ${firstActive === 'slack' ? 'active' : ''}" data-tab="slack-${index}" onclick="switchTab(this, 'slack-${index}')">🟢 Slack <span class="tab-count">${day.slack.length}</span></button>` : '',
    hasGoogle ? `<button class="tab-btn ${firstActive === 'google' ? 'active' : ''}" data-tab="google-${index}" onclick="switchTab(this, 'google-${index}')">🗓️ Google <span class="tab-count">${(day.google ?? []).length}</span></button>` : '',
  ].filter(Boolean).join('')

  return `
    <section class="day-section" id="day-${index}" data-date="${day.date}">
      <div class="day-header" onclick="toggleDay(${index})" role="button" aria-expanded="true">
        <div class="day-header-left">
          <span class="day-chevron" id="chevron-${index}">▼</span>
          <h2 class="day-title">📅 ${formatDate(day.date)}</h2>
        </div>
        <span class="day-activity-count">${total} atividade${total !== 1 ? 's' : ''}</span>
      </div>

      <div class="day-content" id="day-content-${index}">
        ${total === 0 ? '<p class="empty-state day-empty">Nenhuma atividade registrada neste dia.</p>' : `
          <div class="tab-bar">${tabs}</div>

          ${hasJira ? `
            <div class="tab-panel ${firstActive === 'jira' ? 'active' : ''}" id="jira-${index}">
              <div class="activities-list">
                ${renderJiraActivities(day.jira, jiraBaseUrl)}
              </div>
            </div>
          ` : ''}

          ${hasGitHub ? `
            <div class="tab-panel ${firstActive === 'github' ? 'active' : ''}" id="github-${index}">
              <div class="activities-list">
                ${renderGitHubActivities(day.github)}
              </div>
            </div>
          ` : ''}

          ${hasSlack ? `
            <div class="tab-panel ${firstActive === 'slack' ? 'active' : ''}" id="slack-${index}">
              <div class="activities-list">
                ${renderSlackActivities(day.slack)}
              </div>
            </div>
          ` : ''}

          ${hasGoogle ? `
            <div class="tab-panel ${firstActive === 'google' ? 'active' : ''}" id="google-${index}">
              <div class="activities-list">
                ${renderGoogleActivities(day.google ?? [])}
              </div>
            </div>
          ` : ''}
        `}

        ${day.aiSummary ? `
          <div class="ai-summary-card" data-summary="${esc(day.aiSummary)}">
            <div class="ai-summary-header">
              <span>🤖 Resumo executivo do dia</span>
              <button class="copy-summary-btn" onclick="event.stopPropagation();copySummary(this)" title="Copiar resumo">📋 Copiar</button>
            </div>
            <p class="ai-summary-text">${esc(day.aiSummary)}</p>
          </div>
        ` : ''}
      </div>
    </section>
  `
}

/**
 * Builds a self-contained, responsive HTML report from a ReportOutput.
 * All CSS and JS are inlined — no external dependencies.
 */
export function buildHtmlReport(output: ReportOutput): string {
  const { jobId, period, generatedAt, days, jiraBaseUrl } = output

  const dayNavItems = days
    .map((d, i) => {
      const total = d.jira.length + d.github.length + d.slack.length + (d.google ?? []).length
      return `<button class="day-pill" data-date="${d.date}" onclick="scrollToDay(${i})">${formatDate(d.date)}<span class="pill-count">${total}</span></button>`
    })
    .join('')

  const daySections = days.map((d, i) => renderDaySection(d, i, jiraBaseUrl)).join('')

  const generatedAtFormatted = new Date(generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatório Diário — ${period.startDate} a ${period.endDate}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0f172a;
      --surface: #1e293b;
      --surface2: #263349;
      --border: #334155;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --jira: #3b82f6;
      --github: #9ca3af;
      --slack: #22c55e;
      --google: #10b981;
      --ai: #8b5cf6;
      --radius: 12px;
    }

    html { scroll-behavior: smooth; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      min-height: 100vh;
    }

    a { color: var(--jira); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ── NAV ── */
    .top-nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
      padding: 0 1rem;
    }
    .nav-inner {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 0;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .nav-inner::-webkit-scrollbar { display: none; }
    .nav-logo {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-muted);
      white-space: nowrap;
      flex-shrink: 0;
      padding-right: 0.5rem;
      border-right: 1px solid var(--border);
    }
    .day-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.3rem 0.7rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      flex-shrink: 0;
    }
    .day-pill:hover { background: var(--surface2); border-color: var(--jira); }
    .day-pill.active-pill { background: rgba(59,130,246,0.15); border-color: var(--jira); color: #93c5fd; }
    .pill-count {
      background: var(--border);
      border-radius: 999px;
      padding: 0.1rem 0.4rem;
      font-size: 0.65rem;
    }

    /* ── MAIN ── */
    .main {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1rem 4rem;
    }

    /* ── REPORT HEADER ── */
    .report-header {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: var(--surface);
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }
    .report-title {
      font-size: 1.4rem;
      font-weight: 700;
      background: linear-gradient(135deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.5rem;
    }
    .report-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.5rem;
      font-size: 0.78rem;
      color: var(--text-muted);
    }
    .report-meta span { display: flex; align-items: center; gap: 0.3rem; }

    /* ── DAY SECTION ── */
    .day-section {
      margin-bottom: 2rem;
    }
    .day-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid var(--border);
      cursor: pointer;
      user-select: none;
    }
    .day-header:hover .day-title { color: #93c5fd; }
    .day-header-left { display: flex; align-items: center; gap: 0.5rem; }
    .day-chevron {
      font-size: 0.7rem;
      color: var(--text-muted);
      transition: transform 0.2s;
      width: 1rem;
      text-align: center;
      flex-shrink: 0;
    }
    .day-content.collapsed { display: none; }
    .day-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text);
      transition: color 0.15s;
    }
    .day-activity-count {
      font-size: 0.75rem;
      color: var(--text-muted);
      background: var(--surface);
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      border: 1px solid var(--border);
    }

    /* ── TABS ── */
    .tab-bar {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.9rem;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tab-btn:hover { border-color: #64748b; color: var(--text); }
    .tab-btn.active { background: var(--surface2); border-color: var(--jira); color: var(--text); }
    .tab-count {
      background: var(--border);
      border-radius: 999px;
      padding: 0.05rem 0.4rem;
      font-size: 0.65rem;
    }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    /* ── ACTIVITIES ── */
    .activities-list { display: flex; flex-direction: column; gap: 0.6rem; }

    .activity-item {
      padding: 0.75rem 1rem;
      border-radius: var(--radius);
      border-left: 3px solid transparent;
      background: var(--surface);
      border: 1px solid var(--border);
      transition: background 0.1s;
    }
    .activity-item:hover { background: var(--surface2); }
    .activity-jira { border-left-color: var(--jira); }
    .activity-github { border-left-color: var(--github); }
    .activity-slack { border-left-color: var(--slack); }
    .activity-google { border-left-color: var(--google); }

    .activity-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem 0.75rem;
      margin-bottom: 0.25rem;
    }
    .activity-type { font-size: 0.82rem; font-weight: 600; color: var(--text); }
    .activity-key {
      font-size: 0.72rem;
      font-weight: 600;
      font-family: 'SFMono-Regular', Consolas, monospace;
      color: var(--text-muted);
      background: var(--surface2);
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      border: 1px solid var(--border);
      text-decoration: none;
    }
    a.activity-key:hover {
      color: var(--jira);
      border-color: var(--jira);
      text-decoration: none;
    }
    .activity-time { font-size: 0.72rem; color: var(--text-muted); margin-left: auto; }

    .activity-title {
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }

    .metadata {
      margin-top: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    /* ── from → to transition ── */
    .meta-transition {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: wrap;
    }
    .meta-state {
      font-size: 0.72rem;
      font-weight: 500;
      padding: 0.15rem 0.55rem;
      border-radius: 4px;
      white-space: nowrap;
    }
    .meta-from {
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.25);
      text-decoration: line-through;
      text-decoration-color: rgba(239, 68, 68, 0.5);
    }
    .meta-to {
      color: #86efac;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.25);
    }
    .meta-null {
      color: var(--text-muted);
      font-style: italic;
      border: 1px solid transparent;
    }
    .meta-arrow {
      color: var(--text-muted);
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    /* ── comment block ── */
    .meta-comment-block {
      margin: 0;
      padding: 0.45rem 0.75rem;
      border-left: 2px solid var(--border);
      border-radius: 0 6px 6px 0;
      background: rgba(255,255,255,0.03);
      font-size: 0.78rem;
      color: var(--text);
      font-style: italic;
      word-break: break-word;
      white-space: pre-wrap;
      line-height: 1.6;
    }

    /* ── other meta tags ── */
    .meta-tag {
      display: inline-flex;
      font-size: 0.72rem;
      color: var(--text-muted);
      background: var(--surface2);
      border: 1px solid var(--border);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      align-self: flex-start;
    }

    /* ── GITHUB STATS ── */
    .gh-day-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      font-size: 0.78rem;
      color: var(--text-muted);
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.75rem;
    }
    .gh-stats {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      font-size: 0.75rem;
      margin-top: 0.3rem;
    }
    .gh-stat-files { color: var(--text-muted); }
    .gh-stat-add { color: #4ade80; font-weight: 600; }
    .gh-stat-del { color: #f87171; font-weight: 600; }
    .gh-file-table {
      margin-top: 0.4rem;
      width: 100%;
      border-collapse: collapse;
      font-size: 0.72rem;
    }
    .gh-file-table td {
      padding: 0.15rem 0.4rem;
      border-bottom: 1px solid var(--border);
    }
    .gh-file-name {
      color: var(--text);
      font-family: monospace;
      word-break: break-all;
    }
    .gh-file-add { color: #4ade80; text-align: right; white-space: nowrap; }
    .gh-file-del { color: #f87171; text-align: right; white-space: nowrap; }

    /* ── SLACK DISCUSSION CIRCUIT ── */
    .slack-circuit-card {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding: 0.6rem 0.85rem;
      background: rgba(16, 185, 129, 0.07);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 8px;
      font-size: 0.78rem;
    }
    .slack-circuit-row {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
    }
    .slack-circuit-label {
      color: var(--text-muted);
      min-width: 100px;
      flex-shrink: 0;
      font-size: 0.72rem;
    }
    .slack-circuit-preview {
      flex-direction: column;
      gap: 0.25rem;
    }
    .slack-circuit-preview .slack-circuit-label {
      min-width: unset;
    }
    .circuit-transcript {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 280px;
      overflow-y: auto;
      background: rgba(0,0,0,0.03);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 8px;
      margin-top: 4px;
    }
    .circuit-msg {
      display: grid;
      grid-template-columns: 110px 46px 1fr;
      gap: 6px;
      font-size: 0.75rem;
      padding: 2px 0;
      border-bottom: 1px solid var(--border);
    }
    .circuit-msg:last-child { border-bottom: none; }
    .circuit-msg-user { background: rgba(99,102,241,0.07); border-radius: 4px; }
    .circuit-msg-author { font-weight: 600; color: var(--accent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .circuit-msg-time { color: var(--text-muted); font-variant-numeric: tabular-nums; }
    .circuit-msg-text { word-break: break-word; color: var(--text); }

    /* ── AI SUMMARY ── */
    .copy-summary-btn {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: var(--text-muted);
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.78rem;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    .copy-summary-btn:hover { background: rgba(255,255,255,0.12); color: var(--text); }
    .copy-summary-btn.copied { color: #4ade80; border-color: rgba(74,222,128,0.3); }
    .ai-summary-card {
      margin-top: 1rem;
      padding: 1rem 1.25rem;
      border-radius: var(--radius);
      background: rgba(139, 92, 246, 0.1);
      border: 1px solid rgba(139, 92, 246, 0.3);
    }
    .ai-summary-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.82rem;
      font-weight: 700;
      color: #a78bfa;
      margin-bottom: 0.5rem;
    }
    .ai-summary-text {
      font-size: 0.88rem;
      color: var(--text);
      line-height: 1.7;
      white-space: pre-wrap;
    }

    /* ── EMPTY STATES ── */
    .empty-state {
      font-size: 0.82rem;
      color: var(--text-muted);
      text-align: center;
      padding: 2rem;
      background: var(--surface);
      border-radius: var(--radius);
      border: 1px dashed var(--border);
    }
    .day-empty { margin-top: 0.5rem; }

    /* ── FOOTER ── */
    .footer {
      text-align: center;
      font-size: 0.72rem;
      color: var(--text-muted);
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }

    /* ── RESPONSIVE ── */
    @media (max-width: 600px) {
      .report-title { font-size: 1.15rem; }
      .activity-time { margin-left: 0; }
      .tab-btn { padding: 0.35rem 0.7rem; font-size: 0.75rem; }
    }
  </style>
</head>
<body>

<nav class="top-nav">
  <div class="nav-inner">
    <span class="nav-logo">📊 Daily Reports</span>
    ${dayNavItems}
  </div>
</nav>

<main class="main">
  <div class="report-header">
    <h1 class="report-title">Relatório de Atividades</h1>
    <div class="report-meta">
      <span>📅 Período: <b>${period.startDate} → ${period.endDate}</b></span>
      <span>🕐 Gerado em: <b>${generatedAtFormatted}</b></span>
      <span>🔑 Job: <code>${jobId}</code></span>
      <span>📆 ${days.length} dia${days.length !== 1 ? 's' : ''}</span>
    </div>
  </div>

  ${daySections}

  <footer class="footer">
    Relatório gerado automaticamente · Job ID: ${jobId}
  </footer>
</main>

<script>
  function switchTab(btn, panelId) {
    var section = btn.closest('.day-section');
    section.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    section.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
    btn.classList.add('active');
    var panel = document.getElementById(panelId);
    if (panel) panel.classList.add('active');
  }

  function scrollToDay(index) {
    var el = document.getElementById('day-' + index);
    if (el) {
      var offset = 70;
      var top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
  }

  function toggleDay(index) {
    var content = document.getElementById('day-content-' + index);
    var chevron = document.getElementById('chevron-' + index);
    if (!content) return;
    var collapsed = content.classList.toggle('collapsed');
    if (chevron) chevron.textContent = collapsed ? '▶' : '▼';
    var section = document.getElementById('day-' + index);
    if (section) section.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  function copySummary(btn) {
    var card = btn.closest('.ai-summary-card');
    var text = card ? (card.getAttribute('data-summary') || '') : '';
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = '✅ Copiado';
      btn.classList.add('copied');
      setTimeout(function() {
        btn.textContent = '📋 Copiar';
        btn.classList.remove('copied');
      }, 2200);
    }).catch(function() {
      btn.textContent = '❌';
      setTimeout(function() { btn.textContent = '📋 Copiar'; }, 1500);
    });
  }

  (function() {
    var pills = document.querySelectorAll('.day-pill');
    var sections = document.querySelectorAll('.day-section');
    if (!sections.length || !pills.length) return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var date = entry.target.getAttribute('data-date');
          pills.forEach(function(p) { p.classList.remove('active-pill'); });
          var match = document.querySelector('.day-pill[data-date="' + date + '"]');
          if (match) match.classList.add('active-pill');
        }
      });
    }, { threshold: 0.15, rootMargin: '-80px 0px -55% 0px' });

    sections.forEach(function(s) { observer.observe(s); });
  })();
</script>
</body>
</html>`
}

/**
 * Generates raw JSON attachment objects for each platform that has data.
 */
export function buildJsonAttachments(
  output: ReportOutput
): Array<{ filename: string; content: string }> {
  const attachments: Array<{ filename: string; content: string }> = []

  const jiraByDay: Record<string, JiraActivity[]> = {}
  const githubByDay: Record<string, GitHubActivity[]> = {}
  const slackByDay: Record<string, SlackActivity[]> = {}
  const googleByDay: Record<string, GoogleActivity[]> = {}

  let hasJira = false
  let hasGitHub = false
  let hasSlack = false
  let hasGoogle = false

  for (const day of output.days) {
    if (day.jira.length > 0) { jiraByDay[day.date] = day.jira; hasJira = true }
    if (day.github.length > 0) { githubByDay[day.date] = day.github; hasGitHub = true }
    if (day.slack.length > 0) { slackByDay[day.date] = day.slack; hasSlack = true }
    if ((day.google ?? []).length > 0) { googleByDay[day.date] = day.google; hasGoogle = true }
  }

  if (hasJira) {
    attachments.push({
      filename: `jira-${output.period.startDate}-${output.period.endDate}.json`,
      content: JSON.stringify(jiraByDay, null, 2),
    })
  }

  if (hasGitHub) {
    attachments.push({
      filename: `github-${output.period.startDate}-${output.period.endDate}.json`,
      content: JSON.stringify(githubByDay, null, 2),
    })
  }

  if (hasSlack) {
    attachments.push({
      filename: `slack-${output.period.startDate}-${output.period.endDate}.json`,
      content: JSON.stringify(slackByDay, null, 2),
    })
  }

  if (hasGoogle) {
    attachments.push({
      filename: `google-${output.period.startDate}-${output.period.endDate}.json`,
      content: JSON.stringify(googleByDay, null, 2),
    })
  }

  return attachments
}
