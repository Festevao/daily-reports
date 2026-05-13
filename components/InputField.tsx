'use client'

import { useState } from 'react'
import { Eye, EyeOff, Info } from 'lucide-react'

interface InputFieldProps {
  id: string
  label: string
  type?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  tooltip?: string
  onHelpClick?: () => void
  error?: string
}

export function InputField({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  onHelpClick,
  error,
}: InputFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword ? (isVisible ? 'text' : 'password') : type

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-slate-300">
          {label}
        </label>
        {onHelpClick && (
          <button
            type="button"
            onClick={onHelpClick}
            className="text-slate-500 hover:text-blue-400 transition-colors"
            aria-label={`Como obter: ${label}`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="relative">
        <input
          id={id}
          type={resolvedType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={[
            'w-full rounded-lg border bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100',
            'placeholder:text-slate-500 outline-none transition-all duration-200',
            'focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500',
            isPassword ? 'pr-10' : '',
            error
              ? 'border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
              : 'border-slate-600 hover:border-slate-500',
          ].join(' ')}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setIsVisible((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
          <span className="inline-block w-3.5 h-3.5 rounded-full bg-red-500/20 text-red-400 text-center leading-3.5 font-bold">!</span>
          {error}
        </p>
      )}
    </div>
  )
}
