import { ReportOutput, DailyReport, JiraActivity, GitHubActivity, SlackActivity } from '../types/report.types'

const PLATFORM_COLORS = {
  jira: { bg: '#1e40af', text: '#93c5fd', border: '#3b82f6', badge: '#2563eb' },
  github: { bg: '#1f2937', text: '#d1d5db', border: '#6b7280', badge: '#374151' },
  slack: { bg: '#14532d', text: '#86efac', border: '#22c55e', badge: '#15803d' },
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
    PR_OPENED: '🔀 PR aberto',
    PR_MERGED: '✅ PR mergeado',
    PR_REVIEWED: '👀 PR revisado',
    PR_COMMENTED: '💬 Comentário em PR',
    PR_CLOSED: '❌ PR fechado',
    ISSUE_OPENED: '🐛 Issue aberta',
    ISSUE_CLOSED: '✅ Issue fechada',
  }
  return map[type] ?? `📌 ${type}`
}

function slackTypeLabel(type: string): string {
  const map: Record<string, string> = {
    MESSAGE_SENT: '💬 Mensagem enviada',
    THREAD_REPLY: '↩️ Resposta em thread',
    REACTION_ADDED: '😄 Reação adicionada',
    FILE_SHARED: '📁 Arquivo compartilhado',
    DM_SENT: '📩 Mensagem direta',
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

function renderGitHubActivities(activities: GitHubActivity[]): string {
  if (activities.length === 0) return '<p class="empty-state">Nenhuma atividade no GitHub neste dia.</p>'
  return activities.map((a) => `
    <div class="activity-item activity-github">
      <div class="activity-header">
        <span class="activity-type">${esc(githubTypeLabel(a.type))}</span>
        <span class="activity-key">${esc(a.repo)}</span>
        <span class="activity-time">${formatDateTime(a.createdAt)}</span>
      </div>
      ${a.title ? `<div class="activity-title">${a.url ? `<a href="${esc(a.url)}" target="_blank">${esc(a.title)}</a>` : esc(a.title)}</div>` : ''}
      ${renderMetadata(a.metadata)}
    </div>
  `).join('')
}

function renderSlackActivities(activities: SlackActivity[]): string {
  if (activities.length === 0) return '<p class="empty-state">Nenhuma atividade no Slack neste dia.</p>'
  return activities.map((a) => `
    <div class="activity-item activity-slack">
      <div class="activity-header">
        <span class="activity-type">${esc(slackTypeLabel(a.type))}</span>
        <span class="activity-key">${esc(a.channelName ?? a.channel)}</span>
        <span class="activity-time">${formatDateTime(a.createdAt)}</span>
      </div>
      ${renderMetadata(a.metadata)}
    </div>
  `).join('')
}

function renderDaySection(day: DailyReport, index: number, jiraBaseUrl?: string): string {
  const hasJira = day.jira.length > 0
  const hasGitHub = day.github.length > 0
  const hasSlack = day.slack.length > 0
  const total = day.jira.length + day.github.length + day.slack.length

  const tabs = [
    hasJira ? `<button class="tab-btn active" data-tab="jira-${index}" onclick="switchTab(this, 'jira-${index}')">🔵 Jira <span class="tab-count">${day.jira.length}</span></button>` : '',
    hasGitHub ? `<button class="tab-btn ${!hasJira ? 'active' : ''}" data-tab="github-${index}" onclick="switchTab(this, 'github-${index}')">⚫ GitHub <span class="tab-count">${day.github.length}</span></button>` : '',
    hasSlack ? `<button class="tab-btn ${!hasJira && !hasGitHub ? 'active' : ''}" data-tab="slack-${index}" onclick="switchTab(this, 'slack-${index}')">🟢 Slack <span class="tab-count">${day.slack.length}</span></button>` : '',
  ].filter(Boolean).join('')

  const firstActive = hasJira ? 'jira' : hasGitHub ? 'github' : 'slack'

  return `
    <section class="day-section" id="day-${index}" data-date="${day.date}">
      <div class="day-header">
        <h2 class="day-title">📅 ${formatDate(day.date)}</h2>
        <span class="day-activity-count">${total} atividade${total !== 1 ? 's' : ''}</span>
      </div>

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
      `}

      ${day.aiSummary ? `
        <div class="ai-summary-card">
          <div class="ai-summary-header">🤖 Resumo executivo do dia</div>
          <p class="ai-summary-text">${esc(day.aiSummary)}</p>
        </div>
      ` : ''}
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
      const total = d.jira.length + d.github.length + d.slack.length
      return `<button class="day-pill" onclick="scrollToDay(${i})">${formatDate(d.date)}<span class="pill-count">${total}</span></button>`
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
    }
    .day-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text);
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

    /* ── AI SUMMARY ── */
    .ai-summary-card {
      margin-top: 1rem;
      padding: 1rem 1.25rem;
      border-radius: var(--radius);
      background: rgba(139, 92, 246, 0.1);
      border: 1px solid rgba(139, 92, 246, 0.3);
    }
    .ai-summary-header {
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
    const section = btn.closest('.day-section');
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

  let hasJira = false
  let hasGitHub = false
  let hasSlack = false

  for (const day of output.days) {
    if (day.jira.length > 0) { jiraByDay[day.date] = day.jira; hasJira = true }
    if (day.github.length > 0) { githubByDay[day.date] = day.github; hasGitHub = true }
    if (day.slack.length > 0) { slackByDay[day.date] = day.slack; hasSlack = true }
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

  return attachments
}
