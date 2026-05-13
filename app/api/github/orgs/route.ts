import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

export interface GithubOrg {
  login: string
  id: number
  avatarUrl: string
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token } = body

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Token obrigatório.' }, { status: 400 })
  }

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    }

    const response = await axios.get('https://api.github.com/user/orgs', {
      headers,
      params: { per_page: 100 },
    })

    const orgs: GithubOrg[] = response.data.map((o: {
      login: string
      id: number
      avatar_url: string
    }) => ({
      login: o.login,
      id: o.id,
      avatarUrl: o.avatar_url,
    }))

    return NextResponse.json({ ok: true, orgs })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar organizações do GitHub.'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
