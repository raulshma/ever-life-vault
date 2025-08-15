import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps, BaseWidgetConfig } from '../types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw } from 'lucide-react'
import { agpFetch } from '@/lib/aggregatorClient'
import { useApiCache, generateCacheKey } from '../hooks/useApiCache'
import { CacheConfig } from '../components/CacheConfig'

type QuotesConfig = BaseWidgetConfig & {
  source?: 'local' | 'zenquotes'
  category?: string
}

const LOCAL_QUOTES: Array<{ q: string; a?: string }> = [
  { q: 'What you do every day matters more than what you do once in a while.', a: 'Gretchen Rubin' },
  { q: 'Simplicity is the soul of efficiency.', a: 'Austin Freeman' },
  { q: 'Well begun is half done.', a: 'Aristotle' },
  { q: 'Action is the foundational key to all success.', a: 'Pablo Picasso' },
]

export default function QuotesWidget({ config, onConfigChange, isEditing }: WidgetProps<QuotesConfig>) {
  const source = config?.source || 'local'
  const [quote, setQuote] = React.useState<{ q: string; a?: string } | null>(null)
  const [loading, setLoading] = React.useState(false)
  
  const { getCached, getCachedAsync, setCached } = useApiCache<{ q: string; a?: string }>()

  const pickLocal = React.useCallback(() => {
    const i = Math.floor(Math.random() * LOCAL_QUOTES.length)
    setQuote(LOCAL_QUOTES[i])
  }, [])

  const fetchRemote = React.useCallback(async () => {
    // Check cache first for remote quotes
    const cacheKey = generateCacheKey('zenquotes', {})
    const cached = await getCachedAsync(cacheKey, config.cacheTimeMs)
    if (cached) {
      setQuote(cached)
      return
    }
    
    setLoading(true)
    try {
      const res = await agpFetch('https://zenquotes.io/api/random')
      if (!res.ok) { pickLocal(); return }
      const arr = (await res.json()) as Array<{ q: string; a: string }>
      if (Array.isArray(arr) && arr[0]) {
        const newQuote = arr[0]
        setQuote(newQuote)
        // Cache the result
        setCached(cacheKey, newQuote, config.cacheTimeMs)
      } else {
        pickLocal()
      }
    } catch {
      pickLocal()
    } finally {
      setLoading(false)
    }
  }, [config.cacheTimeMs, getCached, setCached, pickLocal])

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
          <Select onValueChange={(value) => onConfigChange({ ...config, source: value as any })} value={source}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select a source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="zenquotes">ZenQuotes</SelectItem>
            </SelectContent>
          </Select>
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
      <div className="space-y-3">
        <div className="text-base">{quote?.q || '—'}</div>
        <div className="text-xs text-muted-foreground">{quote?.a || ''}</div>
        
        {/* Cache Configuration - only show for remote source AND when editing */}
        {source === 'zenquotes' && isEditing && (
          <CacheConfig config={config} onConfigChange={onConfigChange} />
        )}
      </div>
    </WidgetShell>
  )
}


