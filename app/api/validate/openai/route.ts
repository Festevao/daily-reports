import { NextRequest, NextResponse } from 'next/server'
import { validateOpenAI } from '@/src/validators'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token } = body

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Token obrigatório.' }, { status: 400 })
  }

  try {
    const result = await validateOpenAI(token)
    if (result !== true) {
      return NextResponse.json({ ok: false, message: result }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao validar token da OpenAI.'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
