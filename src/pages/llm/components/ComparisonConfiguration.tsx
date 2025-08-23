import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter
} from '@/components/ui/sheet'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { 
  Settings, 
  Filter, 
  Save, 
  RotateCcw, 
  Plus,
  Info,
  Search
} from 'lucide-react'
import { 
  DEFAULT_COMPARISON_METRICS, 
  ComparisonMetric,
  COMPARISON_PRESETS
} from '../utils/comparisonUtils'
import { cn } from '@/lib/utils'

interface ComparisonConfigurationProps {
  selectedMetrics: string[]
  onMetricsChange: (metrics: string[]) => void
  onPresetSelect?: (presetKey: string) => void
  trigger?: React.ReactNode
}

const CATEGORY_COLORS = {
  performance: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  cost: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  capabilities: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  technical: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
  availability: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
}

export function ComparisonConfiguration({
  selectedMetrics,
  onMetricsChange,
  onPresetSelect,
  trigger
}: ComparisonConfigurationProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [tempSelectedMetrics, setTempSelectedMetrics] = useState<string[]>(selectedMetrics)

  const categories = Array.from(new Set(DEFAULT_COMPARISON_METRICS.map(m => m.category)))
  
  const filteredMetrics = DEFAULT_COMPARISON_METRICS.filter(metric => {
    const matchesSearch = metric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         metric.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || metric.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  const groupedMetrics = categories.reduce((acc, category) => {
    acc[category] = filteredMetrics.filter(m => m.category === category)
    return acc
  }, {} as Record<string, ComparisonMetric[]>)

  const handleMetricToggle = (metricId: string) => {
    setTempSelectedMetrics(prev => 
      prev.includes(metricId)
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    )
  }

  const handleSelectAll = () => {
    const visibleMetricIds = filteredMetrics.map(m => m.id)
    setTempSelectedMetrics(prev => {
      const newSelection = [...prev]
      visibleMetricIds.forEach(id => {
        if (!newSelection.includes(id)) {
          newSelection.push(id)
        }
      })
      return newSelection
    })
  }

  const handleDeselectAll = () => {
    const visibleMetricIds = filteredMetrics.map(m => m.id)
    setTempSelectedMetrics(prev => prev.filter(id => !visibleMetricIds.includes(id)))
  }

  const handlePresetSelect = (presetKey: string) => {
    const preset = COMPARISON_PRESETS[presetKey as keyof typeof COMPARISON_PRESETS]
    if (preset) {
      setTempSelectedMetrics(preset.metrics)
      if (onPresetSelect) {
        onPresetSelect(presetKey)
      }
    }
  }

  const handleSave = () => {
    onMetricsChange(tempSelectedMetrics)
  }

  const handleReset = () => {
    setTempSelectedMetrics(selectedMetrics)
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Settings className="h-4 w-4 mr-2" />
      Configure Metrics
    </Button>
  )

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configure Comparison Metrics
          </SheetTitle>
          <SheetDescription>
            Select which metrics to include in your model comparison. 
            You can choose from predefined presets or customize your own selection.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Tabs defaultValue="metrics" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="presets">Presets</TabsTrigger>
              <TabsTrigger value="metrics">Custom Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="presets" className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground">
                Choose from predefined metric combinations for common comparison scenarios.
              </div>
              
              <div className="grid gap-3">
                {Object.entries(COMPARISON_PRESETS).map(([key, preset]) => (
                  <Card
                    key={key}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-muted/50",
                      JSON.stringify(preset.metrics.sort()) === JSON.stringify([...tempSelectedMetrics].sort()) &&
                      "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                    )}
                    onClick={() => handlePresetSelect(key)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{preset.name}</h4>
                          <p className="text-sm text-muted-foreground">{preset.description}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {preset.metrics.slice(0, 5).map(metricId => {
                              const metric = DEFAULT_COMPARISON_METRICS.find(m => m.id === metricId)
                              return metric ? (
                                <Badge key={metricId} variant="outline" className="text-xs">
                                  {metric.name}
                                </Badge>
                              ) : null
                            })}
                            {preset.metrics.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{preset.metrics.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge className="ml-2">
                          {preset.metrics.length} metrics
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4 mt-4">
              {/* Search and Filter Controls */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search metrics..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="category-filter" className="text-sm">Category:</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger id="category-filter" className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                      Deselect All
                    </Button>
                  </div>
                </div>
              </div>

              {/* Selected Metrics Summary */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium mb-2">
                  Selected Metrics ({tempSelectedMetrics.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {tempSelectedMetrics.map(metricId => {
                    const metric = DEFAULT_COMPARISON_METRICS.find(m => m.id === metricId)
                    return metric ? (
                      <Badge 
                        key={metricId} 
                        variant="secondary" 
                        className={CATEGORY_COLORS[metric.category]}
                      >
                        {metric.name}
                      </Badge>
                    ) : null
                  })}
                  {tempSelectedMetrics.length === 0 && (
                    <span className="text-sm text-muted-foreground">No metrics selected</span>
                  )}
                </div>
              </div>

              {/* Metrics List by Category */}
              <div className="space-y-4">
                {Object.entries(groupedMetrics).map(([category, metrics]) => {
                  if (metrics.length === 0) return null

                  return (
                    <div key={category}>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Badge className={CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          ({metrics.length} metrics)
                        </span>
                      </h4>
                      
                      <div className="space-y-2 pl-4">
                        {metrics.map(metric => (
                          <div key={metric.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50">
                            <Checkbox
                              id={metric.id}
                              checked={tempSelectedMetrics.includes(metric.id)}
                              onCheckedChange={() => handleMetricToggle(metric.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <Label
                                htmlFor={metric.id}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <span className="font-medium">{metric.name}</span>
                                {metric.unit && (
                                  <Badge variant="outline" className="text-xs">
                                    {metric.unit}
                                  </Badge>
                                )}
                                {metric.weight && (
                                  <Badge variant="outline" className="text-xs">
                                    Weight: {(metric.weight * 100).toFixed(0)}%
                                  </Badge>
                                )}
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                {metric.description}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {metric.format}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {metric.isHigherBetter ? 'Higher is better' : 'Lower is better'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {filteredMetrics.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No metrics found matching your search criteria.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <SheetFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Apply Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}