import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

export default function MonitoringWidget(_props: WidgetProps<{}>) {
  const [cpu, setCpu] = React.useState(45)
  const [mem, setMem] = React.useState(39)
  const [temp, setTemp] = React.useState(62)
  const refresh = () => {
    setCpu(Math.floor(Math.random() * 100))
    setMem(Math.floor(Math.random() * 100))
    setTemp(50 + Math.floor(Math.random() * 30))
  }
  return (
    <WidgetShell title="Monitoring">
      <div className="text-sm space-y-2">
        <div className="flex items-center justify-between"><span>CPU</span><span>{cpu}%</span></div>
        <div className="w-full bg-muted h-2 rounded">
          <div className="h-2 bg-[hsl(var(--info))] rounded" style={{ width: `${cpu}%` }} />
        </div>
        <div className="flex items-center justify-between"><span>Memory</span><span>{mem}%</span></div>
        <div className="w-full bg-muted h-2 rounded">
          <div className="h-2 bg-[hsl(var(--success))] rounded" style={{ width: `${mem}%` }} />
        </div>
        <div className="flex items-center justify-between"><span>Temp</span><span>{temp}°C</span></div>
        <div className="flex gap-2 justify-end pt-1">
          <Button size="sm" variant="outline" onClick={refresh}>Refresh</Button>
          <Button size="sm" variant="ghost" asChild><Link to="/homelab/monitoring">Open</Link></Button>
        </div>
      </div>
    </WidgetShell>
  )
}


