'use client'

import { useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'

export interface ToastMessage {
  id: string
  message: string
  type: 'error' | 'warning'
}

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 6000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-800 border border-red-500/30 shadow-xl shadow-black/30 px-4 py-3 animate-in slide-in-from-bottom-2 fade-in duration-300">
      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
      <p className="text-sm text-slate-200 flex-1 leading-relaxed">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
