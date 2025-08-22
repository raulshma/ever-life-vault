import React, { useState, useEffect, useMemo } from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps, BaseWidgetConfig } from '../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  RefreshCw,
  Filter,
  Cpu,
  DollarSign,
  MessageSquare,
  Eye,
  Zap,
  Brain,
  Globe,
  Clock,
  BarChart3
} from 'lucide-react'
import { useApiCache, generateCacheKey } from '../hooks/useApiCache'
import { CacheConfig } from '../components/CacheConfig'

type LLMModelsConfig = BaseWidgetConfig & {
  defaultView?: 'grid' | 'table'
  maxModels?: number
  showPricing?: boolean
  showCapabilities?: boolean
}

interface LLMModel {
  id: string
  name: string
  provider: string
  company?: string
  description?: string
  contextLength?: number
  pricing?: {
    input?: number
    output?: number
    image?: number
    request?: number
  }
  capabilities?: string[]
  maxTokens?: number
  architecture?: string
  isAvailable: boolean
  lastUpdated: string
}

interface LLMStats {
  totalModels: number
  providers: Record<string, number>
  companies: Record<string, number>
  avgContextLength: number
  priceRanges: {
    input: { min: number; max: number }
    output: { min: number; max: number }
  }
}

const CAPABILITY_ICONS: Record<string, React.ComponentType<any>> = {
  text: MessageSquare,
  vision: Eye,
  function_calling: Zap,
  streaming: Globe,
  coding: Cpu
}

const PROVIDER_COLORS: Record<string, string> = {
  'OpenRouter': 'bg-purple-500',
  'OpenAI': 'bg-green-500',
  'Anthropic': 'bg-orange-500',
  'Google': 'bg-blue-500',
  'Meta': 'bg-yellow-500',
  'xAI': 'bg-red-500'
}

export default function LLMModelsWidget({ config, onConfigChange, isEditing }: WidgetProps<LLMModelsConfig>) {
  const [models, setModels] = useState<LLMModel[]>([])
  const [stats, setStats] = useState<LLMStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [capabilityFilter, setCapabilityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'contextLength' | 'inputPrice' | 'outputPrice'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [view, setView] = useState<'grid' | 'table'>(config?.defaultView || 'grid')

  const { getCached, getCachedAsync, setCached } = useApiCache()

  // Fetch models with caching
  const fetchModels = React.useCallback(async (forceRefresh = false) => {
    const cacheKey = generateCacheKey('llm_models', {})
    const now = Date.now()

    // Check cache unless force refresh
    if (!forceRefresh) {
      const cached = await getCachedAsync(cacheKey, config.cacheTimeMs)
      if (cached) {
        setModels(cached)
        return
      }
    }

    setLoading(true)
    try {
      const response = await fetch('/api/llm/models' + (forceRefresh ? '?forceRefresh=true' : ''))
      if (!response.ok) throw new Error('Failed to fetch models')
      const data = await response.json()

      if (data.success) {
        setModels(data.data)
        setCached(cacheKey, data.data, config.cacheTimeMs)
      }
    } catch (error) {
      console.error('Error fetching LLM models:', error)
    } finally {
      setLoading(false)
    }
  }, [config.cacheTimeMs, getCached, setCached])

  // Fetch stats
  const fetchStats = React.useCallback(async () => {
    try {
      const response = await fetch('/api/llm/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error fetching LLM stats:', error)
    }
  }, [])

  // Manual refresh
  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true)
    await fetchModels(true)
    await fetchStats()
    setRefreshing(false)
  }, [fetchModels, fetchStats])

  // Filter and sort models
  const filteredAndSortedModels = useMemo(() => {
    let filtered = models.filter(model => {
      const matchesSearch = searchQuery === '' ||
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.company?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesProvider = providerFilter === 'all' || model.provider === providerFilter
      const matchesCompany = companyFilter === 'all' || model.company === companyFilter
      const matchesCapability = capabilityFilter === 'all' ||
        (model.capabilities && model.capabilities.includes(capabilityFilter))

      return matchesSearch && matchesProvider && matchesCompany && matchesCapability
    })

    // Sort models
    filtered.sort((a, b) => {
      let aVal: any, bVal: any

      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'contextLength':
          aVal = a.contextLength || 0
          bVal = b.contextLength || 0
          break
        case 'inputPrice':
          aVal = a.pricing?.input || 0
          bVal = b.pricing?.input || 0
          break
        case 'outputPrice':
          aVal = a.pricing?.output || 0
          bVal = b.pricing?.output || 0
          break
        default:
          aVal = a.name
          bVal = b.name
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered.slice(0, config?.maxModels || 50)
  }, [models, searchQuery, providerFilter, companyFilter, capabilityFilter, sortBy, sortOrder, config?.maxModels])

  // Get unique values for filters
  const uniqueProviders = useMemo(() => [...new Set(models.map(m => m.provider))], [models])
  const uniqueCompanies = useMemo(() => [...new Set(models.map(m => m.company).filter(Boolean))], [models])
  const uniqueCapabilities = useMemo(() => {
    const allCapabilities = models.flatMap(m => m.capabilities || [])
    return [...new Set(allCapabilities)]
  }, [models])

  // Format pricing
  const formatPricing = (pricing?: { input?: number; output?: number }) => {
    if (!pricing) return 'N/A'
    const input = pricing.input ? `$${(pricing.input * 1000000).toFixed(2)}` : 'N/A'
    const output = pricing.output ? `$${(pricing.output * 1000000).toFixed(2)}` : 'N/A'
    return `In: ${input}/M tokens\nOut: ${output}/M tokens`
  }

  // Format context length
  const formatContextLength = (length?: number) => {
    if (!length) return 'N/A'
    if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`
    if (length >= 1000) return `${(length / 1000).toFixed(0)}K`
    return length.toString()
  }

  // Render model card for grid view
  const renderModelCard = (model: LLMModel) => (
    <Card key={model.id} className="h-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium truncate" title={model.name}>
              {model.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="secondary"
                className={`text-xs ${PROVIDER_COLORS[model.provider] || 'bg-gray-500'} text-white`}
              >
                {model.provider}
              </Badge>
              {model.company && (
                <span className="text-xs text-muted-foreground">{model.company}</span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {model.description && (
          <p className="text-xs text-muted-foreground line-clamp-2" title={model.description}>
            {model.description}
          </p>
        )}

        <div className="space-y-2">
          {model.contextLength && (
            <div className="flex items-center gap-2 text-xs">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{formatContextLength(model.contextLength)}</span>
              <span className="text-muted-foreground">context</span>
            </div>
          )}

          {config?.showPricing && model.pricing && (
            <div className="flex items-center gap-2 text-xs">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">
                ${(model.pricing.input || 0 * 1000000).toFixed(2)} /M in
              </span>
            </div>
          )}

          {config?.showCapabilities && model.capabilities && (
            <div className="flex flex-wrap gap-1">
              {model.capabilities.slice(0, 3).map(capability => {
                const Icon = CAPABILITY_ICONS[capability] || Cpu
                return (
                  <Tooltip key={capability}>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        <Icon className="h-2 w-2 mr-1" />
                        {capability.replace('_', ' ')}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>{capability.replace('_', ' ')}</TooltipContent>
                  </Tooltip>
                )
              })}
              {model.capabilities.length > 3 && (
                <Badge variant="outline" className="text-xs px-1 py-0">
                  +{model.capabilities.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>

        {!model.isAvailable && (
          <Badge variant="destructive" className="text-xs w-fit">
            Unavailable
          </Badge>
        )}
      </CardContent>
    </Card>
  )

  // Render model row for table view
  const renderModelRow = (model: LLMModel) => (
    <div key={model.id} className="flex items-center gap-4 p-4 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm truncate" title={model.name}>
            {model.name}
          </h4>
          <Badge
            variant="secondary"
            className={`text-xs ${PROVIDER_COLORS[model.provider] || 'bg-gray-500'} text-white`}
          >
            {model.provider}
          </Badge>
          {!model.isAvailable && (
            <Badge variant="destructive" className="text-xs">
              Unavailable
            </Badge>
          )}
        </div>
        {model.company && (
          <p className="text-xs text-muted-foreground mt-1">{model.company}</p>
        )}
        {model.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1" title={model.description}>
            {model.description}
          </p>
        )}
      </div>

      {model.contextLength && (
        <div className="flex items-center gap-1 text-xs min-w-[80px]">
          <MessageSquare className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{formatContextLength(model.contextLength)}</span>
        </div>
      )}

      {config?.showPricing && model.pricing && (
        <div className="flex items-center gap-1 text-xs min-w-[100px]">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">
            ${(model.pricing.input || 0 * 1000000).toFixed(2)}
          </span>
        </div>
      )}

      {config?.showCapabilities && model.capabilities && (
        <div className="flex flex-wrap gap-1 min-w-[120px]">
          {model.capabilities.slice(0, 2).map(capability => {
            const Icon = CAPABILITY_ICONS[capability] || Cpu
            return (
              <Badge key={capability} variant="outline" className="text-xs px-1 py-0">
                <Icon className="h-2 w-2 mr-1" />
                {capability.replace('_', ' ')}
              </Badge>
            )
          })}
          {model.capabilities.length > 2 && (
            <Badge variant="outline" className="text-xs px-1 py-0">
              +{model.capabilities.length - 2}
            </Badge>
          )}
        </div>
      )}
    </div>
  )

  // Initial data fetch
  useEffect(() => {
    fetchModels()
    fetchStats()
  }, [fetchModels, fetchStats])

  return (
    <WidgetShell
      title="LLM Models"
      actions={
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleRefresh}
                disabled={refreshing || loading}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh data</TooltipContent>
          </Tooltip>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalModels}</p>
                    <p className="text-xs text-muted-foreground">Total Models</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{Object.keys(stats.providers).length}</p>
                    <p className="text-xs text-muted-foreground">Providers</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{formatContextLength(stats.avgContextLength)}</p>
                    <p className="text-xs text-muted-foreground">Avg Context</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-muted-foreground">Last Update</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters and Search */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {uniqueProviders.map(provider => (
                  <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {uniqueCompanies.map(company => (
                  <SelectItem key={company} value={company}>{company}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={view} onValueChange={(value: 'grid' | 'table') => setView(value)}>
              <SelectTrigger className="w-full sm:w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="table">Table</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config?.showCapabilities && (
            <div className="flex flex-wrap gap-2">
              <Select value={capabilityFilter} onValueChange={setCapabilityFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Filter by capability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Capabilities</SelectItem>
                  {uniqueCapabilities.map(capability => (
                    <SelectItem key={capability} value={capability}>
                      {capability.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="contextLength">Context Length</SelectItem>
              <SelectItem value="inputPrice">Input Price</SelectItem>
              <SelectItem value="outputPrice">Output Price</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>

        {/* Models Display */}
        <div className="space-y-4">
          {loading ? (
            <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-0'}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="h-full">
                  <CardHeader className="pb-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAndSortedModels.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No models found matching your criteria</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredAndSortedModels.length} of {models.length} models
                </p>
              </div>

              <ScrollArea className="h-[400px]">
                {view === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
                    {filteredAndSortedModels.map(renderModelCard)}
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    {filteredAndSortedModels.map(renderModelRow)}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>

        {/* Cache Configuration */}
        {isEditing && (
          <CacheConfig config={config} onConfigChange={onConfigChange} />
        )}
      </div>
    </WidgetShell>
  )
}
