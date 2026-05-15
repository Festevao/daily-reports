import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? ''
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/auth/google/callback'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    return new NextResponse(closePopupHtml(null, `Acesso negado: ${error}`), { headers: { 'Content-Type': 'text/html' } })
  }

  if (!code) {
    return new NextResponse(closePopupHtml(null, 'Código de autorização ausente.'), { headers: { 'Content-Type': 'text/html' } })
  }

  try {
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token) {
      return new NextResponse(closePopupHtml(null, 'Falha ao obter access token.'), { headers: { 'Content-Type': 'text/html' } })
    }

    oauth2Client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const userInfo = await oauth2.userinfo.get()
    const email = userInfo.data.email ?? ''

    return new NextResponse(
      closePopupHtml({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? '', email }, null),
      { headers: { 'Content-Type': 'text/html' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new NextResponse(closePopupHtml(null, `Erro ao autenticar: ${message}`), { headers: { 'Content-Type': 'text/html' } })
  }
}

interface GoogleTokenPayload {
  accessToken: string
  refreshToken: string
  email: string
}

function closePopupHtml(tokens: GoogleTokenPayload | null, errorMessage: string | null): string {
  if (errorMessage) {
    return `<!DOCTYPE html><html><body>
<p style="font-family:sans-serif;color:#dc2626;padding:24px;">❌ ${errorMessage}</p>
<script>setTimeout(()=>window.close(),3000);</script>
</body></html>`
  }

  const payload = JSON.stringify({ type: 'google-auth-success', ...tokens })
  const appOrigin = process.env.APP_URL ?? 'http://localhost:3000'
  return `<!DOCTYPE html><html><body>
<p style="font-family:sans-serif;color:#16a34a;padding:24px;">✅ Conectado com sucesso! Esta janela será fechada automaticamente.</p>
<script>window.opener?.postMessage(${payload},'${appOrigin}');window.close();</script>
</body></html>`
}
