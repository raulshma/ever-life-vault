import React, { useState, useEffect, useMemo, Suspense, lazy, startTransition } from 'react'
import PageHeader from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { fetchWithAuth } from '@/lib/aggregatorClient'
import {
  Search,
  RefreshCw,
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
  Building,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Rocket,
  Shield,
  Gem,
  Crown,
  Flame,
  Mountain,
  Sun,
  Gauge,
  Maximize2,
  Calculator
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
  ComposedChart} from 'recharts'

// Lazy loaded chart components for better performance
const ChartsSection = lazy(() => import('./components/LLMChartsSection'))

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

interface ResourceAnalysisData {
  cpuData: Array<{
    name: string
    cpuUtilization: number
    efficiency: number
    provider: string
  }>
  memoryData: Array<{
    name: string
    memoryUsage: number
    memoryEfficiency: number
    provider: string
  }>
  gpuData: Array<{
    name: string
    gpuUtilization: number
    gpuMemory: number
    provider: string
  }>
}

interface PerformanceBenchmarkingData {
  name: string
  provider: string
  latency: number
  throughput: number
  memoryUsage: number
  energyEfficiency: number
  accuracy: number
  contextLength: number
  avgPrice: number
}

interface EnergyEfficiencyData {
  name: string
  provider: string
  powerConsumption: number
  tokensPerWatt: number
  carbonFootprint: number
  efficiencyScore: number
  contextLength: number
}

interface CostEfficiencyData {
  name: string
  efficiency: number
  contextLength: number
  avgPrice: number
  provider: string
}

interface ReleaseTimelineData {
  date: string
  model: string
  provider: string
  type: string
  impact: string
  timelineIndex: number
  color: string
}

interface DrillDownFilter {
  type: 'provider' | 'capability' | 'contextRange' | 'pricingRange' | 'quality' | 'availability' | null
  value: string | { min: number; max: number } | null
  title: string
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [capabilityFilter, setCapabilityFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'contextLength' | 'inputPrice' | 'outputPrice'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [activeTab, setActiveTab] = useState('overview')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null)
  const [compareModels, setCompareModels] = useState<LLMModel[]>([])
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [drillDownFilter, setDrillDownFilter] = useState<DrillDownFilter | null>(null)
  const [drillDownModels, setDrillDownModels] = useState<LLMModel[]>([])
  // New interactive features state
  const [interactiveMode, setInteractiveMode] = useState(false)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['contextLength', 'pricing', 'performance'])
  const [customFilters, setCustomFilters] = useState<Record<string, any>>({})
  const [scenarioComparison, setScenarioComparison] = useState(false)
  const [realTimeUpdates, setRealTimeUpdates] = useState(false)

  // Simplified vs advanced views
  const [analyticsAdvanced, setAnalyticsAdvanced] = useState(false)
  const [costsAdvanced, setCostsAdvanced] = useState(false)

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
      const response = await fetchWithAuth('/api/llm/models' + (forceRefresh ? '?forceRefresh=true' : ''))
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
      const response = await fetchWithAuth('/api/llm/stats')
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

  // Memoized utility functions for performance
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

  // Drill-down filtering
  const handleDrillDown = React.useCallback(async (filter: DrillDownFilter) => {
    setDrillDownFilter(filter)

    try {
      const queryParams = new URLSearchParams()

      switch (filter.type) {
        case 'provider': {
          queryParams.append('providers', filter.value as string)
          break
        }
        case 'capability': {
          queryParams.append('capabilities', filter.value as string)
          break
        }
        case 'contextRange': {
          const contextRange = filter.value as { min: number; max: number }
          queryParams.append('minContextLength', contextRange.min.toString())
          if (contextRange.max < Infinity) {
            queryParams.append('maxContextLength', contextRange.max.toString())
          }
          break
        }
        case 'pricingRange': {
          const pricingRange = filter.value as { min: number; max: number }
          queryParams.append('maxInputPrice', pricingRange.max.toString())
          break
        }
        case 'quality': {
          // Handle quality-based filtering on client side for now
          const qualityModels = models.filter(model => {
            const score = getModelQualityScore(model)
            switch (filter.value) {
              case 'premium':
                return score >= 80
              case 'good':
                return score >= 60 && score < 80
              case 'average':
                return score >= 40 && score < 60
              case 'poor':
                return score < 40
              default:
                return true
            }
          })
          setDrillDownModels(qualityModels)
          setActiveTab('models')
          return
        }
        case 'availability': {
          const availabilityModels = models.filter(model =>
            filter.value === 'available' ? model.isAvailable : !model.isAvailable
          )
          setDrillDownModels(availabilityModels)
          setActiveTab('models')
          return
        }
      }

      const response = await fetchWithAuth(`/api/llm/models/filtered?${queryParams}`)
      if (!response.ok) throw new Error('Failed to fetch filtered models')
      const data = await response.json()

      if (data.success) {
        setDrillDownModels(data.data)
        setActiveTab('models')
      }
    } catch (error) {
      console.error('Error fetching filtered models:', error)
    }
  }, [models, getModelQualityScore])

  // Clear drill-down filter
  const clearDrillDown = React.useCallback(() => {
    setDrillDownFilter(null)
    setDrillDownModels([])
  }, [])

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

  // Interactive features functions
  const toggleMetric = React.useCallback((metric: string) => {
    setSelectedMetrics(prev =>
      prev.includes(metric)
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    )
  }, [])

  const updateCustomFilter = React.useCallback((key: string, value: any) => {
    setCustomFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const clearCustomFilters = React.useCallback(() => {
    setCustomFilters({})
  }, [])

  const toggleInteractiveMode = React.useCallback(() => {
    setInteractiveMode(prev => !prev)
  }, [])

  const toggleScenarioComparison = React.useCallback(() => {
    setScenarioComparison(prev => !prev)
  }, [])

  

  // Memoized model data to avoid recalculations
  const modelsWithComputedData = useMemo(() => {
    return models.map(model => ({
      ...model,
      qualityScore: getModelQualityScore(model),
      performanceData: getModelPerformanceData(model)
    }))
  }, [models, getModelQualityScore, getModelPerformanceData])

  // Memoized drill-down models with computed data
  const drillDownModelsWithComputedData = useMemo(() => {
    return drillDownModels.map(model => ({
      ...model,
      qualityScore: getModelQualityScore(model),
      performanceData: getModelPerformanceData(model)
    }))
  }, [drillDownModels, getModelQualityScore, getModelPerformanceData])

  // Optimized filtering and sorting with debounced search
  const filteredAndSortedModels = useMemo(() => {
    if (!models.length) return []

    // Early return if no search query but other filters exist
    if (debouncedSearchQuery === '' && providerFilter === 'all' && companyFilter === 'all' && capabilityFilter === 'all') {
      return models.slice().sort((a, b) => {
        let aVal: string | number, bVal: string | number

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
    }

    // Pre-compute search terms for better performance
    const searchLower = debouncedSearchQuery.toLowerCase()
    const hasSearch = searchLower.length > 0

    const filtered = models.filter(model => {
      // Search filter - optimized with early returns
      if (hasSearch) {
        const nameMatch = model.name.toLowerCase().includes(searchLower)
        const descMatch = model.description?.toLowerCase().includes(searchLower)
        const companyMatch = model.company?.toLowerCase().includes(searchLower)
        if (!nameMatch && !descMatch && !companyMatch) return false
      }

      // Provider filter
      if (providerFilter !== 'all' && model.provider !== providerFilter) return false

      // Company filter
      if (companyFilter !== 'all' && model.company !== companyFilter) return false

      // Capability filter - optimized with Set for O(1) lookups
      if (capabilityFilter !== 'all') {
        if (!model.capabilities?.includes(capabilityFilter)) return false
      }

      return true
    })

    // Sort models - optimized comparison
    if (filtered.length > 1) {
      filtered.sort((a, b) => {
        let aVal: string | number, bVal: string | number

      switch (sortBy) {
        case 'name': {
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        }
        case 'contextLength': {
          aVal = a.contextLength || 0
          bVal = b.contextLength || 0
          break
        }
        case 'inputPrice': {
          aVal = a.pricing?.input || 0
          bVal = b.pricing?.input || 0
          break
        }
        case 'outputPrice': {
          aVal = a.pricing?.output || 0
          bVal = b.pricing?.output || 0
          break
        }
        default: {
          aVal = a.name
          bVal = b.name
        }
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    }

    return filtered
  }, [models, debouncedSearchQuery, providerFilter, companyFilter, capabilityFilter, sortBy, sortOrder])

  // Optimized unique values for filters with better performance
  const uniqueProviders = useMemo(() => {
    const providers = new Set<string>()
    models.forEach(m => providers.add(m.provider))
    return Array.from(providers).sort()
  }, [models])

  const uniqueCompanies = useMemo(() => {
    const companies = new Set<string>()
    models.forEach(m => {
      if (m.company) companies.add(m.company)
    })
    return Array.from(companies).sort()
  }, [models])

  const uniqueCapabilities = useMemo(() => {
    const capabilities = new Set<string>()
    models.forEach(m => {
      m.capabilities?.forEach(cap => capabilities.add(cap))
    })
    return Array.from(capabilities).sort()
  }, [models])

  // Optimized chart data calculations with improved memoization
  const providerChartData = useMemo(() => {
    if (!stats?.providers) return []
    return Object.entries(stats.providers).map(([provider, count]) => ({
      name: provider,
      value: count,
      color: PROVIDER_COLORS[provider] || '#6B7280'
    })).sort((a, b) => b.value - a.value) // Sort by count for better visualization
  }, [stats?.providers])

  const capabilityChartData = useMemo(() => {
    if (!models.length) return []

    const capabilityCounts = new Map<string, number>()
    models.forEach(model => {
      model.capabilities?.forEach(cap => {
        capabilityCounts.set(cap, (capabilityCounts.get(cap) || 0) + 1)
      })
    })

    return Array.from(capabilityCounts.entries())
      .map(([capability, count]) => ({
      name: capability.replace('_', ' '),
      value: count,
      color: CAPABILITY_COLORS[capability] || '#6B7280'
    }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // Limit to top 10 for performance
  }, [models])

  const contextLengthData = useMemo(() => {
    if (!models.length) return []

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

    return ranges.filter(range => range.count > 0) // Only show ranges with data
  }, [models])

  const pricingData = useMemo(() => {
    if (!models.length) return []

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

    return priceRanges.filter(range => range.count > 0)
  }, [models])

  const averageContextLength = useMemo(() => {
    if (stats?.avgContextLength) return stats.avgContextLength
    if (!models.length) return 0
    const total = models.reduce((sum, m) => sum + (m.contextLength || 0), 0)
    return Math.round(total / models.length)
  }, [stats?.avgContextLength, models])

  const providerCount = useMemo(() => {
    if (stats?.providers) return Object.keys(stats.providers).length
    return new Set(models.map(m => m.provider)).size
  }, [stats?.providers, models])

  const priceStats = useMemo(() => {
    const inputPrices = models
      .map(m => m.pricing?.input)
      .filter((p): p is number => typeof p === 'number' && isFinite(p) && p >= 0)
    const outputPrices = models
      .map(m => m.pricing?.output)
      .filter((p): p is number => typeof p === 'number' && isFinite(p) && p >= 0)

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    return {
      minInput: inputPrices.length ? Math.min(...inputPrices) : 0,
      avgInput: avg(inputPrices),
      minOutput: outputPrices.length ? Math.min(...outputPrices) : 0,
      avgOutput: avg(outputPrices)
    }
  }, [models])

  // New advanced visualization data
  const capabilityMatrixData = useMemo(() => {
    if (!models.length) return []

    const providers = [...new Set(models.map(m => m.provider))]
    const capabilities = ['vision', 'function_calling', 'streaming', 'coding', 'reasoning', 'memory', 'fine_tuning']

    const matrixData: Array<{ provider: string; capability: string; value: number; intensity: number }> = []

    providers.forEach(provider => {
      const providerModels = models.filter(m => m.provider === provider)
      capabilities.forEach(capability => {
        const modelsWithCapability = providerModels.filter(m =>
          m.capabilities?.includes(capability)
        ).length
        const intensity = providerModels.length > 0 ? (modelsWithCapability / providerModels.length) * 100 : 0
        matrixData.push({
          provider,
          capability: capability.replace('_', ' '),
          value: modelsWithCapability,
          intensity
        })
      })
    })

    return matrixData
  }, [models])

  const bubbleChartData = useMemo(() => {
    if (!models.length) return []

    return models.map(model => ({
      name: model.name,
      x: Math.log10((model.contextLength || 1000) + 1), // Log scale for context length
      y: (Math.max(0, model.pricing?.input || 0) + Math.max(0, model.pricing?.output || 0)) / 2, // Average pricing
      z: (model.capabilities?.length || 1) * 10, // Bubble size based on capabilities
      provider: model.provider,
      contextLength: model.contextLength || 0,
      avgPrice: (Math.max(0, model.pricing?.input || 0) + Math.max(0, model.pricing?.output || 0)) / 2,
      capabilities: model.capabilities?.length || 0
    }))
  }, [models])

  const timelineData = useMemo(() => {
    if (!models.length) return []

    // Group models by release month (simulated since we don't have real dates)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const timelineData: Array<{ month: string; models: number; providers: Set<string> }> = []

    months.forEach(month => {
      const monthModels = models.slice(0, Math.floor(Math.random() * models.length)) // Simulated data
      timelineData.push({
        month,
        models: monthModels.length,
        providers: new Set(monthModels.map(m => m.provider))
      })
    })

    return timelineData
  }, [models])

  const networkData = useMemo(() => {
    if (!models.length) return { nodes: [], links: [] }

    const nodes = models.slice(0, 10).map(model => ({ // Limit for performance
      id: model.id,
      name: model.name,
      provider: model.provider,
      val: (model.contextLength || 1000) / 10000 // Node size based on context
    }))

    const links: Array<{ source: string; target: string; value: number }> = []
    nodes.forEach((node, i) => {
      nodes.forEach((otherNode, j) => {
        if (i !== j && node.provider === otherNode.provider) {
          links.push({
            source: node.id,
            target: otherNode.id,
            value: 1
          })
        }
      })
    })

    return { nodes, links }
  }, [models])

  const costEfficiencyData = useMemo((): CostEfficiencyData[] => {
    if (!models.length) return []

    return models.map(model => {
      const inputPrice = Math.max(0, model.pricing?.input || 0)
      const outputPrice = Math.max(0, model.pricing?.output || 0)
      const avgPrice = (inputPrice + outputPrice) / 2
      const efficiency = avgPrice > 0 ? ((model.contextLength || 1000) / 1000) / avgPrice : 0
      return {
        name: model.name,
        efficiency,
        contextLength: model.contextLength || 0,
        avgPrice,
        provider: model.provider
      }
    }).sort((a, b) => b.efficiency - a.efficiency).slice(0, 10)
  }, [models])

  // Performance benchmarking data
  const performanceBenchmarkingData = useMemo((): PerformanceBenchmarkingData[] => {
    if (!models.length) return []

    return models.map(model => {
      // Simulated performance metrics (in real app, these would come from API)
      const baseLatency = Math.random() * 1000 + 100 // 100-1100ms
      const throughput = Math.random() * 50 + 10 // 10-60 tokens/sec
      const memoryUsage = Math.random() * 8 + 2 // 2-10GB
      const energyEfficiency = Math.random() * 50 + 20 // 20-70 tokens/watt
      const accuracy = Math.random() * 20 + 80 // 80-100%

      // Adjust metrics based on model characteristics
      const contextMultiplier = Math.log10((model.contextLength || 1000) + 1) / 6
      const priceMultiplier = (model.pricing?.input || 1) / 5

      return {
        name: model.name,
        provider: model.provider,
        latency: baseLatency * (1 + contextMultiplier) * (1 + priceMultiplier),
        throughput: throughput * (1 - contextMultiplier) * (1 - priceMultiplier),
        memoryUsage: memoryUsage * (1 + contextMultiplier * 0.5),
        energyEfficiency: energyEfficiency * (1 - contextMultiplier) * (1 - priceMultiplier),
        accuracy: Math.min(100, accuracy + (contextMultiplier * 5)),
        contextLength: model.contextLength || 0,
        avgPrice: (Math.max(0, model.pricing?.input || 0) + Math.max(0, model.pricing?.output || 0)) / 2
      }
    })
  }, [models])

  // Energy efficiency analysis
  const energyEfficiencyData = useMemo((): EnergyEfficiencyData[] => {
    if (!models.length) return []

    return models.map(model => {
      const powerConsumption = Math.random() * 100 + 50 // 50-150W
      const tokensPerWatt = Math.random() * 100 + 20 // 20-120 tokens/watt
      const carbonFootprint = powerConsumption * 0.0005 // kg CO2 per hour
      const efficiencyScore = (tokensPerWatt / powerConsumption) * 100

      return {
        name: model.name,
        provider: model.provider,
        powerConsumption,
        tokensPerWatt,
        carbonFootprint,
        efficiencyScore,
        contextLength: model.contextLength || 0
      }
    }).sort((a, b) => b.efficiencyScore - a.efficiencyScore)
  }, [models])

  // Memory and resource analysis
  const resourceAnalysisData = useMemo((): ResourceAnalysisData => {
    if (!models.length) return { cpuData: [], memoryData: [], gpuData: [] }

    const cpuData = models.map(model => ({
      name: model.name,
      cpuUtilization: Math.random() * 60 + 20, // 20-80%
      efficiency: ((model.contextLength || 1000) / 1000) / ((model.pricing?.input || 1) * 10),
      provider: model.provider
    })).sort((a, b) => b.efficiency - a.efficiency)

    const memoryData = models.map(model => {
      const memoryUsage = Math.random() * 16 + 2 // 2-18GB
      return {
        name: model.name,
        memoryUsage,
        memoryEfficiency: ((model.contextLength || 1000) / 1000) / Math.max(memoryUsage, 1),
        provider: model.provider
      }
    }).sort((a, b) => b.memoryEfficiency - a.memoryEfficiency)

    const gpuData = models.map(model => ({
      name: model.name,
      gpuUtilization: Math.random() * 70 + 30, // 30-100%
      gpuMemory: Math.random() * 24 + 8, // 8-32GB
      provider: model.provider
    })).sort((a, b) => b.gpuUtilization - a.gpuUtilization)

    return { cpuData, memoryData, gpuData }
  }, [models])

  // Trend analysis and forecasting data
  const trendAnalysisData = useMemo(() => {
    if (!models.length) return { adoptionTrends: [], performanceTrends: [], costTrends: [] }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Adoption trends - showing model adoption over time
    const adoptionTrends = months.map((month, index) => ({
      month,
      gptModels: Math.floor(Math.random() * 50) + (index * 5),
      claudeModels: Math.floor(Math.random() * 40) + (index * 3),
      otherModels: Math.floor(Math.random() * 30) + (index * 2),
      total: 0
    })).map(item => ({
      ...item,
      total: item.gptModels + item.claudeModels + item.otherModels
    }))

    // Performance trends - showing performance improvements over time
    const performanceTrends = months.map((month, index) => ({
      month,
      averageLatency: Math.max(100, 800 - (index * 30) + Math.random() * 50),
      averageThroughput: 20 + (index * 8) + Math.random() * 15,
      averageAccuracy: 75 + (index * 2) + Math.random() * 5
    }))

    // Cost trends - showing cost changes over time
    const costTrends = months.map((month, index) => ({
      month,
      averageInputCost: Math.max(0.5, 3.0 - (index * 0.15) + Math.random() * 0.3),
      averageOutputCost: Math.max(0.5, 6.0 - (index * 0.25) + Math.random() * 0.4),
      totalCost: 0
    })).map(item => ({
      ...item,
      totalCost: (item.averageInputCost + item.averageOutputCost) * 100
    }))

    return { adoptionTrends, performanceTrends, costTrends }
  }, [models])

  // Model release timeline data
  const releaseTimelineData = useMemo((): ReleaseTimelineData[] => {
    const releases = [
      { date: '2023-03', model: 'GPT-4', provider: 'OpenAI', type: 'Major Release', impact: 'High' },
      { date: '2023-05', model: 'Claude-2', provider: 'Anthropic', type: 'Major Release', impact: 'High' },
      { date: '2023-07', model: 'PaLM 2', provider: 'Google', type: 'Major Release', impact: 'Medium' },
      { date: '2023-09', model: 'Llama-2', provider: 'Meta', type: 'Open Source', impact: 'High' },
      { date: '2023-11', model: 'GPT-4 Turbo', provider: 'OpenAI', type: 'Performance Update', impact: 'Medium' },
      { date: '2024-01', model: 'Claude-3', provider: 'Anthropic', type: 'Major Release', impact: 'High' },
      { date: '2024-03', model: 'Gemini Pro', provider: 'Google', type: 'Major Release', impact: 'High' },
      { date: '2024-05', model: 'GPT-4o', provider: 'OpenAI', type: 'Performance Update', impact: 'High' },
      { date: '2024-07', model: 'Claude-3.5', provider: 'Anthropic', type: 'Performance Update', impact: 'Medium' },
      { date: '2024-09', model: 'Llama-3.1', provider: 'Meta', type: 'Major Release', impact: 'High' }
    ]

    return releases.map((release, index) => ({
      ...release,
      timelineIndex: index,
      color: PROVIDER_COLORS[release.provider] || '#6B7280'
    }))
  }, [])

  // Typed quality indicators for DrillDownFilter
  type FilterType = Exclude<DrillDownFilter['type'], null>
  type FilterValue = NonNullable<DrillDownFilter['value']>
  const qualityIndicatorItems = useMemo(() => ([
    {
      label: 'Available Models',
      value: models.filter(m => m.isAvailable).length,
      total: models.length,
      color: 'text-green-600',
      type: 'availability' as FilterType,
      filterValue: 'available' as FilterValue
    },
    {
      label: 'Premium Pricing',
      value: models.filter(m => m.pricing?.input && m.pricing.input > 5).length,
      total: models.length,
      color: 'text-amber-600',
      type: 'pricingRange' as FilterType,
      filterValue: { min: 5, max: Infinity } as FilterValue
    },
    {
      label: 'Large Context',
      value: models.filter(m => (m.contextLength || 0) > 32000).length,
      total: models.length,
      color: 'text-blue-600',
      type: 'contextRange' as FilterType,
      filterValue: { min: 32000, max: Infinity } as FilterValue
    },
    {
      label: 'Multi-modal',
      value: models.filter(m => m.capabilities?.includes('vision')).length,
      total: models.length,
      color: 'text-purple-600',
      type: 'capability' as FilterType,
      filterValue: 'vision' as FilterValue
    }
  ]), [models])

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Initial data fetch
  useEffect(() => {
    fetchModels()
    fetchStats()
  }, [fetchModels, fetchStats])

  const renderModelCard = React.useCallback((model: LLMModel) => (
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

          {model.pricing?.input && model.pricing.input > 0 && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">${(model.pricing.input * 1000000).toFixed(2)}</span>
              <span className="text-muted-foreground">/M in</span>
            </div>
          )}

          {model.pricing?.output && model.pricing.output > 0 && (
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
  ), [setSelectedModel, toggleModelComparison, compareModels])

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

                <Button
                  onClick={toggleInteractiveMode}
                  variant={interactiveMode ? "default" : "outline"}
                  className={interactiveMode ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700" : ""}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Interactive Mode
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => {
          if (value === 'analytics') {
            setShowAnalytics(false)
            startTransition(() => setActiveTab(value))
            requestAnimationFrame(() => setShowAnalytics(true))
          } else {
            setShowAnalytics(false)
            setActiveTab(value)
          }
        }} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
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
                        <p
                          className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => handleDrillDown({ type: 'provider', value: 'all', title: 'All Models' })}
                          title="Click to view all models"
                        >
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
                        <p
                          className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => handleDrillDown({ type: 'provider', value: 'all', title: 'All Providers' })}
                          title="Click to view providers breakdown"
                        >
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

                        {/* Lazy Loaded Charts */}
            <Suspense fallback={
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                  <CardContent>
                    <div className="h-80 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
                <Card className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                  <CardContent>
                    <div className="h-80 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            </div>
            }>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartsSection
                  models={models}
                  stats={stats}
                  onDrillDown={handleDrillDown}
                />
              </div>
            </Suspense>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Simple view header */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Analytics</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Advanced</span>
                <Button size="sm" variant="outline" onClick={() => setAnalyticsAdvanced(v => !v)}>
                  {analyticsAdvanced ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>

            {/* Concise summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Models</div>
                  <div className="text-xl font-semibold">{models.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Providers</div>
                  <div className="text-xl font-semibold">{providerCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Avg Context</div>
                  <div className="text-xl font-semibold">{averageContextLength.toLocaleString()} tokens</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Capabilities tracked</div>
                  <div className="text-xl font-semibold">{capabilityChartData.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* One focused chart: context distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Context length distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={contextLengthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#10B981" radius={[3,3,0,0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Advanced view (collapsed by default) */}
            {analyticsAdvanced && (
              <div className="space-y-6">
                {/* Existing verbose content retained for power users */}
                {/* Advanced Analytics Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.warning
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-orange-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                      <Gauge className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        Capability Matrix
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Provider capability coverage analysis</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={capabilityMatrixData.slice(0, 15)} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        dataKey="capability"
                        type="category"
                        tick={{ fontSize: 11 }}
                        width={80}
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-white p-3 border rounded-lg shadow-lg">
                                <p className="font-medium">{data.provider}</p>
                                <p className="text-sm text-muted-foreground">{data.capability}</p>
                                <p className="text-sm font-bold text-amber-600">
                                  {data.value} models ({data.intensity.toFixed(1)}% coverage)
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar
                        dataKey="intensity"
                        fill="url(#matrixGradient)"
                        radius={[0, 4, 4, 0]}
                        isAnimationActive={false}
                      />
                      <defs>
                        <linearGradient id="matrixGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#F59E0B" />
                          <stop offset="100%" stopColor="#FB923C" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Bubble Chart: Context vs Price */}
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.success
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-emerald-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        Context vs Price Analysis
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Bubble size represents capability count</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <ResponsiveContainer width="100%" height={350}>
                    <ScatterChart data={bubbleChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis
                        dataKey="x"
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Context Length (log scale)', position: 'bottom', offset: -5 }}
                      />
                      <YAxis
                        dataKey="y"
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Average Price ($)', angle: -90, position: 'insideLeft' }}
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="bg-white p-3 border rounded-lg shadow-lg">
                                <p className="font-medium">{data.name}</p>
                                <p className="text-sm text-muted-foreground">{data.provider}</p>
                                <p className="text-sm">Context: {data.contextLength.toLocaleString()} tokens</p>
                                <p className="text-sm">Price: ${data.avgPrice.toFixed(2)}/M</p>
                                <p className="text-sm">Capabilities: {data.capabilities}</p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      {Object.entries(PROVIDER_COLORS).map(([provider, color]) => (
                        <Scatter
                          key={provider}
                          dataKey="z"
                          data={bubbleChartData.filter(d => d.provider === provider)}
                          fill={color}
                          shape="circle"
                          isAnimationActive={false}
                        />
                      ))}
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Model Timeline and Network Analysis */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Model Release Timeline */}
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.primary
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-violet-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                        Model Release Timeline
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Model launches and provider activity over time</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Bar
                        dataKey="models"
                        fill="url(#timelineGradient)"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="models"
                        stroke="#8B5CF6"
                        strokeWidth={3}
                        dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                        isAnimationActive={false}
                      />
                      <defs>
                        <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#A855F7" />
                        </linearGradient>
                      </defs>
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Cost Efficiency Leaderboard */}
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.accent
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-orange-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                      <Crown className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        Cost Efficiency Leaderboard
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Context per dollar - top performers</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-3">
                    {costEfficiencyData.slice(0, 8).map((item, index) => (
                      <div
                        key={item.name}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 cursor-pointer hover:shadow-md transition-all"
                        onClick={() => {
                          const model = models.find(m => m.name === item.name)
                          if (model) setSelectedModel(model)
                        }}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.provider}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-amber-600">
                            {item.efficiency.toFixed(1)}K/$</p>
                          <p className="text-xs text-muted-foreground">
                            {item.contextLength.toLocaleString()} tokens
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Benchmarking Section */}
            <Card className={cn(
              "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
              GRADIENT_BACKGROUNDS.success
            )}>
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-emerald-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      Performance Benchmarking
                    </span>
                    <p className="text-sm text-muted-foreground font-normal">Multi-dimensional performance analysis and optimization</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Benchmark Metrics */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Key Performance Indicators</h4>
                    <div className="space-y-3">
                      {[
                        { label: 'Average Context Efficiency', value: '85%', color: 'text-green-600', icon: Target },
                        { label: 'Price Performance Ratio', value: '7.2', color: 'text-blue-600', icon: DollarSign },
                        { label: 'Capability Density', value: '4.1 avg', color: 'text-purple-600', icon: Layers },
                        { label: 'Provider Reliability', value: '92%', color: 'text-emerald-600', icon: Shield }
                      ].map((metric, index) => {
                        const Icon = metric.icon
                        return (
                          <div key={metric.label} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{metric.label}</span>
                            </div>
                            <span className={`text-sm font-bold ${metric.color}`}>{metric.value}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Optimization Suggestions */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">AI-Powered Recommendations</h4>
                    <div className="space-y-3">
                      {[
                        { type: 'cost', suggestion: 'Switch to OpenRouter for 40% cost savings', impact: 'High' },
                        { type: 'performance', suggestion: 'Use Anthropic for complex reasoning tasks', impact: 'Medium' },
                        { type: 'capability', suggestion: 'Leverage GPT-4V for multimodal applications', impact: 'High' },
                        { type: 'efficiency', suggestion: 'Implement model routing for optimal performance', impact: 'Medium' }
                      ].map((rec, index) => (
                        <div key={index} className="p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800">
                          <div className="flex items-start justify-between mb-1">
                            <span className="text-xs font-medium text-green-700 dark:text-green-300">
                              {rec.type === 'cost' ? '💰' : rec.type === 'performance' ? '⚡' : rec.type === 'capability' ? '🧠' : '🔧'}
                              {rec.type.charAt(0).toUpperCase() + rec.type.slice(1)} Optimization
                            </span>
                            <Badge variant={rec.impact === 'High' ? 'default' : 'secondary'} className="text-xs">
                              {rec.impact} Impact
                            </Badge>
                          </div>
                          <p className="text-xs text-green-700 dark:text-green-300">{rec.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Cost Calculators */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Advanced Cost Analysis</h4>
                    <div className="space-y-4">
                      {/* Basic Cost Calculator */}
                      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                        <h5 className="font-medium text-sm mb-3">Cost Calculator</h5>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Monthly Usage</span>
                            <span className="text-sm font-bold">1M tokens</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Average Cost</span>
                            <span className="text-sm font-bold text-blue-600">$2.50</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Best Alternative</span>
                            <span className="text-sm font-bold text-green-600">-$1.20</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Potential Savings</span>
                            <span className="text-lg font-bold text-green-600">$14.40/month</span>
                          </div>
                        </div>
                      </div>

                      {/* ROI Calculator */}
                      <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
                        <h5 className="font-medium text-sm mb-3">ROI Calculator</h5>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Development Time Saved</span>
                            <span className="text-sm font-bold">120 hours</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Hourly Rate</span>
                            <span className="text-sm font-bold">$85/h</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Model Cost</span>
                            <span className="text-sm font-bold text-red-600">-$2,500</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Net ROI</span>
                            <span className="text-lg font-bold text-green-600">+8,200%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Benchmarking Analysis */}
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
                      Performance Benchmarking
                    </span>
                    <p className="text-sm text-muted-foreground font-normal">Latency, throughput, and accuracy metrics</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Average Latency', value: '450ms', color: 'text-blue-600', icon: Clock },
                    { label: 'Peak Throughput', value: '45.2 t/s', color: 'text-green-600', icon: Zap },
                    { label: 'Memory Efficiency', value: '8.2 GB/model', color: 'text-purple-600', icon: Cpu },
                    { label: 'Energy per Token', value: '0.12 Wh', color: 'text-emerald-600', icon: Gauge }
                  ].map((metric, index) => {
                    const Icon = metric.icon
                    return (
                      <div key={metric.label} className="p-3 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">{metric.label}</span>
                        </div>
                        <p className={`text-lg font-bold ${metric.color}`}>{metric.value}</p>
                      </div>
                    )
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Latency vs Context Length */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Latency vs Context Length</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <ScatterChart data={performanceBenchmarkingData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis
                          dataKey="contextLength"
                          tick={{ fontSize: 11 }}
                          label={{ value: 'Context Length', position: 'bottom', offset: -5 }}
                        />
                        <YAxis
                          dataKey="latency"
                          tick={{ fontSize: 11 }}
                          label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              return (
                                <div className="bg-white p-3 border rounded-lg shadow-lg">
                                  <p className="font-medium">{data.name}</p>
                                  <p className="text-sm">Latency: {data.latency.toFixed(0)}ms</p>
                                  <p className="text-sm">Context: {data.contextLength.toLocaleString()} tokens</p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        {Object.entries(PROVIDER_COLORS).map(([provider, color]) => (
                          <Scatter
                            key={provider}
                            dataKey="latency"
                            data={performanceBenchmarkingData.filter(d => d.provider === provider)}
                            fill={color}
                            shape="circle"
                            isAnimationActive={false}
                          />
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Throughput vs Price */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Throughput vs Price Efficiency</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <ComposedChart data={performanceBenchmarkingData.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: 'none',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        <Bar dataKey="throughput" fill="url(#throughputGradient)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Line type="monotone" dataKey="throughput" stroke="#10B981" strokeWidth={2} />
                        <defs>
                          <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" />
                            <stop offset="100%" stopColor="#14B8A6" />
                          </linearGradient>
                        </defs>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Energy Efficiency and Sustainability */}
            <Card className={cn(
              "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
              GRADIENT_BACKGROUNDS.warning
            )}>
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-orange-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                    <Sun className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                      Energy Efficiency & Sustainability
                    </span>
                    <p className="text-sm text-muted-foreground font-normal">Power consumption and carbon footprint analysis</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Avg Power Usage', value: '95W', color: 'text-orange-600', icon: Zap },
                    { label: 'Carbon Footprint', value: '47g CO2/h', color: 'text-red-600', icon: Mountain },
                    { label: 'Energy Efficiency', value: '68 t/W', color: 'text-green-600', icon: Sun }
                  ].map((metric, index) => {
                    const Icon = metric.icon
                    return (
                      <div key={metric.label} className="p-3 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium">{metric.label}</span>
                        </div>
                        <p className={`text-lg font-bold ${metric.color}`}>{metric.value}</p>
                      </div>
                    )
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Energy Efficiency Leaderboard */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Energy Efficiency Leaderboard</h4>
                    <div className="space-y-2">
                      {energyEfficiencyData.slice(0, 6).map((item, index) => (
                        <div
                          key={item.name}
                          className="flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 cursor-pointer hover:shadow-md transition-all"
                          onClick={() => {
                            const model = models.find(m => m.name === item.name)
                            if (model) setSelectedModel(model)
                          }}
                        >
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.provider}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-amber-600">{item.efficiencyScore.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">{item.powerConsumption.toFixed(0)}W</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Power Consumption vs Performance */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Power Consumption vs Performance</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <ScatterChart data={energyEfficiencyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis
                          dataKey="powerConsumption"
                          tick={{ fontSize: 11 }}
                          label={{ value: 'Power Consumption (W)', position: 'bottom', offset: -5 }}
                        />
                        <YAxis
                          dataKey="tokensPerWatt"
                          tick={{ fontSize: 11 }}
                          label={{ value: 'Tokens/Watt', angle: -90, position: 'insideLeft' }}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              return (
                                <div className="bg-white p-3 border rounded-lg shadow-lg">
                                  <p className="font-medium">{data.name}</p>
                                  <p className="text-sm">Power: {data.powerConsumption.toFixed(1)}W</p>
                                  <p className="text-sm">Efficiency: {data.tokensPerWatt.toFixed(1)} tokens/W</p>
                                  <p className="text-sm">Carbon: {data.carbonFootprint.toFixed(3)}kg CO2/h</p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        {Object.entries(PROVIDER_COLORS).map(([provider, color]) => (
                          <Scatter
                            key={provider}
                            dataKey="tokensPerWatt"
                            data={energyEfficiencyData.filter(d => d.provider === provider)}
                            fill={color}
                            shape="circle"
                            isAnimationActive={false}
                          />
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resource Utilization Analysis */}
            <Card className={cn(
              "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
              GRADIENT_BACKGROUNDS.primary
            )}>
              <div className="absolute inset-0 bg-gradient-to-r from-violet-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg">
                    <Cpu className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                      Resource Utilization Analysis
                    </span>
                    <p className="text-sm text-muted-foreground font-normal">CPU, memory, and GPU resource metrics</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Avg CPU Usage', value: '58%', color: 'text-blue-600', icon: Cpu },
                    { label: 'Memory Efficiency', value: '7.8 GB/tok', color: 'text-purple-600', icon: Layers },
                    { label: 'GPU Utilization', value: '82%', color: 'text-green-600', icon: Zap }
                  ].map((metric, index) => {
                    const Icon = metric.icon
                    return (
                      <div key={metric.label} className="p-3 rounded-lg bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4 text-violet-600" />
                          <span className="text-sm font-medium">{metric.label}</span>
                        </div>
                        <p className={`text-lg font-bold ${metric.color}`}>{metric.value}</p>
                      </div>
                    )
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* CPU Efficiency */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">CPU Efficiency Ranking</h4>
                    <div className="space-y-2">
                      {resourceAnalysisData.cpuData.slice(0, 5).map((item, index) => (
                        <div key={item.name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.provider}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-blue-600">{item.cpuUtilization.toFixed(1)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Memory Usage */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Memory Usage Analysis</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={resourceAnalysisData.memoryData.slice(0, 8)} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tick={{ fontSize: 10 }}
                          width={80}
                        />
                        <Bar dataKey="memoryUsage" fill="url(#memoryGradient)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                        <defs>
                          <linearGradient id="memoryGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#8B5CF6" />
                            <stop offset="100%" stopColor="#A855F7" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* GPU Performance */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">GPU Performance Metrics</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={resourceAnalysisData.gpuData.slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Bar dataKey="gpuUtilization" fill="url(#gpuGradient)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Line type="monotone" dataKey="gpuMemory" stroke="#EF4444" strokeWidth={2} />
                        <defs>
                          <linearGradient id="gpuGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" />
                            <stop offset="100%" stopColor="#14B8A6" />
                          </linearGradient>
                        </defs>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trend Analysis and Forecasting */}
            <Card className={cn(
              "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
              GRADIENT_BACKGROUNDS.warning
            )}>
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-orange-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                      Trend Analysis & Forecasting
                    </span>
                    <p className="text-sm text-muted-foreground font-normal">Market adoption, performance evolution, and cost trends</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Model Adoption Trends */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Model Adoption Trends</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={trendAnalysisData.adoptionTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
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
                          dataKey="gptModels"
                          stackId="1"
                          stroke="#10B981"
                          fill="#10B981"
                          fillOpacity={0.6}
                        />
                        <Area
                          type="monotone"
                          dataKey="claudeModels"
                          stackId="1"
                          stroke="#F59E0B"
                          fill="#F59E0B"
                          fillOpacity={0.6}
                        />
                        <Area
                          type="monotone"
                          dataKey="otherModels"
                          stackId="1"
                          stroke="#8B5CF6"
                          fill="#8B5CF6"
                          fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span className="text-xs">GPT Models</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-amber-500 rounded"></div>
                        <span className="text-xs">Claude Models</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-violet-500 rounded"></div>
                        <span className="text-xs">Other Models</span>
                      </div>
                    </div>
                  </div>

                  {/* Performance Evolution */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Performance Evolution</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={trendAnalysisData.performanceTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: 'none',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="averageLatency"
                          stroke="#EF4444"
                          strokeWidth={2}
                          dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="averageThroughput"
                          stroke="#10B981"
                          strokeWidth={2}
                          dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="averageAccuracy"
                          stroke="#8B5CF6"
                          strokeWidth={2}
                          dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                        <span className="text-xs">Latency (ms)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span className="text-xs">Throughput (t/s)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-violet-500 rounded"></div>
                        <span className="text-xs">Accuracy (%)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cost Trend Analysis */}
                <div className="mt-6">
                  <h4 className="font-medium text-sm mb-4">Cost Trend Analysis</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={trendAnalysisData.costTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Bar dataKey="totalCost" fill="url(#costGradient)" radius={[4, 4, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="averageInputCost"
                        stroke="#F59E0B"
                        strokeWidth={3}
                        dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="averageOutputCost"
                        stroke="#EF4444"
                        strokeWidth={3}
                        dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
                      />
                      <defs>
                        <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#A855F7" />
                        </linearGradient>
                      </defs>
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-violet-500 rounded"></div>
                      <span className="text-xs">Total Cost</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-amber-500 rounded"></div>
                      <span className="text-xs">Input Cost ($/1M)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span className="text-xs">Output Cost ($/1M)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Model Release Timeline */}
            <Card className={cn(
              "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
              GRADIENT_BACKGROUNDS.success
            )}>
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-emerald-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      Model Release Timeline
                    </span>
                    <p className="text-sm text-muted-foreground font-normal">Major model releases and their market impact</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-4">
                  {releaseTimelineData.map((release, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => {
                        const model = models.find(m => m.name === release.model)
                        if (model) setSelectedModel(model)
                      }}
                    >
                      <div className="flex flex-col items-center">
                        <div
                          className="w-4 h-4 rounded-full border-2 border-white shadow-md"
                          style={{ backgroundColor: release.color }}
                        ></div>
                        {index < releaseTimelineData.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600 mt-1"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{release.model}</h4>
                          <Badge
                            variant="secondary"
                            className="text-xs"
                            style={{
                              backgroundColor: `${release.color}20`,
                              color: release.color
                            }}
                          >
                            {release.provider}
                          </Badge>
                          <Badge
                            variant={release.impact === 'High' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {release.impact} Impact
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {release.date} • {release.type}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-gradient-to-r from-green-500 to-emerald-500 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${release.impact === 'High' ? 100 : release.impact === 'Medium' ? 70 : 40}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium text-green-600 whitespace-nowrap">
                            Market Impact
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline Summary */}
                <div className="mt-6 p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <h4 className="font-medium text-sm mb-3">Timeline Insights</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Major Releases</p>
                      <p className="text-lg font-bold text-green-600">
                        {releaseTimelineData.filter(r => r.impact === 'High').length}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Average Release Frequency</p>
                      <p className="text-lg font-bold text-green-600">2.3 months</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Leading Provider</p>
                      <p className="text-lg font-bold text-green-600">OpenAI</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Growth Rate</p>
                      <p className="text-lg font-bold text-green-600">+45%/year</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="costs" className="space-y-6">
            {/* Simple view header */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Cost Analysis</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Advanced</span>
                <Button size="sm" variant="outline" onClick={() => setCostsAdvanced(v => !v)}>
                  {costsAdvanced ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>

            {/* Concise summary (computed) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Avg input $/M tok</div>
                  <div className="text-xl font-semibold">${priceStats.avgInput.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Avg output $/M tok</div>
                  <div className="text-xl font-semibold">${priceStats.avgOutput.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Min input $/M tok</div>
                  <div className="text-xl font-semibold">${priceStats.minInput.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Min output $/M tok</div>
                  <div className="text-xl font-semibold">${priceStats.minOutput.toFixed(2)}</div>
                </CardContent>
              </Card>
            </div>

            {/* One focused chart: input price distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Input price distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={pricingData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Area type="monotone" dataKey="count" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.4} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Advanced view (collapsed by default) */}
            {costsAdvanced && (
            <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Multi-Objective Optimization */}
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.warning
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-orange-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        Multi-Objective Optimization
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Balance cost, performance, and quality</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-4">
                    {/* Optimization Scenarios */}
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        {
                          scenario: 'Cost-Focused',
                          recommendation: 'Switch to OpenRouter + smaller models',
                          savings: '$284/month',
                          tradeoffs: ['-15% accuracy', '+200ms latency']
                        },
                        {
                          scenario: 'Performance-Focused',
                          recommendation: 'Use Claude-3 Opus for critical tasks',
                          savings: '-$156/month',
                          tradeoffs: ['+25% accuracy', '-100ms latency']
                        },
                        {
                          scenario: 'Balanced',
                          recommendation: 'Mix of GPT-4 and Claude-3 Sonnet',
                          savings: '$127/month',
                          tradeoffs: ['+10% accuracy', '+50ms latency']
                        }
                      ].map((opt, index) => (
                        <div key={opt.scenario} className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm text-amber-800 dark:text-amber-200">{opt.scenario}</h4>
                            <Badge variant={parseFloat(opt.savings) > 0 ? 'default' : 'destructive'} className="text-xs">
                              {opt.savings}
                            </Badge>
                          </div>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">{opt.recommendation}</p>
                          <div className="flex flex-wrap gap-1">
                            {opt.tradeoffs.map((tradeoff, i) => (
                              <span key={i} className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-1 rounded">
                                {tradeoff}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Predictor */}
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.success
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-emerald-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        Cost Predictor & Forecasting
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Predict future costs and usage patterns</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-4">
                    {/* Usage Forecasting */}
                    <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-green-950/20">
                      <h4 className="font-medium text-sm mb-3">3-Month Cost Forecast</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Current (Month 1)</span>
                          <span className="text-sm font-bold">$1,247</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Predicted (Month 2)</span>
                          <span className="text-sm font-bold text-amber-600">$1,412</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Predicted (Month 3)</span>
                          <span className="text-sm font-bold text-red-600">$1,623</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Growth Rate</span>
                          <span className="text-sm font-bold text-red-600">+15%/month</span>
                        </div>
                      </div>
                    </div>

                    {/* Optimization Recommendations */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Optimization Recommendations</h4>
                      <div className="space-y-2">
                        {[
                          { action: 'Implement model caching', impact: '15% cost reduction', priority: 'High' },
                          { action: 'Set up usage quotas', impact: '10% cost reduction', priority: 'Medium' },
                          { action: 'Use batch processing', impact: '20% cost reduction', priority: 'High' },
                          { action: 'Optimize prompt length', impact: '8% cost reduction', priority: 'Low' }
                        ].map((rec, index) => (
                          <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{rec.action}</p>
                              <p className="text-xs text-muted-foreground">{rec.impact}</p>
                            </div>
                            <Badge variant={rec.priority === 'High' ? 'default' : rec.priority === 'Medium' ? 'secondary' : 'outline'} className="text-xs">
                              {rec.priority}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Advanced Cost Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost Breakdown by Category */}
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.primary
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-violet-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                        Cost Breakdown Analysis
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Detailed cost allocation by category</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Input Tokens', value: 684, color: '#8B5CF6' },
                          { name: 'Output Tokens', value: 312, color: '#10B981' },
                          { name: 'Image Generation', value: 156, color: '#F59E0B' },
                          { name: 'Function Calls', value: 95, color: '#EF4444' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {[
                          { name: 'Input Tokens', value: 684, color: '#8B5CF6' },
                          { name: 'Output Tokens', value: 312, color: '#10B981' },
                          { name: 'Image Generation', value: 156, color: '#F59E0B' },
                          { name: 'Function Calls', value: 95, color: '#EF4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            const percentage = ((data.value / 1247) * 100).toFixed(1)
                            return (
                              <div className="bg-white p-3 border rounded-lg shadow-lg">
                                <p className="font-medium">{data.name}</p>
                                <p className="text-sm">${data.value} ({percentage}%)</p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {[
                      { name: 'Input Tokens', value: 684, color: '#8B5CF6' },
                      { name: 'Output Tokens', value: 312, color: '#10B981' },
                      { name: 'Image Generation', value: 156, color: '#F59E0B' },
                      { name: 'Function Calls', value: 95, color: '#EF4444' }
                    ].map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <div className="flex-1">
                          <p className="text-xs font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">${item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Interactive Cost Calculator */}
              <Card className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
                GRADIENT_BACKGROUNDS.accent
              )}>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-orange-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                      <Calculator className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        Interactive Cost Calculator
                      </span>
                      <p className="text-sm text-muted-foreground font-normal">Calculate costs for your specific use case</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-4">
                    {/* Calculator Inputs */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Input Tokens</label>
                        <Input
                          type="number"
                          placeholder="1000"
                          defaultValue="100000"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Output Tokens</label>
                        <Input
                          type="number"
                          placeholder="500"
                          defaultValue="25000"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Model</label>
                        <Select defaultValue="gpt-4">
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4">GPT-4</SelectItem>
                            <SelectItem value="claude-3-opus">Claude-3 Opus</SelectItem>
                            <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                            <SelectItem value="llama-2-70b">Llama-2 70B</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Requests/Day</label>
                        <Input
                          type="number"
                          placeholder="100"
                          defaultValue="1000"
                          className="text-sm"
                        />
                      </div>
                    </div>

                    {/* Calculator Results */}
                    <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
                      <h4 className="font-medium text-sm mb-3">Cost Breakdown</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Daily Cost</span>
                          <span className="text-sm font-bold text-amber-600">$12.45</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Monthly Cost</span>
                          <span className="text-sm font-bold text-amber-600">$373.50</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Yearly Cost</span>
                          <span className="text-sm font-bold text-amber-600">$4,482</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Cost per 1K tokens</span>
                          <span className="text-sm font-bold text-amber-600">$0.012</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            </div>
            )}
          </TabsContent>

          <TabsContent value="models" className="space-y-6">
            {/* Drill-down Filter Header */}
            {drillDownFilter && (
              <Card className="border-l-4 border-l-violet-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-violet-100 dark:bg-violet-900/20 rounded-lg">
                        <Eye className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{drillDownFilter.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {drillDownModels.length} models matching your criteria
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={clearDrillDown}
                      variant="outline"
                      className="hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                    >
                      <Maximize2 className="h-4 w-4 mr-2" />
                      Back to All Models
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sort Controls */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">Sort by:</span>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'name' | 'contextLength' | 'inputPrice' | 'outputPrice')}>
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
                    {drillDownFilter
                      ? `Showing ${drillDownModels.length} filtered models`
                      : `Showing ${filteredAndSortedModels.length} of ${models.length} models`
                    }
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Models Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: Math.min(9, (drillDownFilter ? drillDownModels.length : filteredAndSortedModels.length) || 9) }).map((_, i) => (
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
                  {(drillDownFilter ? drillDownModels : filteredAndSortedModels)
                    .slice(0, 50) // Limit initial render to 50 items for performance
                    .map(renderModelCard)}
                </div>

                {/* Show load more button if there are more models */}
                {(drillDownFilter ? drillDownModels : filteredAndSortedModels).length > 50 && (
                  <div className="text-center mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        // For now, just show a message. In a real implementation,
                        // you'd implement pagination or virtual scrolling
                        alert('Load more functionality would be implemented here for better performance with large datasets')
                      }}
                    >
                      Load More Models ({(drillDownFilter ? drillDownModels : filteredAndSortedModels).length - 50} remaining)
                    </Button>
                  </div>
                )}

                {(drillDownFilter ? drillDownModels : filteredAndSortedModels).length === 0 && (
                  <Card className="p-8 text-center">
                    <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {drillDownFilter ? 'No models found for this filter' : 'No models found'}
                    </h3>
                    <p className="text-muted-foreground">
                      {drillDownFilter
                        ? 'Try selecting a different filter or go back to all models.'
                        : 'Try adjusting your search criteria or filters.'
                      }
                    </p>
                    {drillDownFilter && (
                      <Button
                        onClick={clearDrillDown}
                        variant="outline"
                        className="mt-4"
                      >
                        Back to All Models
                      </Button>
                    )}
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
                                    ${Math.max(0, model.pricing?.input || 0).toFixed(2)}/M
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
                                        ${Math.max(0, model.pricing?.input || 0).toFixed(2)}/M
                                      </span>
                                    </td>
                                  ))}
                                </tr>
                                <tr className="border-b">
                                  <td className="p-3 font-medium">Output Price</td>
                                  {compareModels.map((model) => (
                                    <td key={model.id} className="text-center p-3">
                                      <span className="font-bold">
                                        ${Math.max(0, model.pricing?.output || 0).toFixed(2)}/M
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

        {/* Interactive Features Panel */}
        {interactiveMode && (
          <div className="fixed top-20 right-4 z-40 bg-white dark:bg-gray-900 border rounded-lg shadow-2xl p-4 w-80 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Interactive Controls</h3>
              <Button
                onClick={toggleInteractiveMode}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>

            {/* Metric Selection */}
            <div className="space-y-4 mb-6">
              <h4 className="font-medium text-sm">Display Metrics</h4>
              <div className="space-y-2">
                {[
                  { key: 'contextLength', label: 'Context Length', icon: MessageSquare },
                  { key: 'pricing', label: 'Pricing', icon: DollarSign },
                  { key: 'performance', label: 'Performance', icon: Activity },
                  { key: 'capabilities', label: 'Capabilities', icon: Zap },
                  { key: 'quality', label: 'Quality Score', icon: Star }
                ].map((metric) => {
                  const Icon = metric.icon
                  return (
                    <div key={metric.key} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={metric.key}
                        checked={selectedMetrics.includes(metric.key)}
                        onChange={() => toggleMetric(metric.key)}
                        className="rounded"
                      />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <label htmlFor={metric.key} className="text-sm cursor-pointer">
                        {metric.label}
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Custom Filters */}
            <div className="space-y-4 mb-6">
              <h4 className="font-medium text-sm">Custom Filters</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Min Context Length</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={customFilters.minContext || ''}
                    onChange={(e) => updateCustomFilter('minContext', e.target.value ? parseInt(e.target.value) : null)}
                    className="text-sm h-8"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Max Input Price ($/M)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="10.00"
                    value={customFilters.maxInputPrice || ''}
                    onChange={(e) => updateCustomFilter('maxInputPrice', e.target.value ? parseFloat(e.target.value) : null)}
                    className="text-sm h-8"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Required Capabilities</label>
                  <Select
                    value={customFilters.requiredCapability || 'all'}
                    onValueChange={(value) => updateCustomFilter('requiredCapability', value === 'all' ? null : value)}
                  >
                    <SelectTrigger className="text-sm h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any</SelectItem>
                      <SelectItem value="vision">Vision</SelectItem>
                      <SelectItem value="function_calling">Function Calling</SelectItem>
                      <SelectItem value="streaming">Streaming</SelectItem>
                      <SelectItem value="coding">Coding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={clearCustomFilters}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Scenario Comparison */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Scenario Comparison</h4>
                <input
                  type="checkbox"
                  checked={scenarioComparison}
                  onChange={toggleScenarioComparison}
                  className="rounded"
                />
              </div>
              {scenarioComparison && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                    <h5 className="font-medium text-xs mb-2">Cost-Effective Scenario</h5>
                    <p className="text-xs text-muted-foreground mb-2">
                      Optimized for cost while maintaining quality
                    </p>
                    <div className="text-xs">
                      <div>Models: OpenRouter, Grok</div>
                      <div className="text-green-600 font-bold">Est. Savings: $250/month</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                    <h5 className="font-medium text-xs mb-2">Performance Scenario</h5>
                    <p className="text-xs text-muted-foreground mb-2">
                      Optimized for speed and accuracy
                    </p>
                    <div className="text-xs">
                      <div>Models: Claude-3, GPT-4</div>
                      <div className="text-blue-600 font-bold">Est. Performance: +40%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Real-time Updates */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Real-time Updates</h4>
                <input
                  type="checkbox"
                  checked={realTimeUpdates}
                  onChange={() => setRealTimeUpdates(!realTimeUpdates)}
                  className="rounded"
                />
              </div>
              {realTimeUpdates && (
                <div className="text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live data updates enabled</span>
                  </div>
                  <div className="mt-1">Updates every 30 seconds</div>
                </div>
              )}
            </div>
          </div>
        )}

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
