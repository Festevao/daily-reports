import { NextRequest, NextResponse } from 'next/server'
import { validateJira } from '@/src/validators'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { baseUrl, email, apiToken, accountId } = body

  if (!baseUrl || !email || !apiToken || !accountId) {
    return NextResponse.json({ ok: false, message: 'Campos obrigatórios ausentes.' }, { status: 400 })
  }

  try {
    const result = await validateJira({ baseUrl, email, apiToken, accountId })
    if (result !== true) {
      return NextResponse.json({ ok: false, message: result }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao validar credenciais do Jira.'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
