import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw } from 'lucide-react'
import { agpFetch } from '@/lib/aggregatorClient'

type QuotesConfig = {
  source?: 'local' | 'zenquotes'
  category?: string
}

const LOCAL_QUOTES: Array<{ q: string; a?: string }> = [
  { q: 'What you do every day matters more than what you do once in a while.', a: 'Gretchen Rubin' },
  { q: 'Simplicity is the soul of efficiency.', a: 'Austin Freeman' },
  { q: 'Well begun is half done.', a: 'Aristotle' },
  { q: 'Action is the foundational key to all success.', a: 'Pablo Picasso' },
]

export default function QuotesWidget({ config, onConfigChange }: WidgetProps<QuotesConfig>) {
  const source = config?.source || 'local'
  const [quote, setQuote] = React.useState<{ q: string; a?: string } | null>(null)
  const [loading, setLoading] = React.useState(false)

  const pickLocal = React.useCallback(() => {
    const i = Math.floor(Math.random() * LOCAL_QUOTES.length)
    setQuote(LOCAL_QUOTES[i])
  }, [])

  const fetchRemote = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await agpFetch('https://zenquotes.io/api/random')
      if (!res.ok) { pickLocal(); return }
      const arr = (await res.json()) as Array<{ q: string; a: string }>
      if (Array.isArray(arr) && arr[0]) setQuote(arr[0])
      else pickLocal()
    } catch {
      pickLocal()
    } finally {
      setLoading(false)
    }
  }, [pickLocal])

  const refresh = React.useCallback(() => {
    if (source === 'local') pickLocal()
    else void fetchRemote()
  }, [fetchRemote, pickLocal, source])

  React.useEffect(() => { refresh() }, [refresh])

  return (
    <WidgetShell
      title="Quote"
      actions={
        <div className="flex gap-2">
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={source} onChange={(e) => onConfigChange({ ...config, source: e.target.value as any })}>
            <option value="local">Local</option>
            <option value="zenquotes">ZenQuotes</option>
          </select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Next quote" onClick={refresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next quote</TooltipContent>
          </Tooltip>
        </div>
      }
    >
      <div className="space-y-2">
        <div className="text-base">{quote?.q || '—'}</div>
        <div className="text-xs text-muted-foreground">{quote?.a || ''}</div>
      </div>
    </WidgetShell>
  )
}


