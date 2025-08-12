import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Upload, Download, Trash2, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { getConfigValue, setConfigValue } from '@/integrations/supabase/configStore'

type FlagsConfig = {}

type FlagsData = {
  envs: string[]
  activeEnv: string
  // env -> flag -> boolean
  values: Record<string, Record<string, boolean>>
}

const DEFAULT_DATA: FlagsData = {
  envs: ['default'],
  activeEnv: 'default',
  values: { default: {} },
}

export default function FeatureFlagsWidget(_props: WidgetProps<FlagsConfig>) {
  const [data, setData] = React.useState<FlagsData>(DEFAULT_DATA)
  const [loading, setLoading] = React.useState(false)
  const [newEnv, setNewEnv] = React.useState('')
  const [newFlag, setNewFlag] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const v = await getConfigValue<FlagsData>('flags', 'data')
      if (v && typeof v === 'object' && v.envs && v.values) setData(v)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void load() }, [load])

  const persist = React.useCallback(async (next: FlagsData) => {
    setData(next)
    await setConfigValue('flags', 'data', next)
  }, [])

  const setActiveEnv = (env: string) => {
    if (!data.envs.includes(env)) return
    void persist({ ...data, activeEnv: env })
  }

  const addEnv = () => {
    const name = newEnv.trim() || 'env'
    if (data.envs.includes(name)) { setNewEnv(''); return }
    const next: FlagsData = {
      envs: [...data.envs, name],
      activeEnv: name,
      values: { ...data.values, [name]: {} },
    }
    setNewEnv('')
    void persist(next)
  }

  const removeEnv = (env: string) => {
    if (env === 'default') return
    const nextEnvs = data.envs.filter((e) => e !== env)
    const nextValues = { ...data.values }
    delete nextValues[env]
    const nextActive = data.activeEnv === env ? nextEnvs[0] || 'default' : data.activeEnv
    void persist({ envs: nextEnvs, activeEnv: nextActive, values: nextValues })
  }

  const addFlag = () => {
    const name = newFlag.trim()
    if (!name) return
    const env = data.activeEnv
    const envMap = data.values[env] || {}
    if (Object.prototype.hasOwnProperty.call(envMap, name)) { setNewFlag(''); return }
    const nextValues = { ...data.values, [env]: { ...envMap, [name]: false } }
    setNewFlag('')
    void persist({ ...data, values: nextValues })
  }

  const removeFlag = (flag: string) => {
    const env = data.activeEnv
    const envMap = { ...(data.values[env] || {}) }
    delete envMap[flag]
    const nextValues = { ...data.values, [env]: envMap }
    void persist({ ...data, values: nextValues })
  }

  const setFlag = (flag: string, value: boolean) => {
    const env = data.activeEnv
    const envMap = data.values[env] || {}
    const nextValues = { ...data.values, [env]: { ...envMap, [flag]: value } }
    void persist({ ...data, values: nextValues })
  }

  const exportJson = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(data)) } catch {}
  }

  const importJson = async () => {
    const txt = prompt('Paste flags JSON')
    if (!txt) return
    try {
      const parsed = JSON.parse(txt) as FlagsData
      if (!parsed || !parsed.envs || !parsed.values) return
      await persist(parsed)
    } catch {}
  }

  const envFlags = data.values[data.activeEnv] || {}
  const flagsList = Object.keys(envFlags)

  return (
    <WidgetShell
      title="Feature Flags"
      actions={
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Export" onClick={exportJson}>
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Import" onClick={importJson}>
                <Upload className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import</TooltipContent>
          </Tooltip>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="w-40">
            <Select value={data.activeEnv} onValueChange={setActiveEnv}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {data.envs.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input className="w-36" placeholder="New env" value={newEnv} onChange={(e) => setNewEnv(e.target.value)} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" aria-label="Add env" onClick={addEnv}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add env</TooltipContent>
            </Tooltip>
            {data.activeEnv !== 'default' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Remove env" onClick={() => removeEnv(data.activeEnv)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove env</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input className="w-56" placeholder="Flag key (e.g. newUI)" value={newFlag} onChange={(e) => setNewFlag(e.target.value)} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" aria-label="Add flag" onClick={addFlag}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add flag</TooltipContent>
          </Tooltip>
        </div>

        <ul className="divide-y rounded-md border">
          {flagsList.length === 0 && (
            <li className="p-3 text-muted-foreground">No flags in this environment.</li>
          )}
          {flagsList.map((f) => (
            <li key={f} className="p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1 truncate">
                <div className="font-medium">{f}</div>
                <div className="text-xs text-muted-foreground">env: {data.activeEnv}</div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id={`flag-${f}`} checked={!!envFlags[f]} onCheckedChange={(v) => setFlag(f, v)} />
                <Label htmlFor={`flag-${f}`}>{envFlags[f] ? 'On' : 'Off'}</Label>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => removeFlag(f)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove</TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>

        {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        <div className="text-xs text-muted-foreground">Flags are stored in your `user_configs` under namespace 'flags'.</div>
      </div>
    </WidgetShell>
  )
}


