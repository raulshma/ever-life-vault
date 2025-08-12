import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { getConfigValue, setConfigValue } from '@/integrations/supabase/configStore'

type Mood = string

type MoodConfig = {
  emojis?: Mood[]
}

type MoodLog = {
  // yyyy-mm-dd -> mood
  entries: Record<string, Mood>
}

const DEFAULT_EMOJIS: Mood[] = ['😀', '🙂', '😐', '🙁', '😞']

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export default function MoodCheckinWidget({ config }: WidgetProps<MoodConfig>) {
  const [log, setLog] = React.useState<MoodLog>({ entries: {} })
  const emojis = (Array.isArray(config?.emojis) && (config?.emojis as Mood[]).length > 0 ? (config?.emojis as Mood[]) : DEFAULT_EMOJIS)
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const v = await getConfigValue<MoodLog>('mood', 'daily')
      if (v && typeof v === 'object' && v.entries) setLog(v)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void load() }, [load])

  const setMood = async (m: Mood) => {
    const key = todayKey()
    const next: MoodLog = { entries: { ...log.entries, [key]: m } }
    setLog(next)
    await setConfigValue('mood', 'daily', next)
  }

  // Build last 7 days for sparkline/text
  const days: Array<{ day: string; mood?: Mood }> = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const k = todayKey(d)
    days.push({ day: k.slice(5), mood: log.entries[k] })
  }

  return (
    <WidgetShell
      title="Mood Check-in"
      actions={<div className="text-xs text-muted-foreground">Last 7 days</div>}
    >
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          {emojis.map((e) => (
            <Button key={e} size="sm" variant="outline" onClick={() => void setMood(e)} aria-label={`Set mood ${e}`}>{e}</Button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => (
            <div key={d.day} className="p-2 text-center rounded border bg-background/60">
              <div className="text-xs text-muted-foreground">{d.day.slice(0, 2)}/{d.day.slice(3)}</div>
              <div className="text-lg leading-none">{d.mood || '—'}</div>
            </div>
          ))}
        </div>
        {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        <div className="text-xs text-muted-foreground">Stored in your `user_configs` under namespace 'mood'.</div>
      </div>
    </WidgetShell>
  )
}


