import amqplib from 'amqplib'
import { decryptPayload, EncryptedEnvelope } from './crypto'
import { buildReportMarkdown, ReportPayload } from './email/template'
import { sendReportEmail } from './email/adapter'

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://admin:admin123@localhost:5672'
const QUEUE_NAME = 'report-jobs'
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

async function releaseJob(jobId: string): Promise<void> {
  try {
    await fetch(`${APP_URL}/api/report/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    })
    console.log(`🔓  Job ${jobId} liberado da fila de controle.`)
  } catch {
    console.warn(`⚠️  Não foi possível liberar o job ${jobId}. O lock expirará no próximo restart.`)
  }
}

async function processMessage(raw: string): Promise<void> {
  let envelope: EncryptedEnvelope

  try {
    envelope = JSON.parse(raw) as EncryptedEnvelope
  } catch {
    throw new Error('Mensagem não é um JSON válido.')
  }

  let payload: ReportPayload

  try {
    payload = decryptPayload<ReportPayload>(envelope)
  } catch {
    throw new Error('Falha ao descriptografar o payload. Verifique PAYLOAD_ENCRYPTION_KEY.')
  }

  console.log(`\n📥  Processando job: ${payload.jobId}`)
  console.log(`     Destinatário: ${payload.reportEmail}`)
  console.log(`     Período: ${payload.period.startDate} → ${payload.period.endDate}`)

  const markdownContent = buildReportMarkdown(payload)

  await sendReportEmail({
    to: payload.reportEmail,
    jobId: payload.jobId,
    markdownContent,
    period: payload.period,
  })

  await releaseJob(payload.jobId)
}

export type ConsumerCleanup = () => Promise<void>

/**
 * Starts the RabbitMQ consumer. Returns a cleanup function to gracefully
 * close the channel and connection when the process shuts down.
 */
export async function startConsumer(): Promise<ConsumerCleanup> {
  console.log('🚀  Daily Reports Consumer iniciando...')
  console.log(`     RabbitMQ: ${RABBITMQ_URL.replace(/:\/\/.*@/, '://*****@')}`)
  console.log(`     Fila:     ${QUEUE_NAME}`)
  console.log(`     App URL:  ${APP_URL}\n`)

  const connection = await amqplib.connect(RABBITMQ_URL)
  const channel = await connection.createChannel()

  await channel.assertQueue(QUEUE_NAME, { durable: true })
  channel.prefetch(1)

  console.log(`✅  Consumer ativo — aguardando mensagens na fila "${QUEUE_NAME}"...\n`)

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return

    try {
      await processMessage(msg.content.toString())
      channel.ack(msg)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`❌  Erro ao processar mensagem: ${message}`)

      const isCorrupted = message.includes('descriptografar') || message.includes('JSON válido')

      if (isCorrupted) {
        console.error('     Mensagem descartada (não pode ser reprocessada).')
        channel.nack(msg, false, false)
      } else {
        console.error('     Mensagem devolvida à fila para nova tentativa.')
        channel.nack(msg, false, true)
      }
    }
  })

  return async () => {
    console.log('⏹️   Encerrando consumer...')
    await channel.close()
    await connection.close()
  }
}
