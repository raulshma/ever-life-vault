import React, { useState, useEffect, useMemo } from 'react'
import PageHeader from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  Search,
  RefreshCw,
  Filter,
  Brain,
  DollarSign,
  MessageSquare,
  Eye,
  Zap,
  BarChart3,
  TrendingUp,
  Activity,
  Layers,
  Cpu,
  Globe,
  Clock,
  Target,
  Award,
  Star,
  Zap as Lightning,
  Users,
  Building,
  ChevronUp,
  ChevronDown,
  Info,
  Sparkles,
  Rocket,
  Shield,
  Gem,
  Crown,
  Flame,
  Wind,
  Mountain,
  Waves,
  Sun,
  Moon,
  Palette,
  Gauge,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  ComposedChart,
  Legend,
  ReferenceLine
} from 'recharts'

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

const PROVIDER_COLORS: Record<string, string> = {
  'OpenRouter': '#8B5CF6',
  'OpenAI': '#10B981',
  'Anthropic': '#F97316',
  'Google': '#3B82F6',
  'Meta': '#F59E0B',
  'xAI': '#EF4444',
  'Cohere': '#06B6D4',
  'Mistral': '#8B5CF6',
  'HuggingFace': '#F59E0B',
  'Replicate': '#10B981',
  'Together': '#F97316',
  'Anyscale': '#EF4444'
}

const CAPABILITY_COLORS: Record<string, string> = {
  text: '#10B981',
  vision: '#8B5CF6',
  function_calling: '#F97316',
  streaming: '#3B82F6',
  coding: '#EF4444',
  multimodal: '#06B6D4',
  tool_use: '#8B5CF6',
  reasoning: '#F59E0B',
  memory: '#10B981',
  fine_tuning: '#F97316'
}

// Enhanced gradient backgrounds
const GRADIENT_BACKGROUNDS = {
  primary: 'bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 dark:from-violet-950/20 dark:via-purple-950/20 dark:to-indigo-950/20',
  secondary: 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/20 dark:via-teal-950/20 dark:to-cyan-950/20',
  accent: 'bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-red-950/20',
  neutral: 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-950/20 dark:via-gray-950/20 dark:to-zinc-950/20',
  success: 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/20 dark:via-emerald-950/20 dark:to-teal-950/20',
  warning: 'bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-950/20 dark:via-amber-950/20 dark:to-orange-950/20',
  danger: 'bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 dark:from-red-950/20 dark:via-rose-950/20 dark:to-pink-950/20'
}

// Model quality indicators
const QUALITY_ICONS = {
  premium: Crown,
  enterprise: Shield,
  experimental: Flame,
  stable: Gem,
  fast: Rocket,
  balanced: Gauge,
  creative: Sparkles,
  analytical: Brain
}

// Performance metrics colors
const METRIC_COLORS = {
  excellent: '#10B981',
  good: '#3B82F6',
  average: '#F59E0B',
  poor: '#EF4444',
  unknown: '#6B7280'
}

export default function LLMModels() {
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
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null)
  const [compareModels, setCompareModels] = useState<LLMModel[]>([])
  const [isCompareMode, setIsCompareMode] = useState(false)

  // Fetch models with caching
  const fetchModels = React.useCallback(async (forceRefresh = false) => {
    const cacheKey = 'llm_models_page'
    const now = Date.now()

    // Check cache unless force refresh
    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        if (now - timestamp < 10 * 60 * 1000) { // 10 minutes cache
          setModels(data)
          return
        }
      }
    }

    setLoading(true)
    try {
      const response = await fetch('/api/llm/models' + (forceRefresh ? '?forceRefresh=true' : ''))
      if (!response.ok) throw new Error('Failed to fetch models')
      const data = await response.json()

      if (data.success) {
        setModels(data.data)
        localStorage.setItem(cacheKey, JSON.stringify({
          data: data.data,
          timestamp: now
        }))
      }
    } catch (error) {
      console.error('Error fetching LLM models:', error)
    } finally {
      setLoading(false)
    }
  }, [])

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

  // Model comparison functions
  const toggleModelComparison = React.useCallback((model: LLMModel) => {
    setCompareModels(prev => {
      const isSelected = prev.find(m => m.id === model.id)
      if (isSelected) {
        return prev.filter(m => m.id !== model.id)
      } else if (prev.length < 4) { // Limit to 4 models for comparison
        return [...prev, model]
      }
      return prev
    })
  }, [])

  const clearComparison = React.useCallback(() => {
    setCompareModels([])
    setIsCompareMode(false)
  }, [])

  const getModelQualityScore = React.useCallback((model: LLMModel) => {
    let score = 0
    if (model.contextLength && model.contextLength > 32000) score += 25
    if (model.pricing?.input && model.pricing.input < 2) score += 20
    if (model.capabilities?.length && model.capabilities.length > 3) score += 25
    if (model.isAvailable) score += 15
    if (model.provider === 'OpenAI' || model.provider === 'Anthropic') score += 15
    return Math.min(score, 100)
  }, [])

  const getModelPerformanceData = React.useCallback((model: LLMModel) => {
    return [
      { metric: 'Context', value: Math.min((model.contextLength || 0) / 200000 * 100, 100) },
      { metric: 'Cost Efficiency', value: model.pricing?.input ? Math.max(0, 100 - (model.pricing.input * 20)) : 50 },
      { metric: 'Capabilities', value: (model.capabilities?.length || 0) * 20 },
      { metric: 'Availability', value: model.isAvailable ? 100 : 0 },
      { metric: 'Provider Trust', value: ['OpenAI', 'Anthropic', 'Google'].includes(model.provider) ? 90 : 70 }
    ]
  }, [])

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

    return filtered
  }, [models, searchQuery, providerFilter, companyFilter, capabilityFilter, sortBy, sortOrder])

  // Get unique values for filters
  const uniqueProviders = useMemo(() => [...new Set(models.map(m => m.provider))], [models])
  const uniqueCompanies = useMemo(() => [...new Set(models.map(m => m.company).filter(Boolean))], [models])
  const uniqueCapabilities = useMemo(() => {
    const allCapabilities = models.flatMap(m => m.capabilities || [])
    return [...new Set(allCapabilities)]
  }, [models])

  // Prepare chart data
  const providerChartData = useMemo(() => {
    if (!stats) return []
    return Object.entries(stats.providers).map(([provider, count]) => ({
      name: provider,
      value: count,
      color: PROVIDER_COLORS[provider] || '#6B7280'
    }))
  }, [stats])

  const capabilityChartData = useMemo(() => {
    const capabilityCounts: Record<string, number> = {}
    models.forEach(model => {
      model.capabilities?.forEach(cap => {
        capabilityCounts[cap] = (capabilityCounts[cap] || 0) + 1
      })
    })
    return Object.entries(capabilityCounts).map(([capability, count]) => ({
      name: capability.replace('_', ' '),
      value: count,
      color: CAPABILITY_COLORS[capability] || '#6B7280'
    }))
  }, [models])

  const contextLengthData = useMemo(() => {
    const ranges = [
      { name: '0-8K', min: 0, max: 8000, count: 0 },
      { name: '8K-32K', min: 8000, max: 32000, count: 0 },
      { name: '32K-128K', min: 32000, max: 128000, count: 0 },
      { name: '128K+', min: 128000, max: Infinity, count: 0 }
    ]

    models.forEach(model => {
      const context = model.contextLength || 0
      const range = ranges.find(r => context >= r.min && context < r.max)
      if (range) range.count++
    })

    return ranges
  }, [models])

  const pricingData = useMemo(() => {
    const priceRanges = [
      { name: '$0-1', min: 0, max: 1, count: 0 },
      { name: '$1-5', min: 1, max: 5, count: 0 },
      { name: '$5-10', min: 5, max: 10, count: 0 },
      { name: '$10+', min: 10, max: Infinity, count: 0 }
    ]

    models.forEach(model => {
      const price = model.pricing?.input || 0
      const range = priceRanges.find(r => price >= r.min && price < r.max)
      if (range) range.count++
    })

    return priceRanges
  }, [models])

  // Initial data fetch
  useEffect(() => {
    fetchModels()
    fetchStats()
  }, [fetchModels, fetchStats])

  const renderModelCard = (model: LLMModel) => (
    <Card
      key={model.id}
      className="h-full hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer border-l-4"
      style={{ borderLeftColor: PROVIDER_COLORS[model.provider] || '#6B7280' }}
      onClick={() => setSelectedModel(model)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium truncate" title={model.name}>
              {model.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="secondary"
                className="text-xs px-2 py-0.5"
                style={{ backgroundColor: `${PROVIDER_COLORS[model.provider]}20`, color: PROVIDER_COLORS[model.provider] }}
              >
                {model.provider}
              </Badge>
              {model.company && (
                <span className="text-xs text-muted-foreground">{model.company}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-500" />
            <Award className="h-4 w-4 text-blue-500" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {model.description && (
          <p className="text-xs text-muted-foreground line-clamp-2" title={model.description}>
            {model.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          {model.contextLength && (
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{(model.contextLength / 1000).toFixed(0)}K</span>
              <span className="text-muted-foreground">context</span>
            </div>
          )}

          {model.pricing?.input && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">${(model.pricing.input * 1000000).toFixed(2)}</span>
              <span className="text-muted-foreground">/M in</span>
            </div>
          )}

          {model.pricing?.output && (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">${(model.pricing.output * 1000000).toFixed(2)}</span>
              <span className="text-muted-foreground">/M out</span>
            </div>
          )}
        </div>

        {model.capabilities && (
          <div className="flex flex-wrap gap-1">
            {model.capabilities.slice(0, 3).map(capability => (
              <Badge
                key={capability}
                variant="outline"
                className="text-xs px-1 py-0"
                style={{ borderColor: CAPABILITY_COLORS[capability] || '#6B7280', color: CAPABILITY_COLORS[capability] || '#6B7280' }}
              >
                {capability.replace('_', ' ')}
              </Badge>
            ))}
            {model.capabilities.length > 3 && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                +{model.capabilities.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {!model.isAvailable && (
            <Badge variant="destructive" className="text-xs w-fit">
              Unavailable
            </Badge>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant={compareModels.find(m => m.id === model.id) ? "default" : "outline"}
              onClick={(e) => {
                e.stopPropagation()
                toggleModelComparison(model)
              }}
              className="text-xs h-7"
            >
              {compareModels.find(m => m.id === model.id) ? (
                <>
                  <Target className="h-3 w-3 mr-1" />
                  Comparing
                </>
              ) : (
                <>
                  <Target className="h-3 w-3 mr-1" />
                  Compare
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderModelDetail = () => {
    if (!selectedModel) return null

    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{selectedModel.name}</CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  style={{ backgroundColor: `${PROVIDER_COLORS[selectedModel.provider]}20`, color: PROVIDER_COLORS[selectedModel.provider] }}
                >
                  {selectedModel.provider}
                </Badge>
                {selectedModel.company && (
                  <Badge variant="outline">{selectedModel.company}</Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" onClick={() => setSelectedModel(null)}>
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {selectedModel.description && (
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{selectedModel.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {selectedModel.contextLength && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Context Length</span>
                </div>
                <p className="text-lg font-bold text-blue-600">
                  {(selectedModel.contextLength / 1000).toFixed(0)}K tokens
                </p>
              </div>
            )}

            {selectedModel.pricing && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Pricing</span>
                </div>
                <div className="text-sm">
                  <p>Input: ${(selectedModel.pricing.input || 0 * 1000000).toFixed(2)}/M</p>
                  <p>Output: ${(selectedModel.pricing.output || 0 * 1000000).toFixed(2)}/M</p>
                </div>
              </div>
            )}
          </div>

          {selectedModel.capabilities && (
            <div>
              <h4 className="font-medium mb-3">Capabilities</h4>
              <div className="flex flex-wrap gap-2">
                {selectedModel.capabilities.map(capability => (
                  <Badge
                    key={capability}
                    className="text-sm px-3 py-1"
                    style={{ backgroundColor: `${CAPABILITY_COLORS[capability]}20`, color: CAPABILITY_COLORS[capability] }}
                  >
                    {capability.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn(
      "min-h-screen relative overflow-hidden",
      GRADIENT_BACKGROUNDS.primary
    )}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-300/10 dark:bg-violet-700/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/4 -left-40 w-96 h-96 bg-emerald-300/10 dark:bg-emerald-700/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-amber-300/10 dark:bg-amber-700/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute -bottom-32 left-1/3 w-80 h-80 bg-cyan-300/10 dark:bg-cyan-700/10 rounded-full blur-3xl animate-pulse delay-3000"></div>
      </div>

      <div className="relative z-10">
        <PageHeader
          title="LLM Models Analytics"
          description="Comprehensive analysis and comparison of Large Language Models with real-time insights"
        />

        <div className="container py-6 sm:py-10">
        {/* Header Controls */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search models, companies, descriptions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="w-[140px]">
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
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {uniqueCompanies.map(company => (
                      <SelectItem key={company} value={company}>{company}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {compareModels.length > 0 && (
                  <Button
                    onClick={() => setActiveTab('compare')}
                    variant="secondary"
                    className="bg-gradient-to-r from-violet-100 to-purple-100 hover:from-violet-200 hover:to-purple-200 text-violet-700 border-violet-200"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Compare ({compareModels.length})
                  </Button>
                )}

                <Button
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Enhanced Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
                GRADIENT_BACKGROUNDS.success
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardContent className="relative p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg">
                          <Brain className="h-7 w-7 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                          {stats?.totalModels || 0}
                        </p>
                        <p className="text-sm text-muted-foreground font-medium">Total Models</p>
                        <div className="flex items-center gap-1 mt-1">
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          <span className="text-xs text-green-600 font-medium">Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Growth</div>
                      <div className="text-sm font-bold text-green-600">+12%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
                GRADIENT_BACKGROUNDS.secondary
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-teal-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardContent className="relative p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg">
                          <Globe className="h-7 w-7 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                          {Object.keys(stats?.providers || {}).length}
                        </p>
                        <p className="text-sm text-muted-foreground font-medium">Providers</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Building className="h-3 w-3 text-blue-500" />
                          <span className="text-xs text-blue-600 font-medium">Diverse</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Coverage</div>
                      <div className="text-sm font-bold text-blue-600">98%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
                GRADIENT_BACKGROUNDS.primary
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-violet-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardContent className="relative p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl shadow-lg">
                          <MessageSquare className="h-7 w-7 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                          {stats?.avgContextLength ? (stats.avgContextLength / 1000).toFixed(0) + 'K' : '0'}
                        </p>
                        <p className="text-sm text-muted-foreground font-medium">Avg Context</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Gauge className="h-3 w-3 text-purple-500" />
                          <span className="text-xs text-purple-600 font-medium">Efficient</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Max</div>
                      <div className="text-sm font-bold text-purple-600">2M</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
                GRADIENT_BACKGROUNDS.accent
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-orange-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardContent className="relative p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg">
                          <DollarSign className="h-7 w-7 text-white" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                          ${stats?.priceRanges?.input.min.toFixed(2) || '0'}
                        </p>
                        <p className="text-sm text-muted-foreground font-medium">Min Input Price</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Crown className="h-3 w-3 text-amber-500" />
                          <span className="text-xs text-amber-600 font-medium">Premium</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Range</div>
                      <div className="text-sm font-bold text-orange-600">$0-50</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Enhanced Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Provider Distribution with Enhanced Design */}
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.neutral
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-cyan-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                      <Building className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        Provider Distribution
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Market share by provider</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={providerChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={140}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {providerChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke={entry.color}
                            strokeWidth={2}
                            style={{
                              filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
                            }}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2 mt-6">
                    {providerChartData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div
                          className="w-4 h-4 rounded-full shadow-sm"
                          style={{ backgroundColor: entry.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{entry.name}</div>
                          <div className="text-xs text-muted-foreground">{entry.value} models</div>
                        </div>
                        <div className="text-sm font-bold text-right">
                          {stats?.totalModels ? Math.round((entry.value / stats.totalModels) * 100) : 0}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Capability Distribution with Enhanced Design */}
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.neutral
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400/10 to-pink-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Capability Distribution
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Feature adoption across models</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={capabilityChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Bar dataKey="value" fill="url(#capabilityGradient)" radius={[4, 4, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#8B5CF6"
                        strokeWidth={3}
                        dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                      />
                      <defs>
                        <linearGradient id="capabilityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#EC4899" />
                        </linearGradient>
                      </defs>
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Advanced Analytics Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Context Length Analysis */}
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.secondary
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-teal-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                        Context Length Distribution
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Memory capacity across model landscape</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={contextLengthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Bar dataKey="count" fill="url(#contextGradient)" radius={[4, 4, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#10B981"
                        strokeWidth={3}
                        dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                      />
                      <defs>
                        <linearGradient id="contextGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" />
                          <stop offset="100%" stopColor="#14B8A6" />
                        </linearGradient>
                      </defs>
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {contextLengthData.map((range, index) => (
                      <div key={range.name} className="p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
                        <div className="font-medium text-sm">{range.name}</div>
                        <div className="text-xs text-muted-foreground">{range.count} models</div>
                        <div className="text-lg font-bold text-emerald-600">
                          {stats?.totalModels ? Math.round((range.count / stats.totalModels) * 100) : 0}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Model Capability Radar Chart */}
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.primary
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-violet-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                        Capability Matrix
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Multi-dimensional model analysis</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={[
                      { capability: 'Vision', value: models.filter(m => m.capabilities?.includes('vision')).length },
                      { capability: 'Function Calling', value: models.filter(m => m.capabilities?.includes('function_calling')).length },
                      { capability: 'Streaming', value: models.filter(m => m.capabilities?.includes('streaming')).length },
                      { capability: 'Coding', value: models.filter(m => m.capabilities?.includes('coding')).length },
                      { capability: 'Reasoning', value: models.filter(m => m.capabilities?.includes('reasoning')).length },
                      { capability: 'Memory', value: models.filter(m => m.capabilities?.includes('memory')).length }
                    ]}>
                      <PolarGrid stroke="rgba(0,0,0,0.2)" />
                      <PolarAngleAxis dataKey="capability" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis tick={{ fontSize: 10 }} />
                      <Radar
                        name="Models"
                        dataKey="value"
                        stroke="#8B5CF6"
                        fill="#8B5CF6"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                      <RechartsTooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Pricing and Performance Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.accent
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-orange-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        Pricing Analysis
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Cost distribution patterns</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={pricingData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#F59E0B"
                        fill="url(#pricingGradient)"
                        strokeWidth={3}
                      />
                      <defs>
                        <linearGradient id="pricingGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F59E0B" />
                          <stop offset="100%" stopColor="#F97316" />
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.success
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-emerald-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        Performance Metrics
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Feature adoption rates</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative space-y-4">
                  {[
                    { name: 'Vision Models', capability: 'vision', color: 'bg-blue-500', icon: Eye },
                    { name: 'Function Calling', capability: 'function_calling', color: 'bg-purple-500', icon: Zap },
                    { name: 'Streaming Support', capability: 'streaming', color: 'bg-green-500', icon: Globe },
                    { name: 'Coding Focused', capability: 'coding', color: 'bg-red-500', icon: Cpu }
                  ].map((metric, index) => {
                    const count = models.filter(m => m.capabilities?.includes(metric.capability)).length
                    const percentage = models.length > 0 ? (count / models.length) * 100 : 0
                    const Icon = metric.icon

                    return (
                      <div key={metric.name} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", metric.color)}></div>
                            <span className="text-sm font-medium">{metric.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{count}</span>
                            <span className="text-xs text-muted-foreground">({percentage.toFixed(0)}%)</span>
                          </div>
                        </div>
                        <div className="relative">
                          <Progress
                            value={percentage}
                            className="h-3"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse rounded-full"></div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.neutral
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-slate-400/10 to-gray-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-slate-500 to-gray-500 rounded-lg">
                      <Gauge className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-slate-600 to-gray-600 bg-clip-text text-transparent">
                        Quality Indicators
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Model reliability metrics</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Available Models', value: models.filter(m => m.isAvailable).length, total: models.length, color: 'text-green-600' },
                      { label: 'Premium Pricing', value: models.filter(m => m.pricing?.input && m.pricing.input > 5).length, total: models.length, color: 'text-amber-600' },
                      { label: 'Large Context', value: models.filter(m => (m.contextLength || 0) > 32000).length, total: models.length, color: 'text-blue-600' },
                      { label: 'Multi-modal', value: models.filter(m => m.capabilities?.includes('vision')).length, total: models.length, color: 'text-purple-600' }
                    ].map((item, index) => (
                      <div key={item.label} className="p-3 rounded-lg bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20">
                        <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                        <div className={cn("text-lg font-bold", item.color)}>
                          {item.total > 0 ? Math.round((item.value / item.total) * 100) : 0}%
                        </div>
                        <div className="text-xs text-muted-foreground">{item.value}/{item.total}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="models" className="space-y-6">
            {/* Sort Controls */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">Sort by:</span>
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger className="w-[160px]">
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
                    variant="outline"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Showing {filteredAndSortedModels.length} of {models.length} models
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Models Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
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
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAndSortedModels.map(renderModelCard)}
                </div>

                {filteredAndSortedModels.length === 0 && (
                  <Card className="p-8 text-center">
                    <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No models found</h3>
                    <p className="text-muted-foreground">Try adjusting your search criteria or filters.</p>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="compare" className="space-y-6">
            {/* Comparison Controls */}
            <Card className={cn(
              "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
              GRADIENT_BACKGROUNDS.primary
            )}>
              <div className="absolute inset-0 bg-gradient-to-r from-violet-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                        Model Comparison Suite
                      </CardTitle>
                      <p className="text-sm text-muted-foreground font-normal">
                        Side-by-side analysis of selected models ({compareModels.length}/4)
                      </p>
                    </div>
                  </div>
                  {compareModels.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={clearComparison}
                      className="hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                    >
                      Clear All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="relative">
                {compareModels.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="relative mb-6">
                      <Target className="h-16 w-16 text-muted-foreground/50 mx-auto" />
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-full blur-xl"></div>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No Models Selected</h3>
                    <p className="text-muted-foreground mb-6">
                      Go to the Models tab and click "Add to Compare" on any model card to start comparing.
                    </p>
                    <Button
                      onClick={() => setActiveTab('models')}
                      className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                    >
                      Browse Models
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Selected Models Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {compareModels.map((model) => {
                        const qualityScore = getModelQualityScore(model)
                        return (
                          <Card key={model.id} className="relative group hover:shadow-lg transition-all duration-300">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-sm font-medium truncate" title={model.name}>
                                    {model.name}
                                  </CardTitle>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs mt-1"
                                    style={{
                                      backgroundColor: `${PROVIDER_COLORS[model.provider]}20`,
                                      color: PROVIDER_COLORS[model.provider]
                                    }}
                                  >
                                    {model.provider}
                                  </Badge>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleModelComparison(model)}
                                  className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                                >
                                  ×
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-3">
                              <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-muted-foreground">Context</span>
                                  <span className="font-medium">{(() => {
                                    const length = model.contextLength;
                                    if (!length) return 'N/A';
                                    if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`;
                                    if (length >= 1000) return `${(length / 1000).toFixed(0)}K`;
                                    return length.toString();
                                  })()}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-muted-foreground">Input Price</span>
                                  <span className="font-medium">
                                    ${(model.pricing?.input || 0).toFixed(2)}/M
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-muted-foreground">Quality Score</span>
                                  <span className="font-bold text-violet-600">{qualityScore}%</span>
                                </div>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-gradient-to-r from-violet-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${qualityScore}%` }}
                                ></div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>

                    {/* Detailed Comparison */}
                    <div className="space-y-6">
                      {/* Performance Radar Chart */}
                      <Card className={cn(
                        "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                        GRADIENT_BACKGROUNDS.secondary
                      )}>
                        <CardHeader className="relative">
                          <CardTitle className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
                              <Activity className="h-5 w-5 text-white" />
                            </div>
                            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                              Performance Comparison
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="relative">
                          <ResponsiveContainer width="100%" height={400}>
                            <RadarChart data={compareModels[0] ? getModelPerformanceData(compareModels[0]) : []}>
                              <PolarGrid stroke="rgba(0,0,0,0.2)" />
                              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                              <PolarRadiusAxis tick={{ fontSize: 10 }} />
                              {compareModels.slice(0, 1).map((model, index) => (
                                <Radar
                                  key={model.id}
                                  name={model.name}
                                  dataKey="value"
                                  stroke={PROVIDER_COLORS[model.provider] || '#6B7280'}
                                  fill={PROVIDER_COLORS[model.provider] || '#6B7280'}
                                  fillOpacity={0.3}
                                  strokeWidth={2}
                                />
                              ))}
                              <RechartsTooltip />
                            </RadarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Feature Comparison Table */}
                      <Card className={cn(
                        "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                        GRADIENT_BACKGROUNDS.accent
                      )}>
                        <CardHeader className="relative">
                          <CardTitle className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                              <Layers className="h-5 w-5 text-white" />
                            </div>
                            <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                              Feature Comparison
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="relative">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left p-3 font-medium">Feature</th>
                                  {compareModels.map((model) => (
                                    <th key={model.id} className="text-center p-3 font-medium min-w-[150px]">
                                      <div className="text-sm">{model.name}</div>
                                      <Badge
                                        variant="secondary"
                                        className="text-xs mt-1"
                                        style={{
                                          backgroundColor: `${PROVIDER_COLORS[model.provider]}20`,
                                          color: PROVIDER_COLORS[model.provider]
                                        }}
                                      >
                                        {model.provider}
                                      </Badge>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b">
                                  <td className="p-3 font-medium">Context Length</td>
                                  {compareModels.map((model) => (
                                    <td key={model.id} className="text-center p-3">
                                      <span className="font-bold text-lg">{(() => {
                                        const length = model.contextLength;
                                        if (!length) return 'N/A';
                                        if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`;
                                        if (length >= 1000) return `${(length / 1000).toFixed(0)}K`;
                                        return length.toString();
                                      })()}</span>
                                    </td>
                                  ))}
                                </tr>
                                <tr className="border-b">
                                  <td className="p-3 font-medium">Input Price</td>
                                  {compareModels.map((model) => (
                                    <td key={model.id} className="text-center p-3">
                                      <span className="font-bold">
                                        ${(model.pricing?.input || 0).toFixed(2)}/M
                                      </span>
                                    </td>
                                  ))}
                                </tr>
                                <tr className="border-b">
                                  <td className="p-3 font-medium">Output Price</td>
                                  {compareModels.map((model) => (
                                    <td key={model.id} className="text-center p-3">
                                      <span className="font-bold">
                                        ${(model.pricing?.output || 0).toFixed(2)}/M
                                      </span>
                                    </td>
                                  ))}
                                </tr>
                                <tr className="border-b">
                                  <td className="p-3 font-medium">Capabilities</td>
                                  {compareModels.map((model) => (
                                    <td key={model.id} className="text-center p-3">
                                      <div className="flex flex-wrap gap-1 justify-center">
                                        {model.capabilities?.slice(0, 2).map((cap) => (
                                          <Badge key={cap} variant="outline" className="text-xs">
                                            {cap.replace('_', ' ')}
                                          </Badge>
                                        ))}
                                        {(model.capabilities?.length || 0) > 2 && (
                                          <Badge variant="outline" className="text-xs">
                                            +{(model.capabilities.length || 0) - 2}
                                          </Badge>
                                        )}
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                                <tr className="border-b">
                                  <td className="p-3 font-medium">Quality Score</td>
                                  {compareModels.map((model) => {
                                    const score = getModelQualityScore(model)
                                    return (
                                      <td key={model.id} className="text-center p-3">
                                        <div className="flex flex-col items-center gap-2">
                                          <span className="font-bold text-xl text-violet-600">{score}%</span>
                                          <div className="w-full max-w-[80px] bg-gray-200 rounded-full h-2">
                                            <div
                                              className="bg-gradient-to-r from-violet-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                                              style={{ width: `${score}%` }}
                                            ></div>
                                          </div>
                                        </div>
                                      </td>
                                    )
                                  })}
                                </tr>
                                <tr>
                                  <td className="p-3 font-medium">Availability</td>
                                  {compareModels.map((model) => (
                                    <td key={model.id} className="text-center p-3">
                                      <Badge
                                        variant={model.isAvailable ? "default" : "destructive"}
                                        className="text-xs"
                                      >
                                        {model.isAvailable ? "Available" : "Unavailable"}
                                      </Badge>
                                    </td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Model Detail Modal */}
        {selectedModel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            {renderModelDetail()}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
