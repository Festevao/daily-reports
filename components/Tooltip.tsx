'use client'

import { Info } from 'lucide-react'

interface TooltipProps {
  content: string
}

export function Tooltip({ content }: TooltipProps) {
  return (
    <div className="tooltip-wrapper relative inline-flex items-center">
      <Info className="w-4 h-4 text-slate-400 hover:text-slate-200 cursor-help transition-colors" />
      <div className="tooltip-content absolute left-1/2 -translate-x-1/2 top-7 z-50 w-[min(18rem,calc(100vw-2rem))] rounded-lg bg-slate-700 border border-slate-600 text-slate-200 text-xs p-3 shadow-xl leading-relaxed">
        <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 bg-slate-700 border-l border-t border-slate-600 rotate-45" />
        <span className="relative">{content}</span>
      </div>
    </div>
  )
}
