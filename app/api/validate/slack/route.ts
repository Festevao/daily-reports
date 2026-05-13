import { NextRequest, NextResponse } from 'next/server'
import { validateSlack } from '@/src/validators'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token } = body

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Token obrigatório.' }, { status: 400 })
  }

  try {
    const result = await validateSlack(token)
    if (result !== true) {
      return NextResponse.json({ ok: false, message: result }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao validar token do Slack.'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
