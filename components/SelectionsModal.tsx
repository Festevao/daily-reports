'use client'

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useState, useEffect, useMemo } from 'react'
import {
  ArrowRight, X, Calendar, Loader2, AlertCircle,
  Layers, GitBranch, Hash,
} from 'lucide-react'
import { MultiSelect, SelectOption } from './MultiSelect'

export interface ModalCredentials {
  jiraBaseUrl: string
  jiraEmail: string
  jiraApiToken: string
  githubToken: string
  slackToken: string
}

interface SelectionsModalProps {
  isOpen: boolean
  onClose: () => void
  credentials: ModalCredentials
}

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

function useFetch<T>(isOpen: boolean, url: string, body: object): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: false, error: null })

  useEffect(() => {
    if (!isOpen) return
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
  }, [isOpen])

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

export function SelectionsModal({ isOpen, onClose, credentials }: SelectionsModalProps) {
  const [selectedJiraProjects, setSelectedJiraProjects] = useState<string[]>([])
  const [selectedGithubOrgs, setSelectedGithubOrgs] = useState<string[]>([])
  const [selectedGithubRepos, setSelectedGithubRepos] = useState<string[]>([])
  const [selectedSlackChannels, setSelectedSlackChannels] = useState<string[]>([])
  const [slackIncludeDms, setSlackIncludeDms] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const jira = useFetch<{ projects: { id: string; key: string; name: string; avatarUrl: string }[] }>(
    isOpen,
    '/api/jira/projects',
    { baseUrl: credentials.jiraBaseUrl, email: credentials.jiraEmail, apiToken: credentials.jiraApiToken }
  )

  const githubOrgs = useFetch<{ orgs: { login: string; id: number; avatarUrl: string }[] }>(
    isOpen,
    '/api/github/orgs',
    { token: credentials.githubToken }
  )

  const githubRepos = useFetch<{ repos: { id: number; name: string; fullName: string; ownerLogin: string; ownerAvatarUrl: string; isPrivate: boolean }[] }>(
    isOpen,
    '/api/github/repos',
    { token: credentials.githubToken }
  )

  const slack = useFetch<{ channels: { id: string; name: string; isPrivate: boolean; numMembers: number }[] }>(
    isOpen,
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

  useEffect(() => {
    const validRepos = selectedGithubRepos.filter((r) =>
      repoOptions.some((o) => o.value === r)
    )
    if (validRepos.length !== selectedGithubRepos.length) {
      setSelectedGithubRepos(validRepos)
    }
  }, [repoOptions, selectedGithubRepos])

  const slackOptions = useMemo<SelectOption[]>(() =>
    (slack.data?.channels ?? []).map((c) => ({
      value: c.id,
      label: `#${c.name}`,
      sublabel: c.numMembers > 0 ? `${c.numMembers} membros` : undefined,
      isPrivate: c.isPrivate,
    })), [slack.data])

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4">
        <DialogPanel className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl bg-slate-800 border-t sm:border border-slate-700 shadow-2xl">
          <div className="flex items-center justify-between px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-700">
            <div>
              <DialogTitle className="text-base font-semibold text-slate-100">
                Configurar relatório
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">Selecione os espaços, repositórios, canais e período</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-5 sm:gap-6 overflow-y-auto" style={{ maxHeight: 'min(65vh, calc(100svh - 10rem))' }}>
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
                  onChange={setSelectedJiraProjects}
                  placeholder="Selecionar projetos..."
                  isLoading={jira.loading}
                />
              )}
            </div>

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
                      onChange={setSelectedGithubOrgs}
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
                      onChange={setSelectedGithubRepos}
                      placeholder={
                        githubOrgs.loading || githubRepos.loading
                          ? 'Carregando...'
                          : selectedGithubOrgs.length === 0
                          ? 'Selecione uma org primeiro...'
                          : 'Selecionar repositórios...'
                      }
                      isLoading={githubOrgs.loading || githubRepos.loading}
                    />
                  )}
                </div>
              </div>
            </div>

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
                  onChange={setSelectedSlackChannels}
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
                  onChange={(e) => setSlackIncludeDms(e.target.checked)}
                  className="sr-only"
                />
                <span className="text-sm text-slate-300">Analisar chats 1:1</span>
              </label>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader
                icon={<Calendar className="w-3.5 h-3.5 text-violet-400" />}
                title="Período"
                color="border-violet-500/30"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-400">Data de início</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition-all focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 hover:border-slate-500 scheme-dark"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-400">Data de fim</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition-all focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 hover:border-slate-500 scheme-dark"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-slate-700 flex items-center justify-between safe-area-inset-bottom">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {(jira.loading || githubOrgs.loading || githubRepos.loading || slack.loading) && (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Buscando dados...
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95"
            >
              Continuar
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
