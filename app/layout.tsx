import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Daily Reports — Setup',
  description: 'Configure your integrations to generate daily reports',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
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
