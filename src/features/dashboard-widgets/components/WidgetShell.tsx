import React from 'react'

export function WidgetShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full w-full bg-card/50 border rounded-md overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b text-sm font-medium text-foreground/80">{title}</div>
      <div className="flex-1 min-h-0 overflow-auto p-3">{children}</div>
    </div>
  )
}


