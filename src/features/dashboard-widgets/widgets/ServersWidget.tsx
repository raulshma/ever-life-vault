import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'

type ServersConfig = { max?: number }

type Server = { id: string; name: string; status: 'online' | 'offline' | 'maintenance' }

export default function ServersWidget({ config }: WidgetProps<ServersConfig>) {
  const [servers] = React.useState<Server[]>([
    { id: '1', name: 'Main Server', status: 'online' },
    { id: '2', name: 'Backup Server', status: 'offline' },
    { id: '3', name: 'Media Server', status: 'maintenance' },
  ])
  const max = typeof config?.max === 'number' ? config.max : 5
  const top = servers.slice(0, max)

  const counts = React.useMemo(() => {
    const c = { total: servers.length, online: 0, offline: 0, maintenance: 0 }
    for (const s of servers) c[s.status]++
    return c
  }, [servers])

  return (
    <WidgetShell title="Servers">
      <div className="text-sm space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div>Total: {counts.total}</div>
          <div className="text-[hsl(var(--success))]">Online: {counts.online}</div>
          <div className="text-[hsl(var(--destructive))]">Offline: {counts.offline}</div>
        </div>
        <ul className="space-y-1">
          {top.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <span className="truncate">{s.name}</span>
              <Badge variant={s.status === 'online' ? 'success' : s.status === 'maintenance' ? 'warning' : 'destructive'}>{s.status}</Badge>
            </li>
          ))}
        </ul>
        <div className="text-right pt-1">
          <Button size="sm" variant="ghost" asChild>
            <Link to="/homelab/servers">Open Servers</Link>
          </Button>
        </div>
      </div>
    </WidgetShell>
  )
}


