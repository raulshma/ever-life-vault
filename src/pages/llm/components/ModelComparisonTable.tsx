import React, { useMemo, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { 
  Trophy, 
  Medal, 
  Award, 
  Download, 
  Settings, 
  MoreVertical,
  X,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Smartphone,
  Monitor
} from 'lucide-react'
import { LLMModel } from '../types'
import {
  ComparisonData,
  ComparisonMetric,
  calculateComparison,
  formatMetricValue,
  exportComparisonToCSV,
  DEFAULT_COMPARISON_METRICS,
  COMPARISON_PRESETS
} from '../utils/comparisonUtils'
import { cn } from '@/lib/utils'

interface ModelComparisonTableProps {
  models: LLMModel[]
  selectedMetrics?: string[]
  onMetricsChange?: (metrics: string[]) => void
  onRemoveModel?: (modelId: string) => void
  className?: string
}

export function ModelComparisonTable({
  models,
  selectedMetrics = ['name', 'provider', 'contextLength', 'inputPrice', 'outputPrice', 'qualityScore', 'availability'],
  onMetricsChange,
  onRemoveModel,
  className
}: ModelComparisonTableProps) {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Check if screen is mobile and auto-switch to cards view
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile && viewMode === 'table') {
        setViewMode('cards')
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [viewMode])

  // Calculate comparison data
  const comparison = useMemo(
    () => calculateComparison(models, selectedMetrics),
    [models, selectedMetrics]
  )

  // Filter metrics to show only those with differences when enabled
  const visibleMetrics = useMemo(() => {
    if (!showOnlyDifferences) return comparison.metrics

    return comparison.metrics.filter(metric => {
      const values = comparison.results.map(r => r.metrics[metric.id]?.value)
      const uniqueValues = new Set(values)
      return uniqueValues.size > 1
    })
  }, [comparison, showOnlyDifferences])

  const handleExport = () => {
    const csv = exportComparisonToCSV(comparison)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'model-comparison.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePresetSelect = (presetKey: string) => {
    const preset = COMPARISON_PRESETS[presetKey as keyof typeof COMPARISON_PRESETS]
    if (preset && onMetricsChange) {
      onMetricsChange(preset.metrics)
    }
  }

  const getRankIcon = (rank?: number) => {
    if (!rank) return null
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />
    if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />
    if (rank === 3) return <Award className="h-4 w-4 text-amber-600" />
    return null
  }

  const getTrendIcon = (metric: ComparisonMetric, value: number | string | boolean | null) => {
    if (typeof value !== 'number') return <Minus className="h-3 w-3 text-gray-400" />
    
    if (metric.isHigherBetter) {
      return value > 50 ? 
        <TrendingUp className="h-3 w-3 text-green-500" /> : 
        <TrendingDown className="h-3 w-3 text-red-500" />
    } else {
      return value < 50 ? 
        <TrendingUp className="h-3 w-3 text-green-500" /> : 
        <TrendingDown className="h-3 w-3 text-red-500" />
    }
  }

  if (models.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Models to Compare</h3>
          <p className="text-muted-foreground">
            Select models from the overview tab to start comparing them.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("w-full max-w-full", className)}>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Model Comparison
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Comparing {models.length} model{models.length !== 1 ? 's' : ''} across {visibleMetrics.length} metric{visibleMetrics.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Preset Selection */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Presets
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Comparison Presets</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {Object.entries(COMPARISON_PRESETS).map(([key, preset]) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => handlePresetSelect(key)}
                    >
                      <div>
                        <div className="font-medium">{preset.name}</div>
                        <div className="text-xs text-muted-foreground">{preset.description}</div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* View Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {isMobile ? <Smartphone className="h-4 w-4 mr-2" /> : <Monitor className="h-4 w-4 mr-2" />}
                    {viewMode === 'table' ? 'Table' : 'Cards'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setShowOnlyDifferences(!showOnlyDifferences)}
                  >
                    {showOnlyDifferences ? 'Show All Metrics' : 'Show Only Differences'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setViewMode('cards')}
                    disabled={viewMode === 'cards'}
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    Cards View
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setViewMode('table')}
                    disabled={viewMode === 'table' || isMobile}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    Table View
                    {isMobile && <span className="text-xs text-muted-foreground ml-2">(Desktop only)</span>}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export to CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {viewMode === 'table' ? (
            <div className="w-full">
              <div className="w-full overflow-hidden border rounded-md">
                <div className="w-full overflow-x-auto comparison-table-scroll">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20 sticky left-0 bg-background z-10 border-r"></TableHead>
                        {visibleMetrics.map((metric, index) => {
                          const isNameColumn = index === 0
                          const getColumnWidth = () => {
                            if (isMobile) return isNameColumn ? '140px' : '90px'
                            if (visibleMetrics.length > 6) return isNameColumn ? '160px' : '100px'
                            if (visibleMetrics.length > 4) return isNameColumn ? '180px' : '120px'
                            return isNameColumn ? '200px' : '130px'
                          }
                          const width = getColumnWidth()
                          return (
                            <TableHead
                              key={metric.id}
                              className="px-2 py-3 border-r last:border-r-0 whitespace-nowrap"
                              style={{ width, minWidth: width }}
                            >
                              <div className="flex flex-col gap-1 h-full">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium truncate" title={metric.name}>
                                    {metric.name}
                                  </span>
                                  <Badge variant="outline" className="text-xs px-1 py-0 shrink-0">
                                    {metric.category.substring(0, 3)}
                                  </Badge>
                                </div>
                                {metric.description && (
                                  <div 
                                    className="text-xs text-muted-foreground overflow-hidden" 
                                    style={{ 
                                      display: '-webkit-box', 
                                      WebkitLineClamp: 2, 
                                      WebkitBoxOrient: 'vertical',
                                      lineHeight: '1.2'
                                    }}
                                    title={metric.description}
                                  >
                                    {metric.description}
                                  </div>
                                )}
                              </div>
                            </TableHead>
                          )
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparison.results.map((result, index) => {
                        const model = models.find(m => m.id === result.modelId)
                        if (!model) return null

                        return (
                          <TableRow key={result.modelId} className={cn(
                            "hover:bg-muted/50",
                            result.overallRank === 1 && "bg-yellow-50/50 dark:bg-yellow-900/10"
                          )}>
                            <TableCell className="sticky left-0 bg-background z-10 w-20 border-r p-2 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <div className="shrink-0">
                                  {getRankIcon(result.overallRank)}
                                </div>
                                {onRemoveModel && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onRemoveModel(model.id)}
                                    className="h-5 w-5 p-0 hover:bg-red-100 hover:text-red-600 shrink-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            
                            {visibleMetrics.map((metric, metricIndex) => {
                              const metricResult = result.metrics[metric.id]
                              const isWinner = metricResult?.isWinner
                              const isNameColumn = metricIndex === 0
                              const getColumnWidth = () => {
                                if (isMobile) return isNameColumn ? '140px' : '90px'
                                if (visibleMetrics.length > 6) return isNameColumn ? '160px' : '100px'
                                if (visibleMetrics.length > 4) return isNameColumn ? '180px' : '120px'
                                return isNameColumn ? '200px' : '130px'
                              }
                              const width = getColumnWidth()

                              return (
                                <TableCell
                                  key={metric.id}
                                  className={cn(
                                    "px-2 py-3 border-r last:border-r-0 whitespace-nowrap",
                                    isWinner && "bg-green-50/50 dark:bg-green-900/10 font-medium"
                                  )}
                                  style={{ width, minWidth: width }}
                                >
                                  <div className="flex flex-col gap-1 w-full overflow-hidden">
                                    <div className="flex items-center justify-between gap-1 w-full">
                                      <span 
                                        className="truncate text-xs flex-1" 
                                        title={formatMetricValue(metricResult?.value || null, metric.format, metric.unit)}
                                      >
                                        {formatMetricValue(metricResult?.value || null, metric.format, metric.unit)}
                                      </span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {isWinner && <Trophy className="h-3 w-3 text-yellow-500" />}
                                        {metricResult?.rank && metricResult.rank <= 3 && !isWinner && 
                                          getRankIcon(metricResult.rank)}
                                      </div>
                                    </div>
                                    {metricResult?.rank && (
                                      <div className="text-xs text-muted-foreground truncate">
                                        #{metricResult.rank}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Scroll indicator - only show if table is wider than container */}
                {visibleMetrics.length > 4 && (
                  <div className="flex justify-center py-2 text-xs text-muted-foreground bg-muted/30">
                    <span>← Scroll horizontally to view all {visibleMetrics.length} metrics →</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Cards View */
            <div className="p-6 w-full max-w-full">
              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3 w-full">
                {comparison.results.map((result) => {
                  const model = models.find(m => m.id === result.modelId)
                  if (!model) return null

                  return (
                    <Card key={result.modelId} className={cn(
                      "relative w-full",
                      result.overallRank === 1 && "ring-2 ring-yellow-500/50"
                    )}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {getRankIcon(result.overallRank)}
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-base truncate" title={model.name}>{model.name}</CardTitle>
                              <p className="text-sm text-muted-foreground truncate" title={model.provider}>{model.provider}</p>
                            </div>
                          </div>
                          {onRemoveModel && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRemoveModel(model.id)}
                              className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600 shrink-0 ml-2"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {result.overallScore !== undefined && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Overall Score: </span>
                            <span className="font-medium">{result.overallScore.toFixed(1)}</span>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-2 w-full">
                        {visibleMetrics.slice(2).map((metric) => { // Skip name and provider which are shown in header
                          const metricResult = result.metrics[metric.id]
                          const isWinner = metricResult?.isWinner

                          return (
                            <div key={metric.id} className="flex items-center justify-between text-sm gap-2 w-full">
                              <span className="text-muted-foreground truncate flex-1" title={metric.name}>{metric.name}:</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span 
                                  className={cn(
                                    "truncate max-w-[120px]",
                                    isWinner && "font-medium text-green-600"
                                  )}
                                  title={formatMetricValue(metricResult?.value || null, metric.format, metric.unit)}
                                >
                                  {formatMetricValue(metricResult?.value || null, metric.format, metric.unit)}
                                </span>
                                {isWinner && <Trophy className="h-3 w-3 text-yellow-500" />}
                              </div>
                            </div>
                          )
                        })}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Overall Rankings Summary */}
          {comparison.results.some(r => r.overallScore !== undefined) && (
            <div className="mx-6 mb-6 p-4 bg-muted/50 rounded-lg w-auto max-w-full overflow-hidden">
              <h4 className="font-medium mb-3">Overall Rankings</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 w-full">
                {comparison.results
                  .sort((a, b) => (a.overallRank || 0) - (b.overallRank || 0))
                  .map((result) => {
                    const model = models.find(m => m.id === result.modelId)
                    if (!model || !result.overallScore) return null

                    return (
                      <div key={result.modelId} className="flex items-center gap-2 text-sm w-full min-w-0">
                        {getRankIcon(result.overallRank)}
                        <span className="font-medium">#{result.overallRank}</span>
                        <span className="truncate flex-1" title={model.name}>{model.name}</span>
                        <span className="text-muted-foreground ml-auto shrink-0">
                          {result.overallScore.toFixed(1)}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}