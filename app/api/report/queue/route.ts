import { NextRequest, NextResponse } from 'next/server'
import { reserveJob, releaseJob } from '@/src/job-store'
import { publishReportJob } from '@/src/rabbitmq'
import { validateJiraBaseUrl } from '@/src/validators'

function extractFingerprints(body: Record<string, unknown>): string[] {
  const fps: string[] = []

  const email = body.reportEmail
  if (typeof email === 'string' && email) {
    fps.push(`email:${email.toLowerCase().trim()}`)
  }

  const integrations = body.integrations as Record<string, unknown> | undefined

  const jira = integrations?.jira as Record<string, unknown> | undefined
  const jiraEmail = (jira?.credentials as Record<string, unknown> | undefined)?.email
  if (typeof jiraEmail === 'string' && jiraEmail) {
    fps.push(`jira:${jiraEmail.toLowerCase().trim()}`)
  }

  const github = integrations?.github as Record<string, unknown> | undefined
  const githubToken = github?.token
  if (typeof githubToken === 'string' && githubToken.length >= 8) {
    fps.push(`github:${githubToken.slice(-16)}`)
  }

  const slack = integrations?.slack as Record<string, unknown> | undefined
  const slackToken = slack?.token
  if (typeof slackToken === 'string' && slackToken.length >= 8) {
    fps.push(`slack:${slackToken.slice(-16)}`)
  }

  return fps
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Payload inválido.' }, { status: 400 })
  }

  const jiraCredentials = (body.integrations as Record<string, unknown> | undefined)
    ?.jira as Record<string, unknown> | undefined
  const jiraBaseUrl = (jiraCredentials?.credentials as Record<string, unknown> | undefined)?.baseUrl
  if (typeof jiraBaseUrl === 'string' && jiraBaseUrl) {
    const urlError = validateJiraBaseUrl(jiraBaseUrl)
    if (urlError) {
      return NextResponse.json({ ok: false, message: urlError }, { status: 400 })
    }
  }

  const fingerprints = extractFingerprints(body)

  if (fingerprints.length === 0) {
    return NextResponse.json({ ok: false, message: 'Nenhuma credencial identificada no payload.' }, { status: 400 })
  }

  const reservation = reserveJob(fingerprints)

  if (!reservation.allowed) {
    return NextResponse.json({ ok: false, message: reservation.message }, { status: 409 })
  }

  const { jobId } = reservation

  const payload = {
    ...body,
    jobId,
    queuedAt: new Date().toISOString(),
  }

  try {
    const { position } = await publishReportJob(payload)
    return NextResponse.json({ ok: true, jobId, position })
  } catch (err) {
    releaseJob(jobId)
    const message =
      err instanceof Error
        ? `Erro ao conectar ao RabbitMQ: ${err.message}`
        : 'Erro desconhecido ao publicar na fila.'
    return NextResponse.json({ ok: false, message }, { status: 503 })
  }
}
