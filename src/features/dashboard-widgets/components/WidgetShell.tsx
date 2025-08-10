import React from 'react'

export function WidgetShell({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="h-full w-full glass rounded-xl overflow-hidden flex flex-col shadow-card">
      <div className="px-4 py-2.5 border-b text-[0.95rem] font-semibold text-foreground/85 bg-card/60 flex items-center gap-2">
        <div className="truncate">{title}</div>
        <div className="ml-auto flex items-center gap-1">{actions}</div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4 min-w-0">{children}</div>
    </div>
  )
}


