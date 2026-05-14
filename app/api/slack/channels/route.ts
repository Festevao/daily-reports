import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

export interface SlackChannel {
  id: string
  name: string
  isPrivate: boolean
  numMembers: number
}

interface SlackRawChannel {
  id: string
  name: string
  is_private: boolean
  num_members: number
  is_member: boolean
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token } = body

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Token obrigatório.' }, { status: 400 })
  }

  try {
    const channels: SlackChannel[] = []
    let cursor: string | undefined

    do {
      const params: Record<string, unknown> = {
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 1000,
      }
      if (cursor) params.cursor = cursor

      const response = await axios.get('https://slack.com/api/conversations.list', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      })

      if (!response.data.ok) {
        return NextResponse.json(
          { ok: false, message: response.data.error ?? 'Erro ao buscar canais do Slack.' },
          { status: 400 }
        )
      }

      const page: SlackRawChannel[] = response.data.channels ?? []

      for (const c of page) {
        // Public channels: only include ones the user has joined.
        // Private channels: Slack only returns them if the token has access,
        // so is_member can be unreliable — trust the API's ACL instead.
        if (!c.is_private && !c.is_member) continue
        channels.push({
          id: c.id,
          name: c.name,
          isPrivate: c.is_private,
          numMembers: c.num_members,
        })
      }

      cursor = response.data.response_metadata?.next_cursor || undefined
    } while (cursor)

    return NextResponse.json({ ok: true, channels })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar canais do Slack.'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
