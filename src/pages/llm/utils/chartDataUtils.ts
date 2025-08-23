import { LLMModel, LLMStats } from '../types'
import { PROVIDER_COLORS, CAPABILITY_COLORS } from '../constants'

export function generateProviderChartData(stats: LLMStats | null) {
  if (!stats?.providers) return []
  return Object.entries(stats.providers)
    .map(([provider, count]) => ({
      name: provider,
      value: count,
      color: PROVIDER_COLORS[provider] || '#6B7280'
    }))
    .sort((a, b) => b.value - a.value)
}

export function generateCapabilityChartData(models: LLMModel[]) {
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
}

export function generateContextLengthData(models: LLMModel[]) {
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
}

export function generatePricingData(models: LLMModel[]) {
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
}

export function generateCapabilityMatrixData(models: LLMModel[]) {
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
}

export function generateBubbleChartData(models: LLMModel[]) {
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
}

export function calculatePriceStats(models: LLMModel[]) {
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
}
