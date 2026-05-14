import { NextResponse } from 'next/server'
import { getTokens } from '../../../../../src/lib/google-token-store'

export async function GET(): Promise<NextResponse> {
  const tokens = getTokens()

  if (!tokens) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    email: tokens.email,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  })
}
