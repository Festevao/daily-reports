import { NextRequest, NextResponse } from 'next/server'
import { createJiraClient } from '@/src/jira-client'

export interface JiraProject {
  id: string
  key: string
  name: string
  avatarUrl: string
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { baseUrl, email, apiToken } = body

  if (!baseUrl || !email || !apiToken) {
    return NextResponse.json({ ok: false, message: 'Credenciais do Jira ausentes.' }, { status: 400 })
  }

  try {
    const client = createJiraClient(baseUrl, email, apiToken)
    const response = await client.get('/rest/api/3/project', {
      params: { maxResults: 100 },
    })

    const projects: JiraProject[] = response.data.map((p: {
      id: string
      key: string
      name: string
      avatarUrls: Record<string, string>
    }) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      avatarUrl: p.avatarUrls?.['32x32'] ?? '',
    }))

    return NextResponse.json({ ok: true, projects })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar projetos do Jira.'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
