import nodemailer from 'nodemailer'

const EMAIL_USER = process.env.EMAIL_USER
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD

function getTransporter() {
  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    throw new Error('Missing EMAIL_USER or EMAIL_APP_PASSWORD environment variables.')
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD,
    },
  })
}

export interface SendReportEmailOptions {
  to: string
  jobId: string
  markdownContent: string
  period: { startDate: string | null; endDate: string | null }
}

/**
 * Sends the daily report to the recipient as a .md attachment.
 * Logs the full email details and markdown content to stdout before sending.
 */
export async function sendReportEmail(options: SendReportEmailOptions): Promise<void> {
  const { to, jobId, markdownContent, period } = options

  const filename = `relatorio-${period.startDate ?? 'sem-data'}_${period.endDate ?? 'sem-data'}.md`

  const subject = `📊 Seu Relatório Diário está pronto${period.startDate ? ` — ${period.startDate} a ${period.endDate}` : ''}`

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1e293b; margin-bottom: 8px;">📊 Relatório Diário</h2>
      <p style="color: #475569; margin-bottom: 4px;">
        Período: <strong>${period.startDate ?? '—'}</strong> a <strong>${period.endDate ?? '—'}</strong>
      </p>
      <p style="color: #94a3b8; font-size: 13px; margin-bottom: 24px;">Job ID: <code>${jobId}</code></p>
      <p style="color: #334155;">
        O seu relatório diário foi gerado e está em anexo neste e-mail no formato <strong>.md</strong> (Markdown).
      </p>
      <p style="color: #334155;">
        Você pode abrir o arquivo em qualquer editor de texto, no GitHub, Notion, Obsidian ou qualquer visualizador de Markdown.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">
        Este e-mail foi enviado automaticamente pelo Daily Reports.<br/>
        Não responda este e-mail.
      </p>
    </div>
  `

  console.log('\n' + '═'.repeat(60))
  console.log('📧  EMAIL A SER ENVIADO')
  console.log('═'.repeat(60))
  console.log(`  Para:     ${to}`)
  console.log(`  Assunto:  ${subject}`)
  console.log(`  Anexo:    ${filename}`)
  console.log(`  Job ID:   ${jobId}`)
  console.log('─'.repeat(60))
  console.log('📄  CONTEÚDO DO ARQUIVO .md:')
  console.log('─'.repeat(60))
  console.log(markdownContent)
  console.log('═'.repeat(60) + '\n')

  const transporter = getTransporter()

  await transporter.sendMail({
    from: `"Daily Reports" <${EMAIL_USER}>`,
    to,
    subject,
    html: htmlBody,
    attachments: [
      {
        filename,
        content: markdownContent,
        contentType: 'text/markdown; charset=utf-8',
      },
    ],
  })

  console.log(`✅  E-mail enviado com sucesso para ${to}`)
}
