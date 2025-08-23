import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  Activity,
  Target,
  TrendingUp,
  Download
} from 'lucide-react'
import { LLMModel } from '../types'
import {
  ComparisonData,
  calculateComparison,
  formatMetricValue
} from '../utils/comparisonUtils'

interface ComparisonChartsProps {
  models: LLMModel[]
  selectedMetrics?: string[]
  className?: string
}

const CHART_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
]

interface ChartDataPoint {
  name: string
  [key: string]: string | number | undefined
}

export function ComparisonCharts({
  models,
  selectedMetrics = ['contextLength', 'inputPrice', 'outputPrice', 'qualityScore'],
  className
}: ComparisonChartsProps) {
  const comparison = useMemo(
    () => calculateComparison(models, selectedMetrics),
    [models, selectedMetrics]
  )

  // Prepare data for different chart types
  const barChartData = useMemo(() => {
    const numericMetrics = comparison.metrics.filter(m => 
      m.format === 'number' || m.format === 'currency' || m.format === 'percentage' || m.format === 'tokens'
    )

    return comparison.results.map((result, index) => {
      const model = models.find(m => m.id === result.modelId)
      const dataPoint: ChartDataPoint = {
        name: model?.name.substring(0, 20) || 'Unknown',
        fullName: model?.name || 'Unknown'
      }

      numericMetrics.forEach(metric => {
        const value = result.metrics[metric.id]?.value
        if (typeof value === 'number') {
          dataPoint[metric.name] = value
        }
      })

      return dataPoint
    })
  }, [comparison, models])

  // Prepare radar chart data
  const radarData = useMemo(() => {
    const numericMetrics = comparison.metrics.filter(m => 
      m.format === 'number' || m.format === 'currency' || m.format === 'percentage' || m.format === 'tokens'
    ).slice(0, 6) // Limit to 6 metrics for readability

    return numericMetrics.map(metric => {
      const dataPoint: any = {
        metric: metric.name,
        fullMetric: metric.description
      }

      comparison.results.forEach((result, index) => {
        const model = models.find(m => m.id === result.modelId)
        const normalized = result.metrics[metric.id]?.normalized || 0
        dataPoint[model?.name || `Model ${index + 1}`] = Math.round(normalized * 100)
      })

      return dataPoint
    })
  }, [comparison, models])

  // Prepare scatter plot data (context vs price)
  const scatterData = useMemo(() => {
    return comparison.results.map((result, index) => {
      const model = models.find(m => m.id === result.modelId)
      const contextValue = result.metrics.contextLength?.value
      const priceValue = result.metrics.inputPrice?.value || result.metrics.outputPrice?.value
      
      if (typeof contextValue === 'number' && typeof priceValue === 'number') {
        return {
          name: model?.name || 'Unknown',
          x: contextValue,
          y: priceValue,
          z: result.overallScore || 50,
          provider: model?.provider || 'Unknown'
        }
      }
      return null
    }).filter(Boolean)
  }, [comparison, models])

  // Prepare overall score distribution
  const scoreDistribution = useMemo(() => {
    return comparison.results.map((result, index) => {
      const model = models.find(m => m.id === result.modelId)
      return {
        name: model?.name || 'Unknown',
        score: result.overallScore || 0,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      }
    }).sort((a, b) => b.score - a.score)
  }, [comparison, models])

  if (models.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Models to Visualize</h3>
          <p className="text-muted-foreground">
            Select models to see visual comparisons and charts.
          </p>
        </CardContent>
      </Card>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{payload[0]?.payload?.fullName || label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.dataKey}: ${entry.value}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const RadarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{payload[0]?.payload?.fullMetric || label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.dataKey}: ${entry.value}%`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className={className}>
      <div className="grid gap-6">
        {/* Overall Score Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Overall Score Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={12}
                  />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="score" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Multi-Metric Bar Chart */}
        {barChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Metric Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {comparison.metrics
                      .filter(m => m.format === 'number' || m.format === 'currency' || m.format === 'percentage' || m.format === 'tokens')
                      .map((metric, index) => (
                        <Bar 
                          key={metric.id}
                          dataKey={metric.name} 
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Radar Chart */}
        {radarData.length > 0 && models.length <= 5 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Performance Radar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                    <PolarGrid />
                    <PolarAngleAxis 
                      dataKey="metric" 
                      fontSize={12}
                      tick={{ fill: 'currentColor' }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      fontSize={10}
                      tick={{ fill: 'currentColor' }}
                    />
                    <Tooltip content={<RadarTooltip />} />
                    <Legend />
                    {models.map((model, index) => (
                      <Radar
                        key={model.id}
                        name={model.name}
                        dataKey={model.name}
                        stroke={CHART_COLORS[index % CHART_COLORS.length]}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scatter Plot: Context Length vs Price */}
        {scatterData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Context Length vs Price Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="x" 
                      name="Context Length"
                      type="number"
                      scale="log"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
                        return value.toString()
                      }}
                    />
                    <YAxis 
                      dataKey="y" 
                      name="Price"
                      type="number"
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => {
                        if (name === 'x') return [`${value.toLocaleString()} tokens`, 'Context Length']
                        if (name === 'y') return [`$${value.toFixed(4)}`, 'Price per 1M tokens']
                        return [value, name]
                      }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.name || 'Model'}
                    />
                    <Scatter 
                      data={scatterData} 
                      fill="#3B82F6"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metric Rankings Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Ranking Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Model</th>
                    <th className="text-left p-2">Overall Rank</th>
                    {comparison.metrics
                      .filter(m => m.format === 'number' || m.format === 'currency' || m.format === 'percentage' || m.format === 'tokens')
                      .slice(0, 4)
                      .map(metric => (
                        <th key={metric.id} className="text-left p-2">{metric.name}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.results
                    .sort((a, b) => (a.overallRank || 0) - (b.overallRank || 0))
                    .map((result) => {
                      const model = models.find(m => m.id === result.modelId)
                      return (
                        <tr key={result.modelId} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium">{model?.name || 'Unknown'}</td>
                          <td className="p-2">
                            <Badge variant={result.overallRank === 1 ? 'default' : 'outline'}>
                              #{result.overallRank}
                            </Badge>
                          </td>
                          {comparison.metrics
                            .filter(m => m.format === 'number' || m.format === 'currency' || m.format === 'percentage' || m.format === 'tokens')
                            .slice(0, 4)
                            .map(metric => {
                              const metricResult = result.metrics[metric.id]
                              return (
                                <td key={metric.id} className="p-2">
                                  <div className="flex items-center gap-2">
                                    <span>#{metricResult?.rank || 'N/A'}</span>
                                    {metricResult?.isWinner && (
                                      <Badge variant="default" className="text-xs">
                                        Winner
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}