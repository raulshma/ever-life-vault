import React, { useEffect } from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { useAggregator } from '@/hooks/useAggregator'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

type FeedsConfig = { max?: number }

export default function FeedsWidget({ config }: WidgetProps<FeedsConfig>) {
  const { items, loading, refreshAll } = useAggregator()
  const max = typeof config?.max === 'number' ? config.max : 6

  useEffect(() => { refreshAll() }, [refreshAll])

  return (
    <WidgetShell title="Feeds">
      <div className="space-y-2 text-sm">
        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : (
          <ul className="space-y-1">
            {items.slice(0, max).map((it) => (
              <li key={it.id} className="truncate">
                <span className="text-muted-foreground mr-1">[{it.provider}]</span>
                {it.title}
              </li>
            ))}
            {items.length === 0 && <li className="text-muted-foreground">No items.</li>}
          </ul>
        )}
        <div className="flex gap-2 justify-end pt-1">
          <Button size="sm" variant="outline" onClick={() => refreshAll()}>Refresh</Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/feeds">Open Feeds</Link>
          </Button>
        </div>
      </div>
    </WidgetShell>
  )
}


