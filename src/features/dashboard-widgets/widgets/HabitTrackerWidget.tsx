import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getConfigValue, setConfigValue } from '@/integrations/supabase/configStore'

type Habit = { id: string; name: string; target?: number }
type HabitConfig = {}

type HabitsData = {
  habits: Habit[]
  // yyyy-mm-dd -> { habitId -> boolean }
  log: Record<string, Record<string, boolean>>
}

const DEFAULT: HabitsData = { habits: [], log: {} }

function todayKey(d = new Date()): string { return d.toISOString().slice(0,10) }

function cryptoId(): string {
  const arr = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr)
  else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function HabitTrackerWidget(_props: WidgetProps<HabitConfig>) {
  const [data, setData] = React.useState<HabitsData>(DEFAULT)
  const [loading, setLoading] = React.useState(false)
  const [name, setName] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const v = await getConfigValue<HabitsData>('habits', 'data')
      if (v && typeof v === 'object' && Array.isArray(v.habits) && v.log) setData(v)
    } finally { setLoading(false) }
  }, [])

  React.useEffect(() => { void load() }, [load])

  const persist = async (next: HabitsData) => {
    setData(next)
    await setConfigValue('habits', 'data', next)
  }

  const addHabit = async () => {
    const n = name.trim()
    if (!n) return
    const next: HabitsData = { ...data, habits: [...data.habits, { id: cryptoId(), name: n }] }
    setName('')
    await persist(next)
  }

  const removeHabit = async (id: string) => {
    const next: HabitsData = { habits: data.habits.filter(h => h.id !== id), log: { ...data.log } }
    for (const k of Object.keys(next.log)) delete next.log[k][id]
    await persist(next)
  }

  const toggle = async (id: string) => {
    const key = todayKey()
    const day = { ...(data.log[key] || {}) }
    day[id] = !day[id]
    const next: HabitsData = { ...data, log: { ...data.log, [key]: day } }
    await persist(next)
  }

  const day = data.log[todayKey()] || {}

  return (
    <WidgetShell title="Habits">
      <div className="space-y-3 text-sm">
        <div className="flex gap-2">
          <Input className="w-64" placeholder="New habit (e.g. Read 10 pages)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addHabit() }} />
          <Button onClick={() => void addHabit()}>Add</Button>
        </div>
        <ul className="divide-y rounded-md border">
          {data.habits.length === 0 && <li className="p-3 text-muted-foreground">No habits yet.</li>}
          {data.habits.map((h) => (
            <li key={h.id} className="p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1 truncate">{h.name}</div>
              <Button size="sm" variant={day[h.id] ? 'default' : 'outline'} onClick={() => void toggle(h.id)}>{day[h.id] ? 'Done ✓' : 'Mark done'}</Button>
              <Button size="sm" variant="ghost" onClick={() => void removeHabit(h.id)}>Remove</Button>
            </li>
          ))}
        </ul>
        {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        <div className="text-xs text-muted-foreground">Habits and daily log are stored in your `user_configs` under namespace 'habits'.</div>
      </div>
    </WidgetShell>
  )
}


