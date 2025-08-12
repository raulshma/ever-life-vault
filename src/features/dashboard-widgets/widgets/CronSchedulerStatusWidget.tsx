import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw, Play, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { agpFetch } from '@/lib/aggregatorClient'

type Job = { id: string; name: string; healthUrl: string; triggerUrl?: string }
type CronConfig = { jobs?: Job[] }

type JobStatus = { id: string; ok: boolean; status: number; lastCheckedAt: number }

export default function CronSchedulerStatusWidget({ config, onConfigChange }: WidgetProps<CronConfig>) {
  const [statuses, setStatuses] = React.useState<JobStatus[]>([])
  const [loading, setLoading] = React.useState(false)
  const jobs: Job[] = Array.isArray(config?.jobs) ? config.jobs! : []

  const refresh = React.useCallback(async () => {
    if (!jobs.length) { setStatuses([]); return }
    setLoading(true)
    const out: JobStatus[] = []
    for (const j of jobs) {
      try {
        const res = await agpFetch(j.healthUrl)
        out.push({ id: j.id, ok: res.ok, status: (res as any).status || 0, lastCheckedAt: Date.now() })
      } catch {
        out.push({ id: j.id, ok: false, status: 0, lastCheckedAt: Date.now() })
      }
    }
    setStatuses(out)
    setLoading(false)
  }, [jobs])

  React.useEffect(() => { void refresh() }, [refresh])

  const addJob = () => {
    const id = cryptoId()
    const next: CronConfig = { jobs: [...jobs, { id, name: 'Job', healthUrl: '' }] }
    onConfigChange(next)
  }
  const updateJob = (id: string, patch: Partial<Job>) => {
    const next: CronConfig = { jobs: jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }
    onConfigChange(next)
  }
  const removeJob = (id: string) => {
    const next: CronConfig = { jobs: jobs.filter((j) => j.id !== id) }
    onConfigChange(next)
  }

  const trigger = async (j: Job) => {
    if (!j.triggerUrl) return
    try { await agpFetch(j.triggerUrl, { method: 'POST' }) } catch {}
  }

  return (
    <WidgetShell
      title="CRON Scheduler"
      actions={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Refresh" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="space-y-2">
          {jobs.map((j) => {
            const st = statuses.find((s) => s.id === j.id)
            const color = st ? (st.ok ? 'text-green-600' : 'text-red-600') : 'text-muted-foreground'
            return (
              <div key={j.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input className="w-40" placeholder="Name" value={j.name} onChange={(e) => updateJob(j.id, { name: e.target.value })} />
                  <Input className="flex-1" placeholder="Health URL" value={j.healthUrl} onChange={(e) => updateJob(j.id, { healthUrl: e.target.value })} />
                  <Input className="flex-1" placeholder="Trigger URL (optional)" value={j.triggerUrl || ''} onChange={(e) => updateJob(j.id, { triggerUrl: e.target.value })} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" aria-label="Trigger" onClick={() => void trigger(j)} disabled={!j.triggerUrl}>
                        <Play className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Trigger</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => removeJob(j.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove</TooltipContent>
                  </Tooltip>
                </div>
                <div className={`text-xs ${color}`}>
                  {st ? (st.ok ? `Healthy (${st.status})` : `Unhealthy (${st.status})`) : 'Not checked'}
                </div>
              </div>
            )
          })}
          {jobs.length === 0 && (
            <div className="text-muted-foreground">No jobs configured. Add one below.</div>
          )}
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" aria-label="Add" onClick={addJob}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add</TooltipContent>
          </Tooltip>
        </div>
        <div className="text-xs text-muted-foreground">Health checks are fetched via `/agp`. Add allowed hosts in server env.</div>
      </div>
    </WidgetShell>
  )
}

function cryptoId(): string {
  const arr = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr)
  else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}


