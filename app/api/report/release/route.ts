import { NextRequest, NextResponse } from 'next/server'
import { releaseJob } from '@/src/job-store'

export async function POST(req: NextRequest) {
  let body: { jobId?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Payload inválido.' }, { status: 400 })
  }

  const jobId = body.jobId?.trim()

  if (!jobId) {
    return NextResponse.json({ ok: false, message: 'Informe o jobId.' }, { status: 400 })
  }

  releaseJob(jobId)

  return NextResponse.json({ ok: true })
}
