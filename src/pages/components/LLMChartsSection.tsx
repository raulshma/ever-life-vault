import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Building, Zap, Target, Gauge } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Area,
  AreaChart,
  Tooltip
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

const GRADIENT_BACKGROUNDS = {
  primary: 'bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 dark:from-violet-950/20 dark:via-purple-950/20 dark:to-indigo-950/20',
  secondary: 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/20 dark:via-teal-950/20 dark:to-cyan-950/20',
  accent: 'bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-red-950/20',
  neutral: 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-950/20 dark:via-gray-950/20 dark:to-zinc-950/20',
  success: 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/20 dark:via-emerald-950/20 dark:to-teal-950/20',
  warning: 'bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-950/20 dark:via-amber-950/20 dark:to-orange-950/20',
  danger: 'bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 dark:from-red-950/20 dark:via-rose-950/20 dark:to-pink-950/20'
}

interface DrillDownFilter {
  type: 'provider' | 'capability' | 'contextRange' | 'pricingRange' | 'quality' | 'availability' | null
  value: string | { min: number; max: number } | null
  title: string
}

interface LLMChartsSectionProps {
  models: LLMModel[]
  stats: LLMStats | null
  onDrillDown: (filter: DrillDownFilter) => void
}

export default function LLMChartsSection({ models, stats, onDrillDown }: LLMChartsSectionProps) {
  // Optimized chart data calculations
  const providerChartData = useMemo(() => {
    if (!stats?.providers) return []
    return Object.entries(stats.providers)
      .map(([provider, count]) => ({
        name: provider,
        value: count,
        color: PROVIDER_COLORS[provider] || '#6B7280'
      }))
      .sort((a, b) => b.value - a.value)
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
      .slice(0, 10)
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

    return ranges.filter(range => range.count > 0)
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

  return (
    <>
      {/* Provider Distribution */}
      <Card className={cn("group relative overflow-hidden transition-all duration-300 hover:shadow-xl", GRADIENT_BACKGROUNDS.neutral)}>
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
                cursor="pointer"
                onClick={(data) => {
                  if (data && data.name) {
                    onDrillDown({
                      type: 'provider',
                      value: data.name,
                      title: `${data.name} Models`
                    })
                  }
                }}
              >
                {providerChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke={entry.color}
                    strokeWidth={2}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Capability Distribution */}
      <Card className={cn("group relative overflow-hidden transition-all duration-300 hover:shadow-xl", GRADIENT_BACKGROUNDS.neutral)}>
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
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar
                dataKey="value"
                fill="url(#capabilityGradient)"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(data) => {
                  if (data && data.name) {
                    onDrillDown({
                      type: 'capability',
                      value: data.name.toLowerCase().replace(' ', '_'),
                      title: `${data.name} Models`
                    })
                  }
                }}
              />
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
    </>
  )
}
