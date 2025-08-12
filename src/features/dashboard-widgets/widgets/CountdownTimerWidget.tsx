import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Play, Eraser } from 'lucide-react'
import { Input } from '@/components/ui/input'

type CountdownConfig = {
  label?: string
  targetIso?: string
  autoRepeatDays?: number | null
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '00d 00h 00m 00s'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
}

export default function CountdownTimerWidget({ config, onConfigChange }: WidgetProps<CountdownConfig>) {
  const [now, setNow] = React.useState(() => Date.now())
  const [label, setLabel] = React.useState(config?.label ?? '')
  const [iso, setIso] = React.useState(config?.targetIso ?? '')
  const [repeatDays, setRepeatDays] = React.useState(
    typeof config?.autoRepeatDays === 'number' ? String(config?.autoRepeatDays) : ''
  )

  const target = config?.targetIso ? Date.parse(config.targetIso) : null
  const remaining = target ? Math.max(0, target - now) : 0

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const start = () => {
    const date = iso.trim() ? new Date(iso.trim()) : null
    if (!date || isNaN(date.getTime())) return
    const nextCfg: CountdownConfig = {
      label: label.trim() || undefined,
      targetIso: date.toISOString(),
      autoRepeatDays: repeatDays ? Number(repeatDays) : null,
    }
    onConfigChange(nextCfg)
  }

  const clearTimer = () => {
    onConfigChange({ label: '', targetIso: undefined, autoRepeatDays: null })
    setIso('')
  }

  // Auto repeat when reaching zero
  React.useEffect(() => {
    if (!target || remaining > 0) return
    const days = config?.autoRepeatDays
    if (!days || days <= 0) return
    const nextTarget = new Date(Date.now() + days * 86400_000)
    onConfigChange({ ...config, targetIso: nextTarget.toISOString() })
  }, [remaining, target, config, onConfigChange])

  return (
    <WidgetShell title="Countdown">
      <div className="space-y-3">
        <div className="text-2xl font-semibold tabular-nums tracking-tight">
          {target ? formatRemaining(remaining) : 'Not started'}
        </div>
        <div className="text-sm text-muted-foreground">
          {config?.label ? config.label : 'Set a target date/time'}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Input
            placeholder="Target ISO or any parsable date"
            value={iso}
            onChange={(e) => setIso(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Repeat days (optional)"
            value={repeatDays}
            onChange={(e) => setRepeatDays(e.target.value)}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" aria-label="Start" onClick={start}>
                <Play className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Clear" onClick={clearTimer}>
                <Eraser className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear</TooltipContent>
          </Tooltip>
        </div>
        <div className="text-xs text-muted-foreground">Timer updates every second.</div>
      </div>
    </WidgetShell>
  )
}


