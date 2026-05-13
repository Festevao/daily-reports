import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

export interface SlackChannel {
  id: string
  name: string
  isPrivate: boolean
  numMembers: number
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token } = body

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Token obrigatório.' }, { status: 400 })
  }

  try {
    const response = await axios.get('https://slack.com/api/conversations.list', {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 200,
      },
    })

    if (!response.data.ok) {
      return NextResponse.json(
        { ok: false, message: response.data.error ?? 'Erro ao buscar canais do Slack.' },
        { status: 400 }
      )
    }

    const channels: SlackChannel[] = response.data.channels.map((c: {
      id: string
      name: string
      is_private: boolean
      num_members: number
    }) => ({
      id: c.id,
      name: c.name,
      isPrivate: c.is_private,
      numMembers: c.num_members,
    }))

    return NextResponse.json({ ok: true, channels })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar canais do Slack.'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
