import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps, BaseWidgetConfig } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Activity, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { agpFetch } from '@/lib/aggregatorClient'
import { useApiCache, generateCacheKey } from '../hooks/useApiCache'
import { CacheConfig } from '../components/CacheConfig'

type IPNetConfig = BaseWidgetConfig & {
  redact?: boolean
  endpoints?: string[]
}

type IpInfo = { ip?: string; city?: string; region?: string; country?: string; org?: string }

async function fetchIpInfo(): Promise<IpInfo | null> {
  // Try multiple sources to reduce failure rates
  const sources = [
    'https://ipinfo.io/json',
    'https://ipapi.co/json',
    'https://ifconfig.co/json',
  ]
  for (const url of sources) {
    try {
      const res = await agpFetch(url)
      if (!res.ok) continue
      const json = (await res.json()) as any
      // Normalize fields
      const ip = json?.ip || json?.query
      const city = json?.city
      const region = json?.region || json?.region_name
      const country = json?.country || json?.country_code
      const org = json?.org || json?.asn || json?.organization
      return { ip, city, region, country, org }
    } catch {}
  }
  return null
}

async function measureLatency(url: string): Promise<number | null> {
  // Prefer HEAD; fallback to GET with Range to avoid large payloads
  const start = performance.now()
  try {
    const head = await agpFetch(url, { method: 'HEAD' })
    if (head.ok) return Math.round(performance.now() - start)
  } catch {}
  try {
    const start2 = performance.now()
    const get = await agpFetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } as any })
    if (!get.ok) return null
    return Math.round(performance.now() - start2)
  } catch {
    return null
  }
}

export default function IPNetworkWidget({ config, onConfigChange, isEditing }: WidgetProps<IPNetConfig>) {
  const redact = config?.redact ?? false
  const endpoints = Array.isArray(config?.endpoints) && config.endpoints.length > 0
    ? config.endpoints
    : ['https://www.google.com', 'https://cloudflare.com', 'https://github.com']
  const [info, setInfo] = React.useState<IpInfo | null>(null)
  const [latency, setLatency] = React.useState<Record<string, number | null>>({})
  const [adding, setAdding] = React.useState('')
  
  const { getCached, setCached } = useApiCache<IpInfo>()

  const refresh = React.useCallback(async () => {
    // Check cache first
    const cacheKey = generateCacheKey('ip-info', {})
    const cached = getCached(cacheKey, config.cacheTimeMs)
    if (cached) {
      setInfo(cached)
      return
    }
    
    const data = await fetchIpInfo()
    if (data) {
      setInfo(data)
      // Cache the result
      setCached(cacheKey, data, config.cacheTimeMs)
    }
  }, [config.cacheTimeMs, getCached, setCached])

  React.useEffect(() => { refresh() }, [refresh])

  const runLatency = React.useCallback(async () => {
    const entries = await Promise.all(endpoints.map(async (e) => [e, await measureLatency(e)] as const))
    setLatency(Object.fromEntries(entries))
  }, [endpoints])

  const addEndpoint = () => {
    const url = adding.trim()
    if (!url) return
    try { new URL(url) } catch { return }
    onConfigChange({ ...config, endpoints: [...endpoints, url] })
    setAdding('')
  }

  const obfuscate = (ip?: string) => {
    if (!ip) return '—'
    if (!redact) return ip
    const parts = ip.split('.')
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`
    return ip.replace(/[:\w]+$/,'::')
  }

  return (
      <WidgetShell
        title="IP & Network"
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Run latency" onClick={runLatency}>
                <Activity className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Run latency</TooltipContent>
          </Tooltip>
        }
      >
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="font-mono">IP: {obfuscate(info?.ip)}</div>
          <div className="text-muted-foreground">{info?.city ? `${info.city}, ${info.region} ${info.country}` : ''}</div>
        </div>
        <div className="text-xs text-muted-foreground">{info?.org}</div>
        <div className="flex items-center gap-2">
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={redact} onChange={(e) => onConfigChange({ ...config, redact: e.target.checked })} /> Redact IP</label>
        </div>
        
        {/* Cache Configuration */}
        {isEditing && <CacheConfig config={config} onConfigChange={onConfigChange} />}
        
        <div className="space-y-2">
          <div className="font-medium">Endpoints</div>
          <ul className="space-y-1">
            {endpoints.map((e) => (
              <li key={e} className="flex items-center gap-2">
                <div className="truncate flex-1">{e}</div>
                <div className="w-16 text-right tabular-nums">{latency[e] != null ? `${latency[e]}ms` : '--'}</div>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input placeholder="https://example.com" value={adding} onChange={(e) => setAdding(e.target.value)} />
             <Button size="sm" onClick={addEndpoint}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </WidgetShell>
  )
}


