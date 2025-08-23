import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { 
  BarChart3, 
  Table as TableIcon, 
  Download, 
  Settings, 
  Share2,
  FileText,
  FileImage,
  X,
  Plus,
  Users
} from 'lucide-react'
import { LLMModel } from '../types'
import { ModelComparisonTable } from './ModelComparisonTable'
import { ComparisonCharts } from './ComparisonCharts'
import { ComparisonConfiguration } from './ComparisonConfiguration'
import { 
  calculateComparison,
  exportComparisonToCSV,
  DEFAULT_COMPARISON_METRICS,
  COMPARISON_PRESETS
} from '../utils/comparisonUtils'
import { cn } from '@/lib/utils'

interface ModelComparisonPanelProps {
  models: LLMModel[]
  onRemoveModel?: (modelId: string) => void
  onClearAll?: () => void
  className?: string
}

export function ModelComparisonPanel({
  models,
  onRemoveModel,
  onClearAll,
  className
}: ModelComparisonPanelProps) {
  const [activeTab, setActiveTab] = useState<'table' | 'charts'>('table')
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'name', 'provider', 'contextLength', 'inputPrice', 'outputPrice', 'qualityScore', 'availability'
  ])

  const comparison = useMemo(
    () => calculateComparison(models, selectedMetrics),
    [models, selectedMetrics]
  )

  // Export functions
  const handleExportCSV = () => {
    const csv = exportComparisonToCSV(comparison)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `model-comparison-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportJSON = () => {
    const jsonData = {
      exportDate: new Date().toISOString(),
      models: models.map(m => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        company: m.company,
        contextLength: m.contextLength,
        pricing: m.pricing,
        capabilities: m.capabilities,
        architecture: m.architecture,
        isAvailable: m.isAvailable,
        lastUpdated: m.lastUpdated
      })),
      comparison: {
        metrics: comparison.metrics.map(m => ({
          id: m.id,
          name: m.name,
          description: m.description,
          category: m.category,
          format: m.format,
          isHigherBetter: m.isHigherBetter
        })),
        results: comparison.results
      }
    }

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `model-comparison-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportReport = () => {
    const winner = comparison.results
      .sort((a, b) => (a.overallRank || Infinity) - (b.overallRank || Infinity))[0]
    const winnerModel = models.find(m => m.id === winner?.modelId)

    const reportContent = `
# Model Comparison Report
Generated on: ${new Date().toLocaleDateString()}

## Summary
- **Models Compared**: ${models.length}
- **Metrics Evaluated**: ${selectedMetrics.length}
- **Overall Winner**: ${winnerModel?.name || 'N/A'} (Score: ${winner?.overallScore?.toFixed(1) || 'N/A'})

## Models Analyzed
${models.map((model, index) => {
  const result = comparison.results.find(r => r.modelId === model.id)
  return `${index + 1}. **${model.name}** (${model.provider})
   - Overall Rank: #${result?.overallRank || 'N/A'}
   - Overall Score: ${result?.overallScore?.toFixed(1) || 'N/A'}
   - Context Length: ${model.contextLength?.toLocaleString() || 'N/A'} tokens
   - Input Price: $${model.pricing?.input?.toFixed(4) || 'N/A'} per 1M tokens
   - Available: ${model.isAvailable ? 'Yes' : 'No'}`
}).join('\n\n')}

## Metric Rankings
${comparison.metrics.filter(m => m.format === 'number' || m.format === 'currency' || m.format === 'percentage' || m.format === 'tokens').map(metric => {
  const rankedResults = [...comparison.results]
    .sort((a, b) => (a.metrics[metric.id]?.rank || Infinity) - (b.metrics[metric.id]?.rank || Infinity))
    .slice(0, 3)
  
  return `### ${metric.name}
${rankedResults.map((result, index) => {
    const model = models.find(m => m.id === result.modelId)
    const value = result.metrics[metric.id]?.value
    return `${index + 1}. ${model?.name}: ${typeof value === 'number' ? value.toLocaleString() : value}`
  }).join('\n')}`
}).join('\n\n')}

---
*Report generated by Ever Life Vault LLM Models Comparison Tool*
    `.trim()

    const blob = new Blob([reportContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `model-comparison-report-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleShare = async () => {
    const shareData = {
      title: 'LLM Model Comparison',
      text: `Comparison of ${models.length} LLM models: ${models.map(m => m.name).join(', ')}`,
      url: window.location.href
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        console.log('Error sharing:', err)
        // Fall back to copying to clipboard
        copyToClipboard(shareData.text + '\n' + shareData.url)
      }
    } else {
      copyToClipboard(shareData.text + '\n' + shareData.url)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You might want to show a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  if (models.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-12 text-center">
          <Users className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h3 className="text-xl font-semibold mb-3">Start Your Comparison</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Select models from the overview tab to compare their features, pricing, 
            performance, and capabilities side by side.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Add models to compare</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>View visual analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span>Export results</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("w-full max-w-full", className)}>
      <Card className="w-full max-w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Model Comparison
                <Badge variant="outline" className="ml-2">
                  {models.length} model{models.length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Compare and analyze {models.length} models across {selectedMetrics.length} metrics
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Configuration Panel */}
              <ComparisonConfiguration
                selectedMetrics={selectedMetrics}
                onMetricsChange={setSelectedMetrics}
                trigger={
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                }
              />

              {/* Export Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <TableIcon className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJSON}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportReport}>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Comparison
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Clear All */}
              {onClearAll && (
                <Button variant="outline" size="sm" onClick={onClearAll}>
                  <X className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* Model Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {models.map((model) => (
              <Badge 
                key={model.id} 
                variant="secondary" 
                className="flex items-center gap-2 pr-1"
              >
                <span>{model.name}</span>
                <span className="text-xs text-muted-foreground">({model.provider})</span>
                {onRemoveModel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveModel(model.id)}
                    className="h-4 w-4 p-0 hover:bg-red-100 hover:text-red-600 ml-1"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </Badge>
            ))}
          </div>
        </CardHeader>

        <CardContent className="pt-0 w-full max-w-full">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'table' | 'charts')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="table" className="flex items-center gap-2">
                <TableIcon className="h-4 w-4" />
                Table View
              </TabsTrigger>
              <TabsTrigger value="charts" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Visual Charts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="mt-0 w-full max-w-full">
              <ModelComparisonTable
                models={models}
                selectedMetrics={selectedMetrics}
                onMetricsChange={setSelectedMetrics}
                onRemoveModel={onRemoveModel}
                className="w-full max-w-full"
              />
            </TabsContent>

            <TabsContent value="charts" className="mt-0 w-full max-w-full">
              <ComparisonCharts
                models={models}
                selectedMetrics={selectedMetrics}
                className="w-full max-w-full"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}