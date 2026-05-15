'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowRight, Loader2, Mail, Search, LogIn, LogOut, CheckCircle2 } from 'lucide-react'
import { InputField } from '@/components/InputField'
import { SelectionsModal } from '@/components/SelectionsModal'
import { JobStatusModal } from '@/components/JobStatusModal'
import { HelpModal, HelpTopic } from '@/components/HelpModal'
import { ToastContainer, ToastMessage } from '@/components/Toast'

interface FormState {
  reportEmail: string
  jiraBaseUrl: string
  jiraEmail: string
  jiraApiToken: string
  jiraAccountId: string
  githubToken: string
  slackToken: string
  openaiToken: string
  openaiInstructions: string
}

interface FormErrors {
  reportEmail?: string
  jiraBaseUrl?: string
  jiraEmail?: string
  jiraApiToken?: string
  jiraAccountId?: string
  githubToken?: string
  slackToken?: string
  openaiToken?: string
  jiraGroup?: string
  githubGroup?: string
  slackGroup?: string
  openaiGroup?: string
}

interface GoogleTokens {
  accessToken: string
  refreshToken: string
  email: string
}

type EasterEggState = 'idle' | 'fuse' | 'explosion' | 'revealed'

const JIRA_LOGO = (
  <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none">
    <path d="M16 2L2.5 15.5 16 29l13.5-13.5L16 2z" fill="#0052CC" />
    <path d="M16 2L9.5 8.5 16 15l6.5-6.5L16 2z" fill="#2684FF" />
    <path d="M16 17l-6.5 6.5L16 30l6.5-6.5L16 17z" fill="#2684FF" />
  </svg>
)

const GITHUB_LOGO = (
  <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-200" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
)

const SLACK_LOGO = (
  <svg viewBox="0 0 54 54" className="w-5 h-5" fill="none">
    <path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0" />
    <path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D" />
    <path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E" />
    <path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.249a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A" />
  </svg>
)

const OPENAI_LOGO = (
  <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-200" fill="currentColor">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.843-3.372 2.019-1.168a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.4-.678zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z" />
  </svg>
)

const GOOGLE_LOGO = (
  <svg viewBox="0 0 48 48" className="w-5 h-5" fill="none">
    <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107" />
    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00" />
    <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50" />
    <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2" />
  </svg>
)

const STORAGE_KEY = 'daily-reports-config'
const ENABLED_KEY = 'daily-reports-enabled'

const defaultForm: FormState = {
  reportEmail: '',
  jiraBaseUrl: '',
  jiraEmail: '',
  jiraApiToken: '',
  jiraAccountId: '',
  githubToken: '',
  slackToken: '',
  openaiToken: '',
  openaiInstructions: '',
}

const defaultEnabled = { jira: true, github: true, slack: true, openai: true, google: false }

function loadFromStorage(): FormState {
  if (typeof window === 'undefined') return defaultForm
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultForm
    return { ...defaultForm, ...JSON.parse(stored) }
  } catch {
    return defaultForm
  }
}

function loadEnabledFromStorage(): typeof defaultEnabled {
  if (typeof window === 'undefined') return defaultEnabled
  try {
    const stored = localStorage.getItem(ENABLED_KEY)
    if (!stored) return defaultEnabled
    return { ...defaultEnabled, ...JSON.parse(stored) }
  } catch {
    return defaultEnabled
  }
}

export default function SetupPage() {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [enabled, setEnabled] = useState(defaultEnabled)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null)
  const [googleTokens, setGoogleTokens] = useState<GoogleTokens | null>(null)
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false)
  const [easterEgg, setEasterEgg] = useState<EasterEggState>('idle')

  const addToast = (message: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type: 'error' }])
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const toggleIntegration = (key: keyof typeof defaultEnabled) => {
    setEnabled((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(ENABLED_KEY, JSON.stringify(next))
      return next
    })
    setErrors((prev) => {
      const cleared = { ...prev }
      if (key === 'jira') {
        delete cleared.jiraBaseUrl; delete cleared.jiraEmail
        delete cleared.jiraApiToken; delete cleared.jiraAccountId; delete cleared.jiraGroup
      }
      if (key === 'github') { delete cleared.githubToken; delete cleared.githubGroup }
      if (key === 'slack') { delete cleared.slackToken; delete cleared.slackGroup }
      if (key === 'openai') { delete cleared.openaiToken; delete cleared.openaiGroup }
      return cleared
    })
  }

  const fetchGoogleStatus = useCallback(() => {
    fetch('/api/auth/google/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setGoogleTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken, email: data.email })
        } else {
          setGoogleTokens(null)
        }
      })
      .catch(() => {})
  }, [])

  const handleGoogleLogin = () => {
    setGoogleAuthLoading(true)
    const popup = window.open('/api/auth/google', 'google-auth', 'width=500,height=620,left=200,top=100')

    const onMessage = (evt: MessageEvent) => {
      if (evt.data !== 'google-auth-success') return
      window.removeEventListener('message', onMessage)
      fetch('/api/auth/google/status')
        .then((r) => r.json())
        .then((data) => {
          if (data.connected) {
            setGoogleTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken, email: data.email })
          }
        })
        .catch(() => {})
        .finally(() => setGoogleAuthLoading(false))
    }

    window.addEventListener('message', onMessage)

    const interval = setInterval(() => {
      if (popup?.closed) {
        clearInterval(interval)
        window.removeEventListener('message', onMessage)
        setGoogleAuthLoading(false)
      }
    }, 500)
  }

  const handleGoogleDisconnect = () => {
    fetch('/api/auth/google/disconnect', { method: 'DELETE' }).catch(() => {})
    setGoogleTokens(null)
  }

  useEffect(() => {
    setForm(loadFromStorage())
    setEnabled(loadEnabledFromStorage())
    fetchGoogleStatus()
  }, [fetchGoogleStatus])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
  }, [form])

  const setField = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleEasterEgg = () => {
    if (easterEgg !== 'idle') return
    setEasterEgg('fuse')
    setTimeout(() => setEasterEgg('explosion'), 900)
    setTimeout(() => setEasterEgg('revealed'), 1400)
  }

  const handleSubmit = async () => {
    const newErrors: FormErrors = {}

    if (!form.reportEmail || !form.reportEmail.trim()) {
      newErrors.reportEmail = 'Informe o e-mail para receber o relatório'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.reportEmail.trim())) {
      newErrors.reportEmail = 'Informe um e-mail válido'
    }

    if (enabled.jira) {
      if (!form.jiraBaseUrl.trim()) newErrors.jiraBaseUrl = 'Informe a URL base do Jira'
      if (!form.jiraEmail.trim()) newErrors.jiraEmail = 'Informe o e-mail do Jira'
      if (!form.jiraApiToken.trim()) newErrors.jiraApiToken = 'Informe o API Token do Jira'
      if (!form.jiraAccountId.trim()) newErrors.jiraAccountId = 'Informe o Account ID do Jira'
    }
    if (enabled.github && !form.githubToken.trim()) newErrors.githubToken = 'Informe o token do GitHub'
    if (enabled.slack && !form.slackToken.trim()) newErrors.slackToken = 'Informe o token do Slack'
    if (enabled.openai && !form.openaiToken.trim()) newErrors.openaiToken = 'Informe o token da OpenAI'

    const hasDataSource = enabled.jira || enabled.github || enabled.slack || enabled.google
    if (!hasDataSource) {
      addToast('Habilite pelo menos uma integração de dados (Jira, GitHub, Slack ou Google) para continuar.')
      return
    }

    if (enabled.google && !googleTokens) {
      addToast('O Google está habilitado mas você ainda não fez login. Clique em "Entrar com Google" antes de continuar.')
      return
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)

    try {
      const validationCalls: Promise<Response>[] = []
      const callKeys: string[] = []

      if (enabled.jira) {
        validationCalls.push(fetch('/api/validate/jira', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl: form.jiraBaseUrl,
            email: form.jiraEmail,
            apiToken: form.jiraApiToken,
            accountId: form.jiraAccountId,
          }),
        }))
        callKeys.push('jira')
      }
      if (enabled.github) {
        validationCalls.push(fetch('/api/validate/github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: form.githubToken }),
        }))
        callKeys.push('github')
      }
      if (enabled.slack) {
        validationCalls.push(fetch('/api/validate/slack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: form.slackToken }),
        }))
        callKeys.push('slack')
      }
      if (enabled.openai) {
        validationCalls.push(fetch('/api/validate/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: form.openaiToken }),
        }))
        callKeys.push('openai')
      }

      const responses = await Promise.all(validationCalls)
      const results = await Promise.all(responses.map((r) => r.json()))

      setIsLoading(false)

      const validationErrors: FormErrors = {}
      callKeys.forEach((key, i) => {
        if (!results[i].ok) {
          (validationErrors as Record<string, string>)[`${key}Group`] = results[i].message
        }
      })

      const allDataSourcesFailed =
        (!enabled.jira || !!validationErrors.jiraGroup) &&
        (!enabled.github || !!validationErrors.githubGroup) &&
        (!enabled.slack || !!validationErrors.slackGroup) &&
        (!enabled.google || !googleTokens)

      if (allDataSourcesFailed && (enabled.jira || enabled.github || enabled.slack)) {
        addToast('Nenhuma integração de dados foi validada com sucesso. Verifique as credenciais.')
        setErrors(validationErrors)
        return
      }

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors)
        return
      }

      setIsModalOpen(true)
    } catch (err) {
      setIsLoading(false)
      const message = err instanceof Error ? err.message : 'Erro inesperado ao validar as credenciais.'
      addToast(`Falha na validação: ${message}`)
    }
  }

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center px-3 sm:px-4 py-8 sm:py-12">
      <style>{`
        @keyframes bombWobble {
          0%,100% { transform: rotate(-8deg) scale(1.1); }
          25% { transform: rotate(8deg) scale(1.15); }
          50% { transform: rotate(-12deg) scale(1.2); }
          75% { transform: rotate(12deg) scale(1.1); }
        }
        @keyframes explode {
          0% { transform: scale(0.5); opacity: 0.5; }
          40% { transform: scale(2.2); opacity: 1; }
          70% { transform: scale(1.6); opacity: 1; }
          100% { transform: scale(1.8); opacity: 1; }
        }
        @keyframes revealText {
          0% { opacity: 0; transform: translateY(30px) scale(0.85); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .egg-bomb { animation: bombWobble 0.25s ease-in-out infinite; }
        .egg-explode { animation: explode 0.55s cubic-bezier(.22,1,.36,1) forwards; }
        .egg-reveal { animation: revealText 0.6s cubic-bezier(.22,1,.36,1) forwards; }
      `}</style>

      {easterEgg !== 'idle' && (
        <div
          onClick={() => setEasterEgg('idle')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
        >
          {easterEgg === 'fuse' && (
            <span className="egg-bomb select-none" style={{ fontSize: '7rem', lineHeight: 1 }}>💣</span>
          )}
          {easterEgg === 'explosion' && (
            <span className="egg-explode select-none" style={{ fontSize: '7rem', lineHeight: 1 }}>💥</span>
          )}
          {easterEgg === 'revealed' && (
            <div className="egg-reveal text-center select-none px-6">
              <div style={{ fontSize: '5rem', lineHeight: 1 }} className="mb-5">💥</div>
              <p className="text-2xl font-semibold text-slate-300 mb-1">Criado por</p>
              <p className="text-4xl font-extrabold text-yellow-400 tracking-tight">Felipi Trindade</p>
              <p className="text-xl font-bold text-orange-400 mt-1">(Bomber) 💣</p>
              <p className="text-xs text-slate-600 mt-8">Clique em qualquer lugar para fechar</p>
            </div>
          )}
        </div>
      )}

      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/25 mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1
            className="text-3xl font-bold text-white tracking-tight cursor-pointer select-none hover:text-yellow-300 transition-colors duration-150"
            onClick={handleEasterEgg}
            title="Daily Reports"
          >
            Daily Reports
          </h1>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-sm mx-auto">
            Configure suas integrações para gerar relatórios diários automaticamente
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <IntegrationCard
            logo={JIRA_LOGO}
            title="Jira"
            description="Rastreia suas tarefas e sprints"
            accentColor="blue"
            enabled={enabled.jira}
            onToggle={() => toggleIntegration('jira')}
            hasGroupError={!!errors.jiraGroup}
            groupError={errors.jiraGroup}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <InputField
                  id="jira-base-url"
                  label="URL Base"
                  placeholder="https://seu-dominio.atlassian.net"
                  value={form.jiraBaseUrl}
                  onChange={setField('jiraBaseUrl')}
                  onHelpClick={() => setHelpTopic('jira-base-url')}
                  error={errors.jiraBaseUrl}
                />
              </div>
              <InputField
                id="jira-email"
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                value={form.jiraEmail}
                onChange={setField('jiraEmail')}
                onHelpClick={() => setHelpTopic('jira-email')}
                error={errors.jiraEmail}
              />
              <InputField
                id="jira-account-id"
                label="Account ID"
                placeholder="712020:abc123..."
                value={form.jiraAccountId}
                onChange={setField('jiraAccountId')}
                onHelpClick={() => setHelpTopic('jira-account-id')}
                error={errors.jiraAccountId}
              />
              <div className="sm:col-span-2">
                <InputField
                  id="jira-api-token"
                  label="API Token"
                  type="password"
                  placeholder="ATATT3x..."
                  value={form.jiraApiToken}
                  onChange={setField('jiraApiToken')}
                  onHelpClick={() => setHelpTopic('jira-api-token')}
                  error={errors.jiraApiToken}
                />
              </div>
            </div>
          </IntegrationCard>

          <IntegrationCard
            logo={GITHUB_LOGO}
            title="GitHub"
            description="Monitora seus commits e pull requests"
            accentColor="slate"
            enabled={enabled.github}
            onToggle={() => toggleIntegration('github')}
            hasGroupError={!!errors.githubGroup}
            groupError={errors.githubGroup}
          >
            <InputField
              id="github-token"
              label="Personal Access Token"
              type="password"
              placeholder="ghp_..."
              value={form.githubToken}
              onChange={setField('githubToken')}
              onHelpClick={() => setHelpTopic('github-token')}
              error={errors.githubToken}
            />
          </IntegrationCard>

          <IntegrationCard
            logo={SLACK_LOGO}
            title="Slack"
            description="Analisa seus canais e mensagens"
            accentColor="green"
            enabled={enabled.slack}
            onToggle={() => toggleIntegration('slack')}
            hasGroupError={!!errors.slackGroup}
            groupError={errors.slackGroup}
          >
            <InputField
              id="slack-token"
              label="User Token"
              type="password"
              placeholder="xoxp-..."
              value={form.slackToken}
              onChange={setField('slackToken')}
              onHelpClick={() => setHelpTopic('slack-token')}
              error={errors.slackToken}
            />
          </IntegrationCard>

          <IntegrationCard
            logo={GOOGLE_LOGO}
            title="Google"
            description="Importa eventos do Calendar e chamadas do Meet"
            accentColor="amber"
            enabled={enabled.google}
            onToggle={() => toggleIntegration('google')}
            hasGroupError={false}
          >
            {googleTokens ? (
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-sm text-emerald-300 font-medium">{googleTokens.email}</span>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleDisconnect}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Desconectar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleAuthLoading}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {googleAuthLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Aguardando autorização...</>
                ) : (
                  <><LogIn className="w-4 h-4" /> Fazer login com Google</>
                )}
              </button>
            )}
          </IntegrationCard>

          <IntegrationCard
            logo={OPENAI_LOGO}
            title="OpenAI"
            description="Gera resumos executivos com inteligência artificial"
            accentColor="violet"
            enabled={enabled.openai}
            onToggle={() => toggleIntegration('openai')}
            hasGroupError={!!errors.openaiGroup}
            groupError={errors.openaiGroup}
          >
            <div className="flex flex-col gap-3">
              <InputField
                id="openai-token"
                label="API Key"
                type="password"
                placeholder="sk-..."
                value={form.openaiToken}
                onChange={setField('openaiToken')}
                onHelpClick={() => setHelpTopic('openai-token')}
                error={errors.openaiToken}
              />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="openai-instructions" className="text-xs font-medium text-slate-400">
                    Instruções para o resumo executivo
                  </label>
                  <span className="text-xs text-slate-500">{form.openaiInstructions.length}/800</span>
                </div>
                <textarea
                  id="openai-instructions"
                  rows={3}
                  maxLength={800}
                  placeholder="Ex: Foque nas tarefas técnicas e mencione os PRs revisados. Use tom formal. Destaque bloqueios e dependências entre times."
                  value={form.openaiInstructions}
                  onChange={(e) => setField('openaiInstructions')(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none transition-all focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 hover:border-slate-500 resize-none placeholder:text-slate-600"
                />
                <p className="text-xs text-slate-600">Opcional. Guia a IA sobre tom, foco e formato dos resumos diários.</p>
              </div>
            </div>
          </IntegrationCard>

          <div className={[
            'rounded-2xl border p-5 backdrop-blur-sm bg-slate-800/60',
            errors.reportEmail ? 'border-red-500/60 bg-red-500/5' : 'border-indigo-500/40',
          ].join(' ')}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg border border-indigo-500/30 bg-indigo-500/20 flex items-center justify-center">
                <Mail className="w-4 h-4 text-indigo-300" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Destinatário do relatório</h2>
                <p className="text-xs text-slate-400">O relatório será enviado para este e-mail</p>
              </div>
            </div>
            <InputField
              id="report-email"
              label="E-mail"
              type="email"
              placeholder="voce@email.com"
              value={form.reportEmail}
              onChange={setField('reportEmail')}
              onHelpClick={() => setHelpTopic('report-email')}
              error={errors.reportEmail}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-linear-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 mt-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validando credenciais...
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <button
            onClick={() => setIsStatusModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/40 hover:bg-slate-800/70 text-slate-400 hover:text-slate-200 text-sm font-medium transition-all duration-200 active:scale-[0.99]"
          >
            <Search className="w-4 h-4" />
            Consultar posição na fila
          </button>
        </div>
      </div>

      <SelectionsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        enabledIntegrations={enabled}
        reportEmail={form.reportEmail}
        googleTokens={googleTokens}
        credentials={{
          jiraBaseUrl: form.jiraBaseUrl,
          jiraEmail: form.jiraEmail,
          jiraApiToken: form.jiraApiToken,
          jiraAccountId: form.jiraAccountId,
          githubToken: form.githubToken,
          slackToken: form.slackToken,
          openaiToken: form.openaiToken,
          openaiInstructions: form.openaiInstructions,
        }}
      />
      <JobStatusModal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} />
      <HelpModal topic={helpTopic} onClose={() => setHelpTopic(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <footer className="mt-10 pb-6 text-center text-xs text-slate-600 flex items-center justify-center gap-4">
        <a href="/privacy" className="hover:text-slate-400 transition-colors">Política de Privacidade</a>
        <span>·</span>
        <a href="/terms" className="hover:text-slate-400 transition-colors">Termos de Serviço</a>
      </footer>
    </main>
  )
}

const accentMap = {
  blue: {
    border: 'border-blue-500/40',
    icon: 'bg-blue-500/20 border-blue-500/30',
    errorBorder: 'border-red-500/60',
    errorBg: 'bg-red-500/5',
  },
  slate: {
    border: 'border-slate-500/40',
    icon: 'bg-slate-500/20 border-slate-600/30',
    errorBorder: 'border-red-500/60',
    errorBg: 'bg-red-500/5',
  },
  green: {
    border: 'border-emerald-500/40',
    icon: 'bg-emerald-500/20 border-emerald-500/30',
    errorBorder: 'border-red-500/60',
    errorBg: 'bg-red-500/5',
  },
  violet: {
    border: 'border-violet-500/40',
    icon: 'bg-violet-500/20 border-violet-500/30',
    errorBorder: 'border-red-500/60',
    errorBg: 'bg-red-500/5',
  },
  amber: {
    border: 'border-amber-500/40',
    icon: 'bg-amber-500/20 border-amber-500/30',
    errorBorder: 'border-red-500/60',
    errorBg: 'bg-red-500/5',
  },
}

interface IntegrationCardProps {
  logo: React.ReactNode
  title: string
  description: string
  accentColor: keyof typeof accentMap
  enabled: boolean
  onToggle: () => void
  hasGroupError: boolean
  groupError?: string
  children: React.ReactNode
}

function IntegrationCard({
  logo,
  title,
  description,
  accentColor,
  enabled,
  onToggle,
  hasGroupError,
  groupError,
  children,
}: IntegrationCardProps) {
  const accent = accentMap[accentColor]

  return (
    <div
      className={[
        'rounded-2xl border p-5 backdrop-blur-sm transition-all duration-300',
        !enabled
          ? 'border-slate-700/50 bg-slate-900/40'
          : hasGroupError
          ? `${accent.errorBorder} ${accent.errorBg} bg-slate-800/80`
          : `${accent.border} bg-slate-800/60 hover:bg-slate-800/80`,
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-opacity duration-300 ${accent.icon} ${!enabled ? 'opacity-40' : ''}`}>
            {logo}
          </div>
          <div className={`transition-opacity duration-300 ${!enabled ? 'opacity-40' : ''}`}>
            <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={[
            'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none',
            enabled ? 'bg-blue-500' : 'bg-slate-600',
          ].join(' ')}
          aria-label={enabled ? 'Desativar integração' : 'Ativar integração'}
        >
          <span className={[
            'absolute top-0.5 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
            enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
          ].join(' ')} />
        </button>
      </div>
      <div className={`transition-all duration-300 ${!enabled ? 'opacity-30 pointer-events-none select-none' : ''}`}>
        {children}
        {groupError && (
          <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {groupError}
          </p>
        )}
      </div>
    </div>
  )
}
