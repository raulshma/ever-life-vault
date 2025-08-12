import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Terminal, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { agpFetch } from '@/lib/aggregatorClient'

type WebhookConfig = {
  url?: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: string
  body?: string
}

export default function WebhookTesterWidget({ config, onConfigChange }: WidgetProps<WebhookConfig>) {
  const url = config?.url || ''
  const method = (config?.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  const headersText = config?.headers || ''
  const bodyText = config?.body || ''

  const [loading, setLoading] = React.useState(false)
  const [status, setStatus] = React.useState<string | null>(null)
  const [response, setResponse] = React.useState<string>('')

  const send = async () => {
    if (!url.trim()) return
    setLoading(true)
    setStatus(null)
    setResponse('')
    try {
      let headers: Record<string, string> = {}
      try { headers = headersText ? JSON.parse(headersText) : {} } catch {}
      const res = await agpFetch(url.trim(), { method, headers, body: ['GET', 'HEAD'].includes(method) ? undefined : bodyText })
      const ct = res.headers.get('content-type') || ''
      const txt = ct.includes('application/json') ? JSON.stringify(await res.json(), null, 2) : await res.text()
      setStatus(`${res.status} ${res.statusText}`)
      setResponse(txt)
    } catch (e) {
      setStatus('Request failed')
      setResponse(String(e))
    } finally {
      setLoading(false)
    }
  }

  const copyCurl = async () => {
    const parts = [
      'curl',
      '-X', method,
      ...Object.entries((headersText ? (JSON.parse(headersText) as Record<string, string>) : {})).flatMap(([k, v]) => ['-H', `${k}: ${v}`]),
      ...(['GET', 'HEAD'].includes(method) || !bodyText ? [] : ['--data-raw', JSON.stringify(bodyText)]),
      `'${url}'`,
    ]
    try { await navigator.clipboard.writeText(parts.join(' ')) } catch {}
  }

  return (
    <WidgetShell
      title="Webhook Tester"
      actions={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Copy curl" onClick={copyCurl} disabled={!url}>
              <Terminal className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy curl</TooltipContent>
        </Tooltip>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="w-28">
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={method} onChange={(e) => onConfigChange({ ...config, method: e.target.value as any })}>
              {['GET','POST','PUT','PATCH','DELETE'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <Input className="flex-1 min-w-40" placeholder="https://example.com/webhook" value={url} onChange={(e) => onConfigChange({ ...config, url: e.target.value })} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" aria-label="Send" onClick={send} disabled={loading || !url}>
                <Send className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send</TooltipContent>
          </Tooltip>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Headers (JSON)</div>
            <Textarea rows={6} value={headersText} onChange={(e) => onConfigChange({ ...config, headers: e.target.value })} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Body</div>
            <Textarea rows={6} value={bodyText} onChange={(e) => onConfigChange({ ...config, body: e.target.value })} />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Response {status ? `— ${status}` : ''}</div>
          <Textarea readOnly rows={10} value={response} />
        </div>
        <div className="text-xs text-muted-foreground">Requests are routed via `/agp` to allowed hosts only.</div>
      </div>
    </WidgetShell>
  )
}


