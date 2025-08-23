import { LLMModel } from '../types'

// Comparison metric types and configurations
export interface ComparisonMetric {
  id: string
  name: string
  description: string
  category: 'performance' | 'cost' | 'capabilities' | 'technical' | 'availability'
  unit?: string
  format: 'number' | 'currency' | 'percentage' | 'text' | 'boolean' | 'bytes' | 'tokens'
  calculate: (model: LLMModel) => number | string | boolean | null
  isHigherBetter: boolean
  weight?: number
}

// Default comparison metrics
export const DEFAULT_COMPARISON_METRICS: ComparisonMetric[] = [
  {
    id: 'name',
    name: 'Model Name',
    description: 'The name of the LLM model',
    category: 'technical',
    format: 'text',
    calculate: (model) => model.name,
    isHigherBetter: false
  },
  {
    id: 'provider',
    name: 'Provider',
    description: 'The organization providing the model',
    category: 'technical',
    format: 'text',
    calculate: (model) => model.provider,
    isHigherBetter: false
  },
  {
    id: 'company',
    name: 'Company',
    description: 'The company that developed the model',
    category: 'technical',
    format: 'text',
    calculate: (model) => model.company || 'N/A',
    isHigherBetter: false
  },
  {
    id: 'contextLength',
    name: 'Context Length',
    description: 'Maximum context window size',
    category: 'performance',
    unit: 'tokens',
    format: 'tokens',
    calculate: (model) => model.contextLength || 0,
    isHigherBetter: true,
    weight: 0.25
  },
  {
    id: 'inputPrice',
    name: 'Input Price',
    description: 'Cost per 1M input tokens',
    category: 'cost',
    unit: '$',
    format: 'currency',
    calculate: (model) => model.pricing?.input || null,
    isHigherBetter: false,
    weight: 0.3
  },
  {
    id: 'outputPrice',
    name: 'Output Price',
    description: 'Cost per 1M output tokens',
    category: 'cost',
    unit: '$',
    format: 'currency',
    calculate: (model) => model.pricing?.output || null,
    isHigherBetter: false,
    weight: 0.25
  },
  {
    id: 'imagePrice',
    name: 'Image Price',
    description: 'Cost per image processed',
    category: 'cost',
    unit: '$',
    format: 'currency',
    calculate: (model) => model.pricing?.image || null,
    isHigherBetter: false,
    weight: 0.1
  },
  {
    id: 'availability',
    name: 'Availability',
    description: 'Whether the model is currently available',
    category: 'availability',
    format: 'boolean',
    calculate: (model) => model.isAvailable,
    isHigherBetter: true,
    weight: 0.2
  },
  {
    id: 'capabilities',
    name: 'Capabilities Count',
    description: 'Number of supported capabilities',
    category: 'capabilities',
    format: 'number',
    calculate: (model) => model.capabilities?.length || 0,
    isHigherBetter: true,
    weight: 0.15
  },
  {
    id: 'architecture',
    name: 'Architecture',
    description: 'Model architecture type',
    category: 'technical',
    format: 'text',
    calculate: (model) => model.architecture || 'N/A',
    isHigherBetter: false
  },
  {
    id: 'qualityScore',
    name: 'Quality Score',
    description: 'Overall quality assessment',
    category: 'performance',
    unit: '%',
    format: 'percentage',
    calculate: (model) => getModelQualityScore(model),
    isHigherBetter: true,
    weight: 0.2
  },
  {
    id: 'costEfficiency',
    name: 'Cost Efficiency',
    description: 'Value for money ratio',
    category: 'cost',
    format: 'number',
    calculate: (model) => calculateCostEfficiency(model),
    isHigherBetter: true,
    weight: 0.25
  },
  {
    id: 'lastUpdated',
    name: 'Last Updated',
    description: 'When the model was last updated',
    category: 'technical',
    format: 'text',
    calculate: (model) => model.lastUpdated,
    isHigherBetter: false
  }
]

// Metric calculation helpers
function getModelQualityScore(model: LLMModel): number {
  let score = 0
  if (model.contextLength && model.contextLength > 32000) score += 25
  if (model.pricing?.input && model.pricing.input < 2) score += 20
  if (model.capabilities?.length && model.capabilities.length > 3) score += 25
  if (model.isAvailable) score += 15
  if (model.provider === 'OpenAI' || model.provider === 'Anthropic') score += 15
  return Math.min(score, 100)
}

function calculateCostEfficiency(model: LLMModel): number {
  if (!model.pricing?.input || !model.contextLength) return 0
  
  // Calculate tokens per dollar (higher is better)
  const tokensPerDollar = 1000000 / model.pricing.input
  
  // Factor in context length (more context = more value)
  const contextBonus = Math.log10(model.contextLength) / 5
  
  // Factor in capabilities
  const capabilityBonus = (model.capabilities?.length || 0) / 10
  
  return Math.round((tokensPerDollar * (1 + contextBonus + capabilityBonus)) / 100)
}

// Comparison data structure
export interface ComparisonData {
  models: LLMModel[]
  metrics: ComparisonMetric[]
  results: ComparisonResult[]
}

export interface ComparisonResult {
  modelId: string
  metrics: Record<string, {
    value: number | string | boolean | null
    normalized?: number // 0-1 scale for comparison
    rank?: number
    isWinner?: boolean
  }>
  overallScore?: number
  overallRank?: number
}

// Main comparison calculation function
export function calculateComparison(
  models: LLMModel[],
  selectedMetrics: string[] = DEFAULT_COMPARISON_METRICS.map(m => m.id)
): ComparisonData {
  const metrics = DEFAULT_COMPARISON_METRICS.filter(m => selectedMetrics.includes(m.id))
  
  // Calculate raw values
  const results: ComparisonResult[] = models.map(model => ({
    modelId: model.id,
    metrics: {}
  }))

  // Calculate metric values and normalization
  metrics.forEach(metric => {
    const values = models.map(model => {
      const value = metric.calculate(model)
      return { modelId: model.id, value }
    })

    // Calculate normalization for numeric values
    if (metric.format === 'number' || metric.format === 'currency' || 
        metric.format === 'percentage' || metric.format === 'tokens') {
      const numericValues = values
        .map(v => typeof v.value === 'number' ? v.value : 0)
        .filter(v => v > 0)

      if (numericValues.length > 0) {
        const min = Math.min(...numericValues)
        const max = Math.max(...numericValues)
        const range = max - min

        values.forEach((item, index) => {
          const numValue = typeof item.value === 'number' ? item.value : 0
          let normalized = range > 0 ? (numValue - min) / range : 0.5
          
          // Invert normalization if lower is better
          if (!metric.isHigherBetter) {
            normalized = 1 - normalized
          }

          results[index].metrics[metric.id] = {
            value: item.value,
            normalized: normalized
          }
        })
      } else {
        // No valid numeric values
        values.forEach((item, index) => {
          results[index].metrics[metric.id] = {
            value: item.value,
            normalized: 0.5
          }
        })
      }
    } else {
      // Non-numeric values
      values.forEach((item, index) => {
        results[index].metrics[metric.id] = {
          value: item.value
        }
      })
    }
  })

  // Calculate rankings for each metric
  metrics.forEach(metric => {
    if (metric.format === 'number' || metric.format === 'currency' || 
        metric.format === 'percentage' || metric.format === 'tokens') {
      
      const sortedResults = [...results].sort((a, b) => {
        const aVal = a.metrics[metric.id]?.normalized || 0
        const bVal = b.metrics[metric.id]?.normalized || 0
        return bVal - aVal // Higher normalized = better rank
      })

      sortedResults.forEach((result, index) => {
        const originalResult = results.find(r => r.modelId === result.modelId)
        if (originalResult?.metrics[metric.id]) {
          originalResult.metrics[metric.id].rank = index + 1
          originalResult.metrics[metric.id].isWinner = index === 0
        }
      })
    }
  })

  // Calculate overall scores
  results.forEach(result => {
    const weightedMetrics = metrics.filter(m => m.weight && (m.format === 'number' || m.format === 'currency' || 
      m.format === 'percentage' || m.format === 'tokens'))
    
    if (weightedMetrics.length > 0) {
      const totalWeight = weightedMetrics.reduce((sum, m) => sum + (m.weight || 0), 0)
      const weightedScore = weightedMetrics.reduce((sum, m) => {
        const normalized = result.metrics[m.id]?.normalized || 0
        return sum + (normalized * (m.weight || 0))
      }, 0)
      
      result.overallScore = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0
    }
  })

  // Calculate overall rankings
  const sortedByOverall = [...results].sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0))
  sortedByOverall.forEach((result, index) => {
    const originalResult = results.find(r => r.modelId === result.modelId)
    if (originalResult) {
      originalResult.overallRank = index + 1
    }
  })

  return { models, metrics, results }
}

// Utility functions for formatting
export function formatMetricValue(
  value: number | string | boolean | null,
  format: ComparisonMetric['format'],
  unit?: string
): string {
  if (value === null || value === undefined) return 'N/A'

  switch (format) {
    case 'currency':
      return typeof value === 'number' ? `$${value.toFixed(4)}` : String(value)
    
    case 'percentage':
      return typeof value === 'number' ? `${value.toFixed(1)}%` : String(value)
    
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value)
    
    case 'tokens':
      if (typeof value === 'number') {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
        return value.toString()
      }
      return String(value)
    
    case 'bytes':
      if (typeof value === 'number') {
        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        let size = value
        let unitIndex = 0
        while (size >= 1024 && unitIndex < units.length - 1) {
          size /= 1024
          unitIndex++
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`
      }
      return String(value)
    
    case 'boolean':
      return value ? 'Yes' : 'No'
    
    case 'text':
    default:
      return String(value)
  }
}

// Export utility for comparison results
export function exportComparisonToCSV(comparison: ComparisonData): string {
  const headers = ['Model', ...comparison.metrics.map(m => m.name)]
  const rows = comparison.models.map(model => {
    const result = comparison.results.find(r => r.modelId === model.id)
    const row = [model.name]
    
    comparison.metrics.forEach(metric => {
      const metricResult = result?.metrics[metric.id]
      row.push(formatMetricValue(metricResult?.value || null, metric.format, metric.unit))
    })
    
    return row
  })

  return [headers, ...rows].map(row => row.join(',')).join('\n')
}

// Preset comparison configurations
export const COMPARISON_PRESETS = {
  'performance': {
    name: 'Performance Focus',
    description: 'Compare models based on performance metrics',
    metrics: ['name', 'provider', 'contextLength', 'qualityScore', 'capabilities', 'availability']
  },
  'cost': {
    name: 'Cost Analysis',
    description: 'Compare models based on pricing and cost efficiency',
    metrics: ['name', 'provider', 'inputPrice', 'outputPrice', 'costEfficiency', 'contextLength']
  },
  'comprehensive': {
    name: 'Comprehensive',
    description: 'Full comparison with all metrics',
    metrics: DEFAULT_COMPARISON_METRICS.map(m => m.id)
  },
  'enterprise': {
    name: 'Enterprise Ready',
    description: 'Focus on enterprise requirements',
    metrics: ['name', 'provider', 'company', 'availability', 'qualityScore', 'inputPrice', 'outputPrice']
  }
}