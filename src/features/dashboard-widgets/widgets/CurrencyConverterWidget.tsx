import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps, BaseWidgetConfig } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowLeftRight, RefreshCw, Copy } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { agpFetch } from '@/lib/aggregatorClient'
import { useApiCache, generateCacheKey } from '../hooks/useApiCache'
import { CacheConfig } from '../components/CacheConfig'

type CurrencyConfig = BaseWidgetConfig & {
  base: string
  quote: string
}

type RatesResponse = {
  success?: boolean
  base?: string
  date?: string
  rates?: Record<string, number>
}

const COMMON = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR']

async function fetchRates(base: string): Promise<RatesResponse | null> {
  // exchangerate.host public API
  const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}`
  try {
    const res = await agpFetch(url)
    if (!res.ok) return null
    return (await res.json()) as RatesResponse
  } catch {
    return null
  }
}

export default function CurrencyConverterWidget({ config, onConfigChange, isEditing }: WidgetProps<CurrencyConfig>) {
  const base = config?.base || 'USD'
  const quote = config?.quote || 'EUR'
  const [amount, setAmount] = React.useState('1')
  const [rate, setRate] = React.useState<number | null>(null)
  const [date, setDate] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  
  const { getCached, setCached } = useApiCache<RatesResponse>()

  const numeric = Number(amount)
  const valid = !isNaN(numeric)
  const converted = valid && rate != null ? (numeric * rate).toFixed(4) : ''

  const refresh = React.useCallback(async () => {
    // Check cache first
    const cacheKey = generateCacheKey('currency-rates', { base })
    const cached = getCached(cacheKey, config.cacheTimeMs)
    if (cached && cached.rates) {
      setRate(cached.rates[quote] ?? null)
      setDate(cached.date || null)
      return
    }
    
    setLoading(true)
    try {
      const data = await fetchRates(base)
      if (data && data.rates) {
        setRate(data.rates[quote] ?? null)
        setDate(data.date || null)
        // Cache the result
        setCached(cacheKey, data, config.cacheTimeMs)
      } else {
        setRate(null)
      }
    } finally {
      setLoading(false)
    }
  }, [base, quote, config.cacheTimeMs, getCached, setCached])

  React.useEffect(() => { refresh() }, [refresh])

  const swap = () => {
    onConfigChange({ ...config, base: quote, quote: base })
  }

  const copy = async () => { try { await navigator.clipboard.writeText(converted) } catch {} }

  return (
      <WidgetShell
        title="Currency Converter"
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Swap" onClick={swap}>
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Swap</TooltipContent>
          </Tooltip>
        }
      >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="w-28">
            <Select value={base} onValueChange={(v) => onConfigChange({ ...config, base: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMON.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28">
            <Select value={quote} onValueChange={(v) => onConfigChange({ ...config, quote: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMON.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" aria-label="Refresh" onClick={refresh} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="flex-1 flex items-center gap-2">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
            <div className="text-muted-foreground">{base}</div>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <Input value={converted} readOnly className="font-mono" />
            <div className="text-muted-foreground">{quote}</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" aria-label="Copy" onClick={copy} disabled={!converted}>
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Cache Configuration */}
        {isEditing && <CacheConfig config={config} onConfigChange={onConfigChange} />}

        <div className="text-xs text-muted-foreground">
          {rate != null ? (
            <>Rate: 1 {base} = {rate} {quote}{date ? ` (as of ${date})` : ''}</>
          ) : (
            <>No rate available.</>
          )}
        </div>
      </div>
    </WidgetShell>
  )
}


