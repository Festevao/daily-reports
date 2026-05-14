import { NextRequest, NextResponse } from 'next/server'
import { getJob } from '@/src/job-store'
import { checkQueueDepth } from '@/src/rabbitmq'

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId')?.trim()

  if (!jobId) {
    return NextResponse.json({ ok: false, message: 'Informe o Job ID.' }, { status: 400 })
  }

  const job = getJob(jobId)

  if (!job) {
    return NextResponse.json({
      ok: true,
      status: 'not_found' as const,
      message: 'Job não encontrado. Pode já ter sido processado com sucesso.',
    })
  }

  if (job.status === 'processing') {
    return NextResponse.json({
      ok: true,
      status: 'processing' as const,
      queuedAt: job.queuedAt,
      processingAt: job.processingAt ?? null,
    })
  }

  if (job.status === 'error') {
    return NextResponse.json({
      ok: true,
      status: 'error' as const,
      queuedAt: job.queuedAt,
      errorMessage: job.errorMessage ?? 'Erro desconhecido.',
    })
  }

  try {
    const queueDepth = await checkQueueDepth()
    return NextResponse.json({
      ok: true,
      status: 'pending' as const,
      queueDepth,
      queuedAt: job.queuedAt,
    })
  } catch {
    return NextResponse.json({
      ok: true,
      status: 'pending' as const,
      queueDepth: null,
      queuedAt: job.queuedAt,
      message: 'Job encontrado, mas não foi possível consultar o RabbitMQ no momento.',
    })
  }
}
