import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { useDocuments } from '@/hooks/useDocuments'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

type DocsConfig = { max?: number }

export default function DocumentsWidget({ config }: WidgetProps<DocsConfig>) {
  const { documents, getExpiringDocuments } = useDocuments()
  const max = typeof config?.max === 'number' ? config.max : 6
  const recent = documents.slice(0, max)
  const expiring = getExpiringDocuments()

  return (
    <WidgetShell title="Documents">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Recent</div>
          <ul className="space-y-1 text-sm">
            {recent.length === 0 ? (
              <li className="text-muted-foreground">No documents.</li>
            ) : (
              recent.map((d) => (
                <li key={d.id} className="truncate">{d.name}</li>
              ))
            )}
          </ul>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Expiring soon</div>
          <ul className="space-y-1 text-sm">
            {expiring.length === 0 ? (
              <li className="text-muted-foreground">None</li>
            ) : (
              expiring.map((d) => (
                <li key={d.id} className="truncate">{d.name}</li>
              ))
            )}
          </ul>
        </div>
      </div>
      <div className="mt-3 text-right">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/documents">Open Docs</Link>
        </Button>
      </div>
    </WidgetShell>
  )
}


