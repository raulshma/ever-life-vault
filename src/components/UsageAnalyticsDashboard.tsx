/**
 * Usage Analytics Dashboard
 * 
 * Comprehensive analytics dashboard for API usage with charts,
 * trends, and insights for cost management and optimization.
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Clock,
  Zap,
  AlertTriangle,
  Download,
  RefreshCw,
  Calendar
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'

interface UsageData {
  date: string
  requests: number
  tokens: number
  cost: number
}

interface ModelUsage {
  model: string
  requests: number
  tokens: number
  cost: number
  avgResponseTime: number
}

interface AnalyticsData {
  usageStats: {
    totalRequests: number
    totalTokens: number
    totalCost: number
    dailyUsage: UsageData[]
    topModels: ModelUsage[]
  }
  keyUtilization: Array<{
    keyId: string
    keyName: string
    provider: string
    dailyUsagePercent: number
    monthlyUsagePercent: number
    isActive: boolean
    lastUsed?: string
  }>
  recentErrors: Array<{
    id: string
    request_timestamp: string
    provider: string
    model_used?: string
    error_message: string
  }>
  summary: {
    totalKeys: number
    activeKeys: number
    totalRequests: number
    totalTokens: number
    totalCost: number
    avgResponseTime: number
  }
}

export function UsageAnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30')
  const [providerFilter, setProviderFilter] = useState('all')
  const { toast } = useToast()
  const { session } = useAuth()

  const authHeaders = {
    'Authorization': `Bearer ${session?.access_token || ''}`,
    'Content-Type': 'application/json'
  }

  useEffect(() => {
    loadAnalyticsData()
  }, [timeRange, providerFilter, session])

  const loadAnalyticsData = async () => {
    if (!session) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to view analytics',
        variant: 'destructive'
      })
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        days: timeRange,
        ...(providerFilter !== 'all' && { provider: providerFilter })
      })

      const response = await fetch(`/api/analytics/dashboard?${params}`, {
        headers: authHeaders
      })

      const data = await response.json()

      if (data.success) {
        setAnalyticsData(data.data)
      } else {
        throw new Error(data.error || 'Failed to load analytics')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load analytics data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const exportData = async (format: 'csv' | 'json') => {
    if (!session) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to export data',
        variant: 'destructive'
      })
      return
    }

    try {
      const params = new URLSearchParams({
        days: timeRange,
        format,
        ...(providerFilter !== 'all' && { provider: providerFilter })
      })

      const response = await fetch(`/api/usage/export?${params}`, {
        headers: authHeaders
      })

      if (format === 'csv') {
        const csv = await response.text()
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `api_usage_${timeRange}days.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const json = await response.json()
        if (json.success) {
          const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `api_usage_${timeRange}days.json`
          a.click()
          URL.revokeObjectURL(url)
        }
      }

      toast({
        title: 'Export successful',
        description: `Usage data exported as ${format.toUpperCase()}`
      })
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export usage data',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!analyticsData) {
    return (
      <div className="text-center text-muted-foreground">
        No analytics data available
      </div>
    )
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Usage Analytics</h2>
          <p className="text-muted-foreground">
            Monitor API usage, costs, and performance across all your keys
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24h</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              <SelectItem value="openrouter">OpenRouter</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAnalyticsData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => exportData('csv')}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.summary.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {timeRange} day{timeRange !== '1' ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analyticsData.summary.totalTokens / 1000000).toFixed(2)}M
            </div>
            <p className="text-xs text-muted-foreground">
              Tokens processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analyticsData.summary.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Total spend
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.summary.avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">
              Average latency
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Trends</CardTitle>
            <CardDescription>Requests and tokens over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.usageStats.dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <YAxis yAxisId="requests" />
                <YAxis yAxisId="tokens" orientation="right" />
                <Tooltip 
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Legend />
                <Bar yAxisId="requests" dataKey="requests" fill="#8884d8" name="Requests" />
                <Line 
                  yAxisId="tokens" 
                  type="monotone" 
                  dataKey="tokens" 
                  stroke="#82ca9d" 
                  name="Tokens" 
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Model Usage Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Model Usage</CardTitle>
            <CardDescription>Distribution by model</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.usageStats.topModels.slice(0, 5)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ model, percent }) => `${model} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="requests"
                >
                  {analyticsData.usageStats.topModels.slice(0, 5).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Key Utilization */}
      <Card>
        <CardHeader>
          <CardTitle>API Key Utilization</CardTitle>
          <CardDescription>Usage across your API keys</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.keyUtilization.map((key) => (
              <div key={key.keyId} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant={key.isActive ? 'default' : 'secondary'}>
                    {key.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <div>
                    <p className="font-medium">{key.keyName}</p>
                    <p className="text-sm text-muted-foreground">{key.provider}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-medium">Daily Usage</p>
                    <Progress value={key.dailyUsagePercent} className="w-24" />
                    <p className="text-xs text-muted-foreground">{key.dailyUsagePercent.toFixed(1)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Monthly Usage</p>
                    <Progress value={key.monthlyUsagePercent} className="w-24" />
                    <p className="text-xs text-muted-foreground">{key.monthlyUsagePercent.toFixed(1)}%</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    Last used: {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors */}
      {analyticsData.recentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Recent Errors
            </CardTitle>
            <CardDescription>
              Latest API errors and issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.recentErrors.slice(0, 10).map((error) => (
                <div key={error.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{error.error_message}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Badge variant="outline" className="text-xs">
                        {error.provider}
                      </Badge>
                      {error.model_used && (
                        <span>{error.model_used}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(error.request_timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Models Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Model Performance</CardTitle>
          <CardDescription>Performance metrics by model</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.usageStats.topModels.slice(0, 10).map((model, index) => (
              <div key={model.model} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{model.model}</p>
                    <p className="text-sm text-muted-foreground">
                      {model.requests} requests • {(model.tokens / 1000).toFixed(1)}K tokens
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">${model.cost.toFixed(3)}</p>
                  <p className="text-xs text-muted-foreground">
                    {model.avgResponseTime}ms avg
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}