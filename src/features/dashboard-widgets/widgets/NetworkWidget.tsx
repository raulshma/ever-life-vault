import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'

export default function NetworkWidget(_props: WidgetProps<{}>) {
  const [devices] = React.useState([
    { id: '1', name: 'Main Router', type: 'router', status: 'online' },
    { id: '2', name: 'Switch-01', type: 'switch', status: 'online' },
    { id: '3', name: 'WiFi AP', type: 'access-point', status: 'online' },
    { id: '4', name: 'Desktop-PC', type: 'device', status: 'online' },
  ])
  const up = devices.filter(d => d.status === 'online').length
  return (
    <WidgetShell title="Network">
      <div className="text-sm space-y-2">
        <div>Devices online: {up}/{devices.length}</div>
        <ul className="space-y-1">
          {devices.slice(0, 6).map((d) => (
            <li key={d.id} className="flex items-center justify-between">
              <span className="truncate">{d.name}</span>
              <Badge variant={d.status === 'online' ? 'success' : 'destructive'}>{d.status}</Badge>
            </li>
          ))}
        </ul>
        <div className="text-right pt-1">
          <Button size="sm" variant="ghost" asChild>
            <Link to="/homelab/network">Open Network</Link>
          </Button>
        </div>
      </div>
    </WidgetShell>
  )
}


