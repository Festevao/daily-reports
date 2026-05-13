'use client'

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useState } from 'react'
import { Calendar, X, ArrowRight } from 'lucide-react'

interface DateRangeModalProps {
  isOpen: boolean
  onClose: () => void
}

export function DateRangeModal({ isOpen, onClose }: DateRangeModalProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-slate-100">
                  Período do relatório
                </DialogTitle>
                <p className="text-xs text-slate-400 mt-0.5">Selecione o intervalo de datas</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Data de início</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition-all focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 hover:border-slate-500 [color-scheme:dark]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Data de fim</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition-all focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 hover:border-slate-500 [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
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
