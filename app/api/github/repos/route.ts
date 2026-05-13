import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

export interface GithubRepo {
  id: number
  name: string
  fullName: string
  ownerLogin: string
  ownerAvatarUrl: string
  isPrivate: boolean
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

    const response = await axios.get('https://api.github.com/user/repos', {
      headers,
      params: { per_page: 100, visibility: 'all', affiliation: 'owner,organization_member,collaborator' },
    })

    const repos: GithubRepo[] = response.data.map((r: {
      id: number
      name: string
      full_name: string
      private: boolean
      owner: { login: string; avatar_url: string }
    }) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      ownerLogin: r.owner.login,
      ownerAvatarUrl: r.owner.avatar_url,
      isPrivate: r.private,
    }))

    return NextResponse.json({ ok: true, repos })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar repositórios do GitHub.'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
