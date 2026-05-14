'use client'

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useState, useEffect, useMemo } from 'react'
import {
  X, Calendar, Loader2, AlertCircle,
  Layers, GitBranch, Hash, CheckCircle2, Copy, Check,
} from 'lucide-react'
import { MultiSelect, SelectOption } from './MultiSelect'

export interface ModalCredentials {
  jiraBaseUrl: string
  jiraEmail: string
  jiraApiToken: string
  jiraAccountId: string
  githubToken: string
  slackToken: string
  openaiToken: string
  openaiInstructions: string
}

export interface EnabledIntegrations {
  jira: boolean
  github: boolean
  slack: boolean
  openai: boolean
  google: boolean
}

interface SelectionsModalProps {
  isOpen: boolean
  onClose: () => void
  credentials: ModalCredentials
  enabledIntegrations: EnabledIntegrations
  reportEmail: string
  googleTokens?: { accessToken: string; refreshToken: string; email: string } | null
}

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface ModalValidationErrors {
  jira?: string
  github?: string
  slack?: string
  period?: string
}

interface JobResult {
  jobId: string
  position: number
}

function useFetch<T>(isOpen: boolean, enabled: boolean, url: string, body: object): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: false, error: null })

  useEffect(() => {
    if (!isOpen || !enabled) {
      setState({ data: null, loading: false, error: null })
      return
    }
    setState({ data: null, loading: true, error: null })

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setState({ data: json, loading: false, error: null })
        } else {
          setState({ data: null, loading: false, error: json.message ?? 'Erro desconhecido.' })
        }
      })
      .catch((err) => {
        setState({ data: null, loading: false, error: err.message ?? 'Erro de rede.' })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, enabled])

  return state
}

function SectionHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div className={`flex items-center gap-2.5 pb-3 border-b ${color}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color.replace('border-', 'bg-').replace('/30', '/20')}`}>
        {icon}
      </div>
      <span className="text-sm font-semibold text-slate-200">{title}</span>
    </div>
  )
}

function FetchError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      {message}
    </div>
  )
}

function ValidationError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      {message}
    </div>
  )
}

export function SelectionsModal({
  isOpen,
  onClose,
  credentials,
  enabledIntegrations,
  reportEmail,
  googleTokens,
}: SelectionsModalProps) {
  const [selectedJiraProjects, setSelectedJiraProjects] = useState<string[]>([])
  const [selectedGithubOrgs, setSelectedGithubOrgs] = useState<string[]>([])
  const [selectedGithubRepos, setSelectedGithubRepos] = useState<string[]>([])
  const [selectedSlackChannels, setSelectedSlackChannels] = useState<string[]>([])
  const [slackIncludeDms, setSlackIncludeDms] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activePreset, setActivePreset] = useState<number | null>(null)
  const [validationErrors, setValidationErrors] = useState<ModalValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [jobResult, setJobResult] = useState<JobResult | null>(null)
  const [copied, setCopied] = useState(false)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const applyPreset = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - (days - 1))
    setEndDate(end.toISOString().slice(0, 10))
    setStartDate(start.toISOString().slice(0, 10))
    setActivePreset(days)
    setValidationErrors((p) => ({ ...p, period: undefined }))
  }

  useEffect(() => {
    if (!isOpen) {
      setValidationErrors({})
      setSubmitError(null)
      setJobResult(null)
      setCopied(false)
      setActivePreset(null)
      return
    }
  }, [isOpen])

  const jira = useFetch<{ projects: { id: string; key: string; name: string; avatarUrl: string }[] }>(
    isOpen,
    enabledIntegrations.jira,
    '/api/jira/projects',
    { baseUrl: credentials.jiraBaseUrl, email: credentials.jiraEmail, apiToken: credentials.jiraApiToken }
  )

  const githubOrgs = useFetch<{ orgs: { login: string; id: number; avatarUrl: string }[] }>(
    isOpen,
    enabledIntegrations.github,
    '/api/github/orgs',
    { token: credentials.githubToken }
  )

  const githubRepos = useFetch<{ repos: { id: number; name: string; fullName: string; ownerLogin: string; ownerAvatarUrl: string; isPrivate: boolean }[] }>(
    isOpen,
    enabledIntegrations.github,
    '/api/github/repos',
    { token: credentials.githubToken }
  )

  const slack = useFetch<{ channels: { id: string; name: string; isPrivate: boolean; numMembers: number }[] }>(
    isOpen,
    enabledIntegrations.slack,
    '/api/slack/channels',
    { token: credentials.slackToken }
  )

  const jiraOptions = useMemo<SelectOption[]>(() =>
    (jira.data?.projects ?? []).map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: p.key,
      avatarFallback: p.key.slice(0, 2),
    })), [jira.data])

  const orgOptions = useMemo<SelectOption[]>(() =>
    (githubOrgs.data?.orgs ?? []).map((o) => ({
      value: o.login,
      label: o.login,
      avatarUrl: o.avatarUrl,
    })), [githubOrgs.data])

  const repoOptions = useMemo<SelectOption[]>(() => {
    const allRepos = githubRepos.data?.repos ?? []
    const filtered = selectedGithubOrgs.length > 0
      ? allRepos.filter((r) => selectedGithubOrgs.includes(r.ownerLogin))
      : allRepos
    return filtered.map((r) => ({
      value: r.fullName,
      label: r.name,
      sublabel: r.ownerLogin,
      avatarUrl: r.ownerAvatarUrl,
      isPrivate: r.isPrivate,
    }))
  }, [githubRepos.data, selectedGithubOrgs])

  const handleOrgChange = (orgs: string[]) => {
    setSelectedGithubOrgs(orgs)
    if (orgs.length > 0) {
      const allRepos = githubRepos.data?.repos ?? []
      setSelectedGithubRepos((prev) =>
        prev.filter((fullName) => {
          const repo = allRepos.find((r) => r.fullName === fullName)
          return repo !== undefined && orgs.includes(repo.ownerLogin)
        })
      )
    }
  }

  const slackOptions = useMemo<SelectOption[]>(() =>
    (slack.data?.channels ?? []).map((c) => ({
      value: c.id,
      label: `#${c.name}`,
      sublabel: c.numMembers > 0 ? `${c.numMembers} membros` : undefined,
      isPrivate: c.isPrivate,
    })), [slack.data])

  const payload = useMemo(() => {
    const result: Record<string, unknown> = {
      reportEmail,
      period: { startDate: startDate || null, endDate: endDate || null },
      integrations: {},
    }
    const integrations = result.integrations as Record<string, unknown>

    if (enabledIntegrations.jira) {
      integrations.jira = {
        credentials: {
          baseUrl: credentials.jiraBaseUrl,
          email: credentials.jiraEmail,
          apiToken: credentials.jiraApiToken,
          accountId: credentials.jiraAccountId,
        },
        projectIds: selectedJiraProjects,
      }
    }
    if (enabledIntegrations.github) {
      integrations.github = {
        token: credentials.githubToken,
        orgLogins: selectedGithubOrgs,
        repoFullNames: selectedGithubRepos,
      }
    }
    if (enabledIntegrations.slack) {
      integrations.slack = {
        token: credentials.slackToken,
        channelIds: selectedSlackChannels,
        includeDirectMessages: slackIncludeDms,
      }
    }
    if (enabledIntegrations.openai) {
      integrations.openai = {
        apiKey: credentials.openaiToken,
        customInstructions: credentials.openaiInstructions || undefined,
      }
    }
    if (enabledIntegrations.google && googleTokens) {
      integrations.google = {
        accessToken: googleTokens.accessToken,
        refreshToken: googleTokens.refreshToken,
      }
    }

    return result
  }, [
    reportEmail,
    startDate, endDate,
    credentials, enabledIntegrations,
    selectedJiraProjects, selectedGithubOrgs, selectedGithubRepos,
    selectedSlackChannels, slackIncludeDms, googleTokens,
  ])

  const handleSubmit = async () => {
    const errors: ModalValidationErrors = {}

    if (enabledIntegrations.jira && selectedJiraProjects.length === 0) {
      errors.jira = 'Selecione pelo menos um projeto do Jira'
    }
    if (enabledIntegrations.github && selectedGithubRepos.length === 0) {
      errors.github = 'Selecione pelo menos um repositório do GitHub'
    }
    if (enabledIntegrations.slack && selectedSlackChannels.length === 0 && !slackIncludeDms) {
      errors.slack = 'Selecione pelo menos um canal ou ative "Analisar chats 1:1"'
    }
    if (!startDate || !endDate) {
      errors.period = 'Selecione a data de início e a data de fim'
    } else if (startDate > endDate) {
      errors.period = 'A data de início não pode ser posterior à data de fim'
    } else {
      const diffDays = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1
      if (diffDays > 60) errors.period = 'O período máximo permitido é de 60 dias'
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors({})
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/report/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!data.ok) {
        setSubmitError(data.message ?? 'Erro ao publicar na fila.')
        return
      }

      setJobResult({ jobId: data.jobId, position: data.position })
    } catch {
      setSubmitError('Falha de conexão ao tentar publicar na fila. Verifique se o RabbitMQ está disponível.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyJobId = async () => {
    if (!jobResult) return
    await navigator.clipboard.writeText(jobResult.jobId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isAnyLoading = jira.loading || githubOrgs.loading || githubRepos.loading || slack.loading

  return (
    <Dialog open={isOpen} onClose={jobResult ? () => {} : onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4">
        <DialogPanel className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl bg-slate-800 border-t sm:border border-slate-700 shadow-2xl">
          <div className="flex items-center justify-between px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-700">
            <div>
              <DialogTitle className="text-base font-semibold text-slate-100">
                {jobResult ? 'Relatório enfileirado!' : 'Configurar relatório'}
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                {jobResult
                  ? `Você receberá em ${reportEmail}`
                  : 'Selecione os espaços, repositórios, canais e período'}
              </p>
            </div>
            {!jobResult && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {jobResult ? (
            <div className="px-4 sm:px-6 py-8 flex flex-col items-center gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">
                  Seu relatório foi adicionado à fila e será processado em breve.
                </p>
                <p className="text-xs text-slate-500 mt-1">Posição na fila: <span className="text-slate-300 font-semibold">#{jobResult.position}</span></p>
              </div>
              <div className="w-full bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-left">
                <p className="text-xs text-slate-500 mb-2">Job ID — use para rastrear sua mensagem na fila</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-slate-200 font-mono break-all leading-relaxed">{jobResult.jobId}</code>
                  <button
                    type="button"
                    onClick={handleCopyJobId}
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                    title="Copiar Job ID"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-all duration-200 active:scale-95"
              >
                Fechar
              </button>
            </div>
          ) : (
            <>
              <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-5 sm:gap-6 overflow-y-auto" style={{ maxHeight: 'min(65vh, calc(100svh - 10rem))' }}>

                {enabledIntegrations.jira && (
                  <div className="flex flex-col gap-3">
                    <SectionHeader
                      icon={<Layers className="w-3.5 h-3.5 text-blue-400" />}
                      title="Jira — Projetos"
                      color="border-blue-500/30"
                    />
                    {jira.error ? (
                      <FetchError message={jira.error} />
                    ) : (
                      <MultiSelect
                        options={jiraOptions}
                        selected={selectedJiraProjects}
                        onChange={(v) => {
                          setSelectedJiraProjects(v)
                          if (validationErrors.jira) setValidationErrors((p) => ({ ...p, jira: undefined }))
                        }}
                        placeholder="Selecionar projetos..."
                        isLoading={jira.loading}
                      />
                    )}
                    {validationErrors.jira && <ValidationError message={validationErrors.jira} />}
                  </div>
                )}

                {enabledIntegrations.github && (
                  <div className="flex flex-col gap-3">
                    <SectionHeader
                      icon={<GitBranch className="w-3.5 h-3.5 text-slate-300" />}
                      title="GitHub — Organizações & Repositórios"
                      color="border-slate-500/30"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-slate-400">Organizações</span>
                        {githubOrgs.error ? (
                          <FetchError message={githubOrgs.error} />
                        ) : (
                          <MultiSelect
                            options={orgOptions}
                            selected={selectedGithubOrgs}
                            onChange={handleOrgChange}
                            placeholder="Selecionar orgs..."
                            isLoading={githubOrgs.loading}
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-slate-400">
                          Repositórios
                          {selectedGithubOrgs.length > 0 && (
                            <span className="ml-1 text-slate-500">(filtrado por org)</span>
                          )}
                        </span>
                        {githubRepos.error ? (
                          <FetchError message={githubRepos.error} />
                        ) : (
                          <MultiSelect
                            options={repoOptions}
                            selected={selectedGithubRepos}
                            onChange={(v) => {
                              setSelectedGithubRepos(v)
                              if (validationErrors.github) setValidationErrors((p) => ({ ...p, github: undefined }))
                            }}
                            placeholder={
                              githubOrgs.loading || githubRepos.loading
                                ? 'Carregando...'
                                : selectedGithubOrgs.length === 0
                                ? 'Todos os repositórios...'
                                : 'Selecionar repositórios...'
                            }
                            isLoading={githubOrgs.loading || githubRepos.loading}
                          />
                        )}
                      </div>
                    </div>
                    {validationErrors.github && <ValidationError message={validationErrors.github} />}
                  </div>
                )}

                {enabledIntegrations.slack && (
                  <div className="flex flex-col gap-3">
                    <SectionHeader
                      icon={<Hash className="w-3.5 h-3.5 text-emerald-400" />}
                      title="Slack — Canais"
                      color="border-emerald-500/30"
                    />
                    {slack.error ? (
                      <FetchError message={slack.error} />
                    ) : (
                      <MultiSelect
                        options={slackOptions}
                        selected={selectedSlackChannels}
                        onChange={(v) => {
                          setSelectedSlackChannels(v)
                          if (validationErrors.slack) setValidationErrors((p) => ({ ...p, slack: undefined }))
                        }}
                        placeholder="Selecionar canais..."
                        isLoading={slack.loading}
                      />
                    )}
                    <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
                      <div
                        className={[
                          'w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0',
                          slackIncludeDms
                            ? 'bg-emerald-500/20 border-emerald-500/70'
                            : 'bg-slate-800 border-slate-600',
                        ].join(' ')}
                      >
                        {slackIncludeDms && (
                          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={slackIncludeDms}
                        onChange={(e) => {
                          setSlackIncludeDms(e.target.checked)
                          if (validationErrors.slack) setValidationErrors((p) => ({ ...p, slack: undefined }))
                        }}
                        className="sr-only"
                      />
                      <span className="text-sm text-slate-300">Analisar chats 1:1</span>
                    </label>
                    {validationErrors.slack && <ValidationError message={validationErrors.slack} />}
                  </div>
                )}


                <div className="flex flex-col gap-3">
                  <SectionHeader
                    icon={<Calendar className="w-3.5 h-3.5 text-violet-400" />}
                    title="Período"
                    color="border-violet-500/30"
                  />

                  <div className="flex flex-wrap gap-2">
                    {([
                      { label: 'Hoje', days: 1 },
                      { label: '15 dias', days: 15 },
                      { label: '30 dias', days: 30 },
                      { label: '60 dias', days: 60 },
                    ] as const).map(({ label, days }) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => applyPreset(days)}
                        className={[
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150',
                          activePreset === days
                            ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                            : 'bg-slate-900/60 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 transition-opacity ${activePreset !== null ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-slate-400">Data de início</span>
                      <input
                        type="date"
                        value={startDate}
                        max={today}
                        disabled={activePreset !== null}
                        onChange={(e) => {
                          setActivePreset(null)
                          setStartDate(e.target.value)
                          if (validationErrors.period) setValidationErrors((p) => ({ ...p, period: undefined }))
                        }}
                        className="w-full rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition-all focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 hover:border-slate-500 scheme-dark disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-slate-400">Data de fim</span>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        max={today}
                        disabled={activePreset !== null}
                        onChange={(e) => {
                          setActivePreset(null)
                          setEndDate(e.target.value)
                          if (validationErrors.period) setValidationErrors((p) => ({ ...p, period: undefined }))
                        }}
                        className="w-full rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition-all focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 hover:border-slate-500 scheme-dark disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {activePreset !== null && (
                    <button
                      type="button"
                      onClick={() => setActivePreset(null)}
                      className="text-xs text-slate-500 hover:text-slate-400 self-start transition-colors"
                    >
                      Ou inserir período personalizado →
                    </button>
                  )}

                  {validationErrors.period && <ValidationError message={validationErrors.period} />}
                </div>

              </div>

              <div className="px-4 sm:px-6 py-4 border-t border-slate-700 flex flex-col gap-3 safe-area-inset-bottom">
                {submitError && (
                  <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {submitError}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {isAnyLoading && (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Buscando dados...
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isAnyLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Gerar Relatório'
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
