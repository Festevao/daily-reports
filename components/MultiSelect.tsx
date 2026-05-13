'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Check, X, Lock } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  sublabel?: string
  avatarUrl?: string
  avatarFallback?: string
  isPrivate?: boolean
}

interface MultiSelectProps {
  options: SelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  isLoading?: boolean
  error?: string
  maxHeight?: number
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Selecionar...',
  isLoading = false,
  error,
  maxHeight = 240,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      (o.sublabel?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const removeChip = (value: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selected.filter((v) => v !== value))
  }

  const selectedOptions = options.filter((o) => selected.includes(o.value))
  const MAX_VISIBLE_CHIPS = 2
  const visibleChips = selectedOptions.slice(0, MAX_VISIBLE_CHIPS)
  const hiddenCount = selectedOptions.length - MAX_VISIBLE_CHIPS

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => { setIsOpen((v) => !v); setSearch('') }}
        className={[
          'w-full min-h-[42px] rounded-lg border bg-slate-800/60 px-3 py-2 text-left text-sm',
          'flex items-center justify-between gap-2 outline-none transition-all duration-200',
          'focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500',
          error
            ? 'border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
            : 'border-slate-600 hover:border-slate-500',
        ].join(' ')}
      >
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0 overflow-hidden">
          {selectedOptions.length === 0 ? (
            <span className="text-slate-500 truncate">{isLoading ? 'Carregando...' : placeholder}</span>
          ) : (
            <>
              {visibleChips.map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium shrink-0"
                >
                  {opt.avatarUrl ? (
                    <img src={opt.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
                  ) : opt.avatarFallback ? (
                    <span className="w-3.5 h-3.5 rounded-sm bg-slate-600 flex items-center justify-center text-[8px] font-bold text-slate-300">
                      {opt.avatarFallback}
                    </span>
                  ) : null}
                  <span className="max-w-24 truncate">{opt.label}</span>
                  <button
                    type="button"
                    onClick={(e) => removeChip(opt.value, e)}
                    className="text-blue-400 hover:text-blue-200 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {hiddenCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-700 border border-slate-600 text-slate-400 text-xs font-medium shrink-0">
                  +{hiddenCount}
                </span>
              )}
            </>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl border border-slate-600 bg-slate-800 shadow-xl shadow-black/30 overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-900/60">
              <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
              />
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400 text-sm gap-2">
                <div className="w-4 h-4 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
                Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
                Nenhum resultado encontrado
              </div>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={[
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      isSelected
                        ? 'bg-blue-500/10 text-slate-100'
                        : 'text-slate-300 hover:bg-slate-700/60',
                    ].join(' ')}
                  >
                    <div className="w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors"
                      style={{
                        borderColor: isSelected ? 'rgb(59 130 246 / 0.8)' : 'rgb(71 85 105)',
                        backgroundColor: isSelected ? 'rgb(59 130 246 / 0.2)' : 'transparent',
                      }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-blue-400" />}
                    </div>

                    {opt.avatarUrl ? (
                      <img src={opt.avatarUrl} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                    ) : opt.avatarFallback ? (
                      <span className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                        {opt.avatarFallback}
                      </span>
                    ) : null}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{opt.label}</span>
                        {opt.isPrivate && <Lock className="w-3 h-3 text-slate-500 shrink-0" />}
                      </div>
                      {opt.sublabel && (
                        <span className="text-xs text-slate-500 truncate block">{opt.sublabel}</span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="p-2 border-t border-slate-700 flex justify-between items-center">
            <span className="text-xs text-slate-400">
              {selected.length > 0
                ? `${selected.length} selecionado${selected.length !== 1 ? 's' : ''}`
                : `${filtered.length} opç${filtered.length !== 1 ? 'ões' : 'ão'}`}
            </span>
            <div className="flex items-center gap-3">
              {options.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allValues = options.map((o) => o.value)
                    const allSelected = allValues.every((v) => selected.includes(v))
                    onChange(allSelected ? [] : allValues)
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  {options.every((o) => selected.includes(o.value)) ? 'Desmarcar tudo' : 'Selecionar tudo'}
                </button>
              )}
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}
