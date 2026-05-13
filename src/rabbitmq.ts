import amqplib from 'amqplib'
import { encryptPayload } from './crypto'

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://admin:admin123@localhost:5672'
export const REPORT_QUEUE = 'report-jobs'

export interface PublishResult {
  position: number
}

/**
 * Returns the current number of messages waiting in the report-jobs queue.
 */
export async function checkQueueDepth(): Promise<number> {
  const connection = await amqplib.connect(RABBITMQ_URL)
  try {
    const channel = await connection.createChannel()
    await channel.assertQueue(REPORT_QUEUE, { durable: true })
    const { messageCount } = await channel.checkQueue(REPORT_QUEUE)
    await channel.close()
    return messageCount
  } finally {
    await connection.close()
  }
}

/**
 * Publishes a message to the report-jobs queue.
 * Returns the approximate position in queue (messageCount before publish + 1).
 */
export async function publishReportJob(payload: unknown): Promise<PublishResult> {
  const connection = await amqplib.connect(RABBITMQ_URL)

  try {
    const channel = await connection.createChannel()

    await channel.assertQueue(REPORT_QUEUE, { durable: true })

    const { messageCount } = await channel.checkQueue(REPORT_QUEUE)
    const position = messageCount + 1

    const envelope = encryptPayload(payload)

    channel.sendToQueue(
      REPORT_QUEUE,
      Buffer.from(JSON.stringify(envelope)),
      { persistent: true, contentType: 'application/json' }
    )

    await channel.close()

    return { position }
  } finally {
    await connection.close()
  }
}
