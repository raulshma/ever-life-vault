import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Clock, Trash2, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'

type TimezoneEntry = { label: string; timeZone: string }
type WorldClocksConfig = { cities: TimezoneEntry[]; hour12?: boolean }

function formatTime(date: Date, timeZone: string, hour12: boolean | undefined): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: hour12 ?? false,
      timeZone,
    }).format(date)
  } catch {
    return '—'
  }
}

export default function WorldClocksWidget({ config, onConfigChange }: WidgetProps<WorldClocksConfig>) {
  const [now, setNow] = React.useState(() => new Date())
  const [label, setLabel] = React.useState('')
  const [tz, setTz] = React.useState('')

  const cities = Array.isArray(config?.cities) && config.cities.length > 0
    ? config.cities
    : [
        { label: 'Local', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
        { label: 'UTC', timeZone: 'UTC' },
      ]

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const removeAt = (idx: number) => {
    const next = cities.filter((_, i) => i !== idx)
    onConfigChange({ ...config, cities: next })
  }

  const addCity = () => {
    const trimmedLabel = label.trim()
    const trimmedTz = tz.trim()
    if (!trimmedLabel || !trimmedTz) return
    const next: TimezoneEntry[] = [...cities, { label: trimmedLabel, timeZone: trimmedTz }]
    onConfigChange({ ...config, cities: next })
    setLabel('')
    setTz('')
  }

  const toggleHour12 = () => {
    onConfigChange({ ...config, hour12: !config?.hour12 })
  }

  return (
    <WidgetShell
      title="World Clocks"
      actions={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Toggle 12/24h" onClick={toggleHour12}>
              <Clock className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle 12/24h</TooltipContent>
        </Tooltip>
      }
    >
      <div className="space-y-3 text-sm">
        <ul className="space-y-1">
          {cities.map((c, idx) => (
            <li key={`${c.label}-${idx}`} className="flex items-center gap-2">
              <div className="min-w-0 flex-1 truncate">
                <span className="font-medium">{c.label}</span>
                <span className="text-muted-foreground ml-2 text-xs">{c.timeZone}</span>
              </div>
              <div className="tabular-nums font-mono text-base">{formatTime(now, c.timeZone, config?.hour12)}</div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => removeAt(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove</TooltipContent>
              </Tooltip>
            </li>
          ))}
          {cities.length === 0 && <li className="text-muted-foreground">No cities configured.</li>}
        </ul>
        <div className="flex gap-2">
          <Input placeholder="Label (e.g. NYC)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input placeholder="IANA TZ (e.g. America/New_York)" value={tz} onChange={(e) => setTz(e.target.value)} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" aria-label="Add" onClick={addCity}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add</TooltipContent>
          </Tooltip>
        </div>
        <div className="text-xs text-muted-foreground">Times update every 30s. Uses your browser locale.</div>
      </div>
    </WidgetShell>
  )
}


