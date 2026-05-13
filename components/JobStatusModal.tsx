'use client'

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useState, useEffect } from 'react'
import { X, Search, Loader2, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react'

interface JobStatusModalProps {
  isOpen: boolean
  onClose: () => void
}

type StatusResult =
  | { status: 'pending'; queueDepth: number | null; queuedAt: number; message?: string }
  | { status: 'not_found'; message: string }

export function JobStatusModal({ isOpen, onClose }: JobStatusModalProps) {
  const [jobId, setJobId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<StatusResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setJobId('')
      setResult(null)
      setError(null)
    }
  }, [isOpen])

  const handleCheck = async () => {
    if (!jobId.trim()) {
      setError('Informe o Job ID.')
      return
    }
    setError(null)
    setResult(null)
    setIsLoading(true)

    try {
      const res = await fetch(`/api/report/status?jobId=${encodeURIComponent(jobId.trim())}`)
      const data = await res.json()

      if (!data.ok) {
        setError(data.message ?? 'Erro ao consultar.')
        return
      }

      setResult(data as StatusResult)
    } catch {
      setError('Falha de conexão ao consultar o status.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCheck()
  }

  const queuedAgo = result?.status === 'pending'
    ? Math.round((Date.now() - result.queuedAt) / 60000)
    : null

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4">
        <DialogPanel className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-slate-800 border-t sm:border border-slate-700 shadow-2xl">
          <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-4 border-b border-slate-700">
            <div>
              <DialogTitle className="text-base font-semibold text-slate-100">
                Consultar posição na fila
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">Insira o Job ID recebido ao gerar o relatório</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 sm:px-6 py-5 flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={jobId}
                onChange={(e) => {
                  setJobId(e.target.value)
                  if (error) setError(null)
                  if (result) setResult(null)
                }}
                onKeyDown={handleKeyDown}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="flex-1 min-w-0 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 hover:border-slate-500 font-mono"
              />
              <button
                onClick={handleCheck}
                disabled={isLoading}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {isLoading ? 'Consultando...' : 'Consultar'}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            {result?.status === 'pending' && (
              <div className="flex flex-col gap-3 rounded-xl border border-blue-500/25 bg-blue-500/5 px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-200">Job encontrado na fila</span>
                </div>

                {result.queueDepth !== null ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-3 text-center">
                      <p className="text-2xl font-bold text-slate-100">{result.queueDepth}</p>
                      <p className="text-xs text-slate-500 mt-0.5">mensagens na fila</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-2xl font-bold text-slate-100">{queuedAgo}m</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">na fila há</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">{result.message}</p>
                )}

                <button
                  onClick={handleCheck}
                  className="flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Atualizar
                </button>
              </div>
            )}

            {result?.status === 'not_found' && (
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-600/40 bg-slate-900/40 px-4 py-4">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-300">Job não encontrado</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{result.message}</p>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 sm:px-6 pb-5 sm:pb-4 safe-area-inset-bottom">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-all duration-200 active:scale-95"
            >
              Fechar
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
