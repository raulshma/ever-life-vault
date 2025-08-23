export interface LLMModel {
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

export interface LLMStats {
  totalModels: number
  providers: Record<string, number>
  companies: Record<string, number>
  avgContextLength: number
  priceRanges: {
    input: { min: number; max: number }
    output: { min: number; max: number }
  }
}

export interface ResourceAnalysisData {
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

export interface PerformanceBenchmarkingData {
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

export interface EnergyEfficiencyData {
  name: string
  provider: string
  powerConsumption: number
  tokensPerWatt: number
  carbonFootprint: number
  efficiencyScore: number
  contextLength: number
}

export interface CostEfficiencyData {
  name: string
  efficiency: number
  contextLength: number
  avgPrice: number
  provider: string
}

export interface ReleaseTimelineData {
  date: string
  model: string
  provider: string
  type: string
  impact: string
  timelineIndex: number
  color: string
}

export interface DrillDownFilter {
  type: 'provider' | 'capability' | 'contextRange' | 'pricingRange' | 'quality' | 'availability' | null
  value: string | { min: number; max: number } | null
  title: string
}

export type SortBy = 'name' | 'contextLength' | 'inputPrice' | 'outputPrice'
export type SortOrder = 'asc' | 'desc'
