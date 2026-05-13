'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { InputField } from '@/components/InputField'
import { SelectionsModal } from '@/components/SelectionsModal'
import { ToastContainer, ToastMessage } from '@/components/Toast'

interface FormState {
  jiraBaseUrl: string
  jiraEmail: string
  jiraApiToken: string
  jiraAccountId: string
  githubToken: string
  slackToken: string
  openaiToken: string
}

interface FormErrors {
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

const STORAGE_KEY = 'daily-reports-config'

const defaultForm: FormState = {
  jiraBaseUrl: '',
  jiraEmail: '',
  jiraApiToken: '',
  jiraAccountId: '',
  githubToken: '',
  slackToken: '',
  openaiToken: '',
}

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

export default function SetupPage() {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (message: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type: 'error' }])
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  useEffect(() => {
    setForm(loadFromStorage())
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
  }, [form])

  const setField = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async () => {
    const newErrors: FormErrors = {}

    if (!form.jiraBaseUrl.trim()) newErrors.jiraBaseUrl = 'Informe a URL base do Jira'
    if (!form.jiraEmail.trim()) newErrors.jiraEmail = 'Informe o e-mail do Jira'
    if (!form.jiraApiToken.trim()) newErrors.jiraApiToken = 'Informe o API Token do Jira'
    if (!form.jiraAccountId.trim()) newErrors.jiraAccountId = 'Informe o Account ID do Jira'
    if (!form.githubToken.trim()) newErrors.githubToken = 'Informe o token do GitHub'
    if (!form.slackToken.trim()) newErrors.slackToken = 'Informe o token do Slack'
    if (!form.openaiToken.trim()) newErrors.openaiToken = 'Informe o token da OpenAI'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)

    try {
      const [jiraRes, githubRes, slackRes, openaiRes] = await Promise.all([
        fetch('/api/validate/jira', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl: form.jiraBaseUrl,
            email: form.jiraEmail,
            apiToken: form.jiraApiToken,
            accountId: form.jiraAccountId,
          }),
        }),
        fetch('/api/validate/github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: form.githubToken }),
        }),
        fetch('/api/validate/slack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: form.slackToken }),
        }),
        fetch('/api/validate/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: form.openaiToken }),
        }),
      ])

      const [jiraData, githubData, slackData, openaiData] = await Promise.all([
        jiraRes.json(),
        githubRes.json(),
        slackRes.json(),
        openaiRes.json(),
      ])

      setIsLoading(false)

      const validationErrors: FormErrors = {}

      if (!jiraData.ok) validationErrors.jiraGroup = jiraData.message
      if (!githubData.ok) validationErrors.githubGroup = githubData.message
      if (!slackData.ok) validationErrors.slackGroup = slackData.message
      if (!openaiData.ok) validationErrors.openaiGroup = openaiData.message

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
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/25 mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Daily Reports</h1>
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
                  tooltip="A URL base do seu workspace no Jira. Acesse app.atlassian.com, clique no seu workspace e copie o domínio no formato: https://seu-dominio.atlassian.net"
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
                tooltip="O e-mail associado à sua conta Atlassian. É o mesmo e-mail usado para fazer login no Jira."
                error={errors.jiraEmail}
              />
              <InputField
                id="jira-account-id"
                label="Account ID"
                placeholder="712020:abc123..."
                value={form.jiraAccountId}
                onChange={setField('jiraAccountId')}
                tooltip="Seu ID de usuário único no Atlassian. Acesse: Perfil → Manage account → em seguida veja a URL no formato /people/{accountId}, ou peça ao admin do Jira."
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
                  tooltip="Token de API para autenticação. Acesse: id.atlassian.com/manage-profile/security/api-tokens → clique em 'Create API token', dê um nome e copie o token gerado."
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
              tooltip="Token de acesso pessoal do GitHub. Acesse: github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token. Selecione os escopos: repo, read:user, read:org."
              error={errors.githubToken}
            />
          </IntegrationCard>

          <IntegrationCard
            logo={SLACK_LOGO}
            title="Slack"
            description="Envia relatórios no canal configurado"
            accentColor="green"
            hasGroupError={!!errors.slackGroup}
            groupError={errors.slackGroup}
          >
            <InputField
              id="slack-token"
              label="Bot Token"
              type="password"
              placeholder="xoxb-..."
              value={form.slackToken}
              onChange={setField('slackToken')}
              tooltip="Token do bot do Slack. Acesse: api.slack.com/apps → crie ou selecione seu app → OAuth & Permissions → Bot Token Scopes (adicione chat:write, channels:read, groups:read) → Install App → copie o 'Bot User OAuth Token' (começa com xoxb-)."
              error={errors.slackToken}
            />
          </IntegrationCard>

          <IntegrationCard
            logo={OPENAI_LOGO}
            title="OpenAI"
            description="Gera o relatório com inteligência artificial"
            accentColor="violet"
            hasGroupError={!!errors.openaiGroup}
            groupError={errors.openaiGroup}
          >
            <InputField
              id="openai-token"
              label="API Key"
              type="password"
              placeholder="sk-..."
              value={form.openaiToken}
              onChange={setField('openaiToken')}
              tooltip="Sua chave de API da OpenAI. Acesse: platform.openai.com/api-keys → clique em 'Create new secret key', dê um nome, copie a chave gerada (começa com sk-). Guarde em lugar seguro, ela não será exibida novamente."
              error={errors.openaiToken}
            />
          </IntegrationCard>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 mt-1"
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
        </div>
      </div>

      <SelectionsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        credentials={{
          jiraBaseUrl: form.jiraBaseUrl,
          jiraEmail: form.jiraEmail,
          jiraApiToken: form.jiraApiToken,
          githubToken: form.githubToken,
          slackToken: form.slackToken,
        }}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
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
}

interface IntegrationCardProps {
  logo: React.ReactNode
  title: string
  description: string
  accentColor: keyof typeof accentMap
  hasGroupError: boolean
  groupError?: string
  children: React.ReactNode
}

function IntegrationCard({
  logo,
  title,
  description,
  accentColor,
  hasGroupError,
  groupError,
  children,
}: IntegrationCardProps) {
  const accent = accentMap[accentColor]

  return (
    <div
      className={[
        'rounded-2xl border p-5 backdrop-blur-sm transition-all duration-200',
        hasGroupError
          ? `${accent.errorBorder} ${accent.errorBg} bg-slate-800/80`
          : `${accent.border} bg-slate-800/60 hover:bg-slate-800/80`,
      ].join(' ')}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${accent.icon}`}>
          {logo}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
      </div>
      {children}
      {groupError && (
        <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {groupError}
        </p>
      )}
    </div>
  )
}
