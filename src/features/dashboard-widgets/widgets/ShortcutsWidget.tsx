import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { WidgetProps } from '../types'
import { WidgetShell } from '../components/WidgetShell'

type ShortcutsConfig = { items: Array<{ label: string; href: string }> }

export default function ShortcutsWidget({ config, onConfigChange }: WidgetProps<ShortcutsConfig>) {
  const items = Array.isArray(config?.items) ? config.items : []
  return (
    <WidgetShell title="Shortcuts">
      <div className="flex flex-wrap gap-2">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No shortcuts yet.</div>
        ) : (
          items.map((it, idx) => (
            <Button key={idx} asChild size="sm" variant="secondary">
              <Link to={it.href}>{it.label}</Link>
            </Button>
          ))
        )}
      </div>
    </WidgetShell>
  )
}


