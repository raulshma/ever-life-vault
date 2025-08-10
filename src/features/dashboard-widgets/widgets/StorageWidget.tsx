import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

export default function StorageWidget(_props: WidgetProps<{}>) {
  const [devices] = React.useState([
    { id: '1', name: 'System SSD', used: 320, capacity: 500 },
    { id: '2', name: 'Data HDD 1', used: 1200, capacity: 2000 },
    { id: '3', name: 'Data HDD 2', used: 1800, capacity: 2000 },
  ])
  const total = devices.reduce((s, d) => s + d.capacity, 0)
  const used = devices.reduce((s, d) => s + d.used, 0)
  const pct = Math.round((used / total) * 100)
  return (
    <WidgetShell title="Storage">
      <div className="text-sm space-y-2">
        <div className="flex items-center justify-between"><span>Used</span><span>{pct}%</span></div>
        <div className="w-full bg-muted h-2 rounded">
          <div className="h-2 bg-[hsl(var(--primary))] rounded" style={{ width: `${pct}%` }} />
        </div>
        <ul className="space-y-1">
          {devices.slice(0, 4).map((d) => {
            const p = Math.round((d.used / d.capacity) * 100)
            return (
              <li key={d.id} className="flex items-center justify-between">
                <span className="truncate">{d.name}</span>
                <span className="font-mono">{p}%</span>
              </li>
            )
          })}
        </ul>
        <div className="text-right pt-1">
          <Button size="sm" variant="ghost" asChild>
            <Link to="/homelab/storage">Open Storage</Link>
          </Button>
        </div>
      </div>
    </WidgetShell>
  )
}


