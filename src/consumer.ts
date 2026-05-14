import amqplib from 'amqplib'
import { decryptPayload, EncryptedEnvelope } from './crypto'
import { ReportPayload } from './email/template'
import { sendReportEmail, sendErrorEmail } from './email/adapter'
import { buildReport } from './report/orchestrator'
import { buildHtmlReport, buildJsonAttachments } from './report/html.builder'
import { markProcessing, markError, releaseJob } from './job-store'
import { step, logSection, printErr } from './logger'

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://admin:admin123@localhost:5672'
const QUEUE_NAME = 'report-jobs'
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

async function releaseJobRemote(jobId: string): Promise<void> {
  try {
    await fetch(`${APP_URL}/api/report/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    })
    step(`🔓 job liberado da fila de controle`)
  } catch {
    step(`⚠️ não foi possível liberar via HTTP — liberando diretamente no store`)
    releaseJob(jobId)
  }
}

interface AxiosLikeError {
  isAxiosError: boolean
  config?: { method?: string; url?: string; baseURL?: string; data?: unknown; headers?: Record<string, unknown> }
  response?: { status?: number; statusText?: string; data?: unknown; headers?: Record<string, unknown> }
  code?: string
  message: string
  stack?: string
}

function isAxiosError(err: unknown): err is AxiosLikeError {
  return typeof err === 'object' && err !== null && (err as AxiosLikeError).isAxiosError === true
}

function logError(err: unknown, context?: string): void {
  const sep = '═'.repeat(50)
  printErr(`\n${sep}`)
  if (context) printErr(`  📍 Contexto: ${context}`)

  if (isAxiosError(err)) {
    const method = (err.config?.method ?? 'GET').toUpperCase()
    const url = err.config?.url ?? ''
    const base = err.config?.baseURL ?? ''
    const fullUrl = url.startsWith('http') ? url : `${base}${url}`

    printErr(`  ❌ HTTP Error: ${err.message}`)
    printErr(`  🌐 Request:   ${method} ${fullUrl}`)

    if (err.code) {
      printErr(`  📛 Code:      ${err.code}`)
    }

    if (err.response) {
      printErr(`  📬 Status:    ${err.response.status} ${err.response.statusText ?? ''}`)

      if (err.response.headers) {
        const contentType = (err.response.headers['content-type'] as string | undefined) ?? ''
        printErr(`  📋 Content-Type: ${contentType}`)
      }

      if (err.response.data !== undefined && err.response.data !== null) {
        const body = typeof err.response.data === 'string'
          ? err.response.data.slice(0, 1000)
          : JSON.stringify(err.response.data, null, 2).slice(0, 1000)
        printErr(`  📄 Response body:\n${body.split('\n').map((l) => `     ${l}`).join('\n')}`)
      }
    } else {
      printErr(`  📡 Sem resposta do servidor (timeout ou rede inacessível)`)
    }

    if (err.config?.data) {
      const reqBody = typeof err.config.data === 'string'
        ? err.config.data.slice(0, 500)
        : JSON.stringify(err.config.data).slice(0, 500)
      printErr(`  📤 Request body (trunc):\n     ${reqBody}`)
    }
  } else if (err instanceof Error) {
    printErr(`  ❌ ${err.name}: ${err.message}`)
  } else {
    printErr(`  ❌ Erro desconhecido: ${String(err)}`)
  }

  if (err instanceof Error && err.stack) {
    const frames = err.stack
      .split('\n')
      .slice(1)
      .filter((l) => !l.includes('node_modules') && !l.includes('node:internal'))
      .slice(0, 8)

    if (frames.length > 0) {
      printErr(`  📚 Stack (project frames):`)
      for (const frame of frames) {
        printErr(`     ${frame.trim()}`)
      }
    } else {
      const allFrames = err.stack.split('\n').slice(1, 6)
      printErr(`  📚 Stack:`)
      for (const frame of allFrames) {
        printErr(`     ${frame.trim()}`)
      }
    }
  }

  printErr(sep)
}

async function processMessage(raw: string): Promise<{ payload: ReportPayload | null }> {
  let envelope: EncryptedEnvelope

  try {
    envelope = JSON.parse(raw) as EncryptedEnvelope
  } catch {
    throw Object.assign(new Error('CORRUPTED: Mensagem não é um JSON válido.'), { payload: null })
  }

  let payload: ReportPayload

  try {
    payload = decryptPayload<ReportPayload>(envelope)
  } catch {
    throw Object.assign(
      new Error('CORRUPTED: Falha ao descriptografar o payload. Verifique PAYLOAD_ENCRYPTION_KEY.'),
      { payload: null }
    )
  }

  const { jobId, reportEmail, period } = payload

  logSection(`📥 Job recebido: ${jobId}`)
  step(`Destinatário: ${reportEmail}`)
  step(`Período:      ${period.startDate} → ${period.endDate}`)
  step(`Integrações:  ${Object.keys(payload.integrations).join(', ')}`)

  markProcessing(jobId)
  step('▶ processando')

  try {
    step('🔄 iniciando extração de dados...')
    const reportOutput = await buildReport(payload)

    const totalActivities = reportOutput.days.reduce(
      (acc, d) => acc + d.jira.length + d.github.length + d.slack.length,
      0
    )
    const daysWithData = reportOutput.days.filter(
      (d) => d.jira.length + d.github.length + d.slack.length > 0
    ).length

    step(`✅ extração concluída — ${totalActivities} atividades em ${daysWithData}/${reportOutput.days.length} dia(s)`)

    for (const day of reportOutput.days) {
      const counts = [
        day.jira.length > 0 ? `Jira:${day.jira.length}` : '',
        day.github.length > 0 ? `GitHub:${day.github.length}` : '',
        day.slack.length > 0 ? `Slack:${day.slack.length}` : '',
      ].filter(Boolean).join('  ')
      const ai = day.aiSummary ? '  🤖IA' : ''
      step(`   ${day.date}  ${counts || 'sem atividades'}${ai}`)
    }

    step('🎨 gerando relatório HTML...')
    const htmlContent = buildHtmlReport(reportOutput)
    const jsonAttachments = buildJsonAttachments(reportOutput)
    step(`✅ HTML gerado — ${(htmlContent.length / 1024).toFixed(1)} KB  |  JSON: ${jsonAttachments.length} arquivo(s)`)

    step(`📧 enviando e-mail para ${reportEmail}...`)
    await sendReportEmail({ to: reportEmail, jobId, htmlContent, jsonAttachments, period, openaiUsage: reportOutput.openaiUsage })
    step('✅ e-mail enviado')

    await releaseJobRemote(jobId)
    logSection(`✅ Job ${jobId} concluído`)

    return { payload }

  } catch (err) {
    markError(jobId, err instanceof Error ? err.message : String(err))
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), { payload })
  }
}

export type ConsumerCleanup = () => Promise<void>

/**
 * Starts the RabbitMQ consumer. Returns a cleanup function to gracefully
 * close the channel and connection when the process shuts down.
 */
export async function startConsumer(): Promise<ConsumerCleanup> {
  logSection('🚀 Daily Reports Consumer iniciando')
  step(`RabbitMQ: ${RABBITMQ_URL.replace(/:\/\/.*@/, '://*****@')}`)
  step(`Fila:     ${QUEUE_NAME}`)
  step(`App URL:  ${APP_URL}`)

  const connection = await amqplib.connect(RABBITMQ_URL)
  const channel = await connection.createChannel()

  await channel.assertQueue(QUEUE_NAME, { durable: true })
  channel.prefetch(1)

  step(`✅ Consumer ativo — aguardando mensagens...\n`)

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return

    try {
      await processMessage(msg.content.toString())
      channel.ack(msg)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const isCorrupted = message.startsWith('CORRUPTED:')
      const payload = (err as { payload?: ReportPayload | null }).payload ?? null

      if (isCorrupted) {
        logSection('⚠️  Mensagem corrompida — descartada')
        logError(err)
      } else {
        logSection('❌  Falha no processamento — notificando usuário')
        logError(err)

        if (payload) {
          try {
            await sendErrorEmail({ payload, err })
          } catch (mailErr) {
            step(`⚠️ falha ao enviar e-mail de erro: ${mailErr instanceof Error ? mailErr.message : String(mailErr)}`)
          }
        }
      }

      channel.ack(msg)
    }
  })

  return async () => {
    logSection('⏹ Encerrando consumer')
    await channel.close()
    await connection.close()
  }
}
