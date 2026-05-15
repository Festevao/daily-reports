import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: {
    default: 'Daily Reports',
    template: '%s — Daily Reports',
  },
  description: 'Gere relatórios diários de atividade integrando Jira, GitHub, Slack e Google automaticamente.',
  applicationName: 'Daily Reports',
  authors: [{ name: 'Felipi Trindade' }],
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'Daily Reports',
    description: 'Daily Reports — Productivity automation tool by Felipi Trindade',
    type: 'website',
    siteName: 'Daily Reports',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
