import { LLMModel } from '../types'

export function getModelQualityScore(model: LLMModel): number {
  let score = 0
  if (model.contextLength && model.contextLength > 32000) score += 25
  if (model.pricing?.input && model.pricing.input < 2) score += 20
  if (model.capabilities?.length && model.capabilities.length > 3) score += 25
  if (model.isAvailable) score += 15
  if (model.provider === 'OpenAI' || model.provider === 'Anthropic') score += 15
  return Math.min(score, 100)
}

export function getModelPerformanceData(model: LLMModel) {
  return [
    { metric: 'Context', value: Math.min((model.contextLength || 0) / 200000 * 100, 100) },
    { metric: 'Cost Efficiency', value: model.pricing?.input ? Math.max(0, 100 - (model.pricing.input * 20)) : 50 },
    { metric: 'Capabilities', value: (model.capabilities?.length || 0) * 20 },
    { metric: 'Availability', value: model.isAvailable ? 100 : 0 },
    { metric: 'Provider Trust', value: ['OpenAI', 'Anthropic', 'Google'].includes(model.provider) ? 90 : 70 }
  ]
}

export function formatContextLength(length?: number): string {
  if (!length) return 'N/A'
  if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`
  if (length >= 1000) return `${(length / 1000).toFixed(0)}K`
  return length.toString()
}

export function calculateAveragePrice(models: LLMModel[]): { input: number; output: number } {
  const validModels = models.filter(m => m.pricing?.input && m.pricing?.output)
  if (!validModels.length) return { input: 0, output: 0 }

  const totalInput = validModels.reduce((sum, m) => sum + (m.pricing?.input || 0), 0)
  const totalOutput = validModels.reduce((sum, m) => sum + (m.pricing?.output || 0), 0)

  return {
    input: totalInput / validModels.length,
    output: totalOutput / validModels.length
  }
}
