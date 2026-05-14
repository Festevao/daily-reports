import { NextResponse } from 'next/server'
import { clearTokens } from '../../../../../src/lib/google-token-store'

export async function DELETE(): Promise<NextResponse> {
  clearTokens()
  return NextResponse.json({ ok: true })
}
