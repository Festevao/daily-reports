import nodemailer from 'nodemailer'
import { step, printErr } from '../logger'
import type { ReportPayload } from '../email/template'
import type { OpenAIUsage } from '../types/report.types'

const EMAIL_USER = process.env.EMAIL_USER
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD

function getTransporter() {
  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    throw new Error('Missing EMAIL_USER or EMAIL_APP_PASSWORD environment variables.')
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD,
    },
  })
}

export interface JsonAttachment {
  filename: string
  content: string
}

export interface SendReportEmailOptions {
  to: string
  jobId: string
  htmlContent: string
  jsonAttachments: JsonAttachment[]
  period: { startDate: string | null; endDate: string | null }
  openaiUsage?: OpenAIUsage
}

/**
 * Sends the daily report to the recipient as an HTML attachment
 * plus optional JSON data files per platform.
 * Logs the full email details to stdout before sending.
 */
export async function sendReportEmail(options: SendReportEmailOptions): Promise<void> {
  const { to, jobId, htmlContent, jsonAttachments, period, openaiUsage } = options

  const reportFilename = `relatorio-${period.startDate ?? 'sem-data'}_${period.endDate ?? 'sem-data'}.html`

  const subject = `📊 Seu Relatório Diário está pronto${period.startDate ? ` — ${period.startDate} a ${period.endDate}` : ''}`

  const openaiSection = openaiUsage ? `
    <div style="margin-top: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 20px;">
      <p style="color: #166534; font-weight: 600; margin: 0 0 10px; font-size: 14px;">🤖 Uso de IA (gpt-4o-mini)</p>
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <tr>
          <td style="color: #4ade80; padding: 3px 0; width: 50%;">Tokens de entrada</td>
          <td style="color: #166534; font-weight: 500;">${openaiUsage.promptTokens.toLocaleString('pt-BR')}</td>
        </tr>
        <tr>
          <td style="color: #4ade80; padding: 3px 0;">Tokens de saída</td>
          <td style="color: #166534; font-weight: 500;">${openaiUsage.completionTokens.toLocaleString('pt-BR')}</td>
        </tr>
        <tr>
          <td style="color: #4ade80; padding: 3px 0;">Total de tokens</td>
          <td style="color: #166534; font-weight: 500;">${openaiUsage.totalTokens.toLocaleString('pt-BR')}</td>
        </tr>
        <tr style="border-top: 1px solid #bbf7d0;">
          <td style="color: #4ade80; padding: 6px 0 3px; font-weight: 600;">Custo estimado</td>
          <td style="color: #166534; font-weight: 700; padding-top: 6px;">$${openaiUsage.estimatedCostUsd.toFixed(6)} USD</td>
        </tr>
      </table>
      <p style="color: #4ade80; font-size: 11px; margin: 8px 0 0;">Preços de referência: $0.15/1M tokens entrada · $0.60/1M tokens saída</p>
    </div>
  ` : ''

  const emailBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #f8fafc;">
      <div style="background: #fff; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0;">
        <h2 style="color: #1e293b; margin-bottom: 8px; font-size: 20px;">📊 Relatório Diário pronto</h2>
        <p style="color: #475569; margin-bottom: 4px;">
          Período: <strong>${period.startDate ?? '—'}</strong> até <strong>${period.endDate ?? '—'}</strong>
        </p>
        <p style="color: #94a3b8; font-size: 13px; margin-bottom: 24px;">Job ID: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${jobId}</code></p>
        <p style="color: #334155; line-height: 1.6;">
          O seu relatório de atividades foi gerado e está em anexo neste e-mail como <strong>${reportFilename}</strong>.
          Abra o arquivo HTML em qualquer navegador para visualizar o relatório completo com navegação por dia e plataforma.
        </p>
        ${jsonAttachments.length > 0 ? `
          <p style="color: #334155; line-height: 1.6; margin-top: 12px;">
            Os arquivos JSON com os dados brutos de cada plataforma também estão em anexo:
          </p>
          <ul style="color: #475569; font-size: 13px; margin-top: 8px; padding-left: 20px;">
            ${jsonAttachments.map((a) => `<li><code>${a.filename}</code></li>`).join('')}
          </ul>
        ` : ''}
        ${openaiSection}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">
          Este e-mail foi enviado automaticamente pelo Daily Reports.<br/>
          Não responda este e-mail.
        </p>
      </div>
    </div>
  `

  step(`📧 e-mail pronto para envio`)
  step(`   Para:      ${to}`)
  step(`   Assunto:   ${subject}`)
  step(`   Relatório: ${reportFilename} (${(htmlContent.length / 1024).toFixed(1)} KB)`)
  step(`   JSON:      ${jsonAttachments.map((a) => a.filename).join(', ') || 'nenhum'}`)

  const transporter = getTransporter()

  await transporter.sendMail({
    from: `"Daily Reports" <${EMAIL_USER}>`,
    to,
    subject,
    html: emailBody,
    attachments: [
      {
        filename: reportFilename,
        content: htmlContent,
        contentType: 'text/html; charset=utf-8',
      },
      ...jsonAttachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: 'application/json; charset=utf-8',
      })),
    ],
  })

  step(`✅ e-mail enviado com sucesso para ${to}`)
}

interface ErrorEmailOptions {
  payload: ReportPayload
  err: unknown
}

function sanitizePayload(payload: ReportPayload): Record<string, unknown> {
  return {
    jobId: payload.jobId,
    queuedAt: payload.queuedAt,
    period: payload.period,
    integrations: {
      jira: payload.integrations.jira ? {
        baseUrl: payload.integrations.jira.credentials.baseUrl,
        email: payload.integrations.jira.credentials.email,
        projectIds: payload.integrations.jira.projectIds,
      } : undefined,
      github: payload.integrations.github ? {
        orgLogins: payload.integrations.github.orgLogins,
        repoFullNames: payload.integrations.github.repoFullNames,
      } : undefined,
      slack: payload.integrations.slack ? {
        channelIds: payload.integrations.slack.channelIds,
        includeDirectMessages: payload.integrations.slack.includeDirectMessages,
      } : undefined,
      openai: payload.integrations.openai ? { enabled: true } : undefined,
      google: payload.integrations.google ? { connected: true } : undefined,
    },
  }
}

function formatErrorHtml(err: unknown): string {
  const lines: string[] = []

  const axiosErr = err as { isAxiosError?: boolean; message?: string; config?: { method?: string; url?: string; baseURL?: string; data?: unknown }; response?: { status?: number; statusText?: string; data?: unknown }; code?: string }

  if (axiosErr?.isAxiosError) {
    const method = (axiosErr.config?.method ?? 'GET').toUpperCase()
    const url = axiosErr.config?.url ?? ''
    const base = axiosErr.config?.baseURL ?? ''
    const fullUrl = url.startsWith('http') ? url : `${base}${url}`

    lines.push(`<tr><td class="label">Tipo</td><td class="value">HTTP Error</td></tr>`)
    lines.push(`<tr><td class="label">Mensagem</td><td class="value">${esc(axiosErr.message ?? '')}</td></tr>`)
    lines.push(`<tr><td class="label">Request</td><td class="value mono">${esc(method)} ${esc(fullUrl)}</td></tr>`)
    if (axiosErr.code) lines.push(`<tr><td class="label">Código</td><td class="value mono">${esc(axiosErr.code)}</td></tr>`)
    if (axiosErr.response) {
      lines.push(`<tr><td class="label">Status HTTP</td><td class="value">${axiosErr.response.status} ${esc(String(axiosErr.response.statusText ?? ''))}</td></tr>`)
      if (axiosErr.response.data) {
        const body = typeof axiosErr.response.data === 'string'
          ? axiosErr.response.data.slice(0, 800)
          : JSON.stringify(axiosErr.response.data, null, 2).slice(0, 800)
        lines.push(`<tr><td class="label">Response</td><td class="value mono pre">${esc(body)}</td></tr>`)
      }
    } else {
      lines.push(`<tr><td class="label">Rede</td><td class="value">Sem resposta do servidor (timeout ou inacessível)</td></tr>`)
    }
  } else if (err instanceof Error) {
    lines.push(`<tr><td class="label">Tipo</td><td class="value">${esc(err.name)}</td></tr>`)
    lines.push(`<tr><td class="label">Mensagem</td><td class="value">${esc(err.message)}</td></tr>`)
    if (err.stack) {
      const frames = err.stack.split('\n').slice(1).join('\n')
      lines.push(`<tr><td class="label">Stack</td><td class="value mono pre">${esc(frames)}</td></tr>`)
    }
  } else {
    lines.push(`<tr><td class="label">Erro</td><td class="value">${esc(String(err))}</td></tr>`)
  }

  return lines.join('\n')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Sends an error notification email with full error details (tokens redacted).
 */
export async function sendErrorEmail({ payload, err }: ErrorEmailOptions): Promise<void> {
  const { reportEmail, jobId, period } = payload
  const generatedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const sanitized = sanitizePayload(payload)

  const subject = `❌ Falha ao gerar seu Relatório Diário — Job ${jobId.slice(0, 8)}`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 24px; }
  .card { background: #fff; border-radius: 12px; padding: 28px; max-width: 680px; margin: 0 auto; border: 1px solid #e2e8f0; }
  h2 { color: #991b1b; margin: 0 0 4px; font-size: 18px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  h3 { color: #1e293b; font-size: 14px; font-weight: 600; margin: 24px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .label { color: #64748b; font-weight: 500; width: 130px; padding: 5px 12px 5px 0; vertical-align: top; white-space: nowrap; }
  .value { color: #1e293b; padding: 5px 0; word-break: break-all; }
  .value.mono { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }
  .value.pre { white-space: pre-wrap; }
  .payload { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #334155; white-space: pre-wrap; overflow-x: auto; }
  .footer { color: #94a3b8; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .badge-error { display: inline-block; background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
</style>
</head>
<body>
<div class="card">
  <h2>❌ Falha ao gerar relatório</h2>
  <p class="meta">
    <span class="badge-error">ERRO</span>&nbsp;
    Job <code>${esc(jobId)}</code> &nbsp;·&nbsp; ${generatedAt}
  </p>

  <p style="color:#334155;line-height:1.6;">
    Ocorreu um erro durante o processamento do seu relatório para o período
    <strong>${esc(period.startDate ?? '?')}</strong> até <strong>${esc(period.endDate ?? '?')}</strong>.
    O item foi removido da fila. Você pode tentar novamente.
  </p>

  <h3>Detalhes do erro</h3>
  <table>
    ${formatErrorHtml(err)}
  </table>

  <h3>Contexto do job (tokens omitidos)</h3>
  <div class="payload">${esc(JSON.stringify(sanitized, null, 2))}</div>

  <p class="footer">
    Este e-mail foi enviado automaticamente pelo Daily Reports. Não responda.
  </p>
</div>
</body>
</html>`

  step(`📧 enviando e-mail de erro para ${reportEmail}...`)

  const transporter = getTransporter()
  await transporter.sendMail({
    from: `"Daily Reports" <${EMAIL_USER}>`,
    to: reportEmail,
    subject,
    html,
  })

  step(`✅ e-mail de erro enviado para ${reportEmail}`)
}
