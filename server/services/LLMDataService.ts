import type { SupabaseClient } from '@supabase/supabase-js'

// LLM Model interface representing comprehensive model metadata
export interface LLMModel {
  id: string
  name: string
  provider: string
  company?: string
  description?: string
  contextLength?: number
  pricing?: {
    input?: number // Cost per 1M input tokens
    output?: number // Cost per 1M output tokens
    image?: number // Cost per image
    request?: number // Cost per request
  }
  capabilities?: string[] // e.g., ['text', 'vision', 'function_calling', 'streaming']
  maxTokens?: number
  trainingDataCutoff?: string
  releaseDate?: string
  architecture?: string
  license?: string
  endpoints?: string[]
  isAvailable: boolean
  lastUpdated: string
  metadata?: Record<string, unknown>
}

// Provider interface for fetching LLM data
export interface LLMDataProvider {
  name: string
  fetchModels(): Promise<LLMModel[]>
}

// Configuration for LLM data fetching
export interface LLMDataConfig {
  providers: string[] // List of provider names to use
  cacheTimeMs: number
  autoRefreshIntervalMs: number
}

// Service class that manages LLM data from multiple providers
export class LLMDataService {
  private providers: Map<string, LLMDataProvider> = new Map()
  private cache: Map<string, { data: LLMModel[]; timestamp: number }> = new Map()
  private refreshTimer?: NodeJS.Timeout

  constructor(
    private supabase: SupabaseClient,
    private config: LLMDataConfig
  ) {
    this.startAutoRefresh()
  }

  // Register a data provider
  registerProvider(provider: LLMDataProvider): void {
    this.providers.set(provider.name, provider)
  }

  // Get all available providers
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  // Fetch models from all configured providers with caching
  async getAllModels(forceRefresh = false): Promise<LLMModel[]> {
    const cacheKey = 'all_models'
    const now = Date.now()

    // Check cache unless force refresh
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey)
      if (cached && (now - cached.timestamp) < this.config.cacheTimeMs) {
        return cached.data
      }
    }

    // Fetch from all configured providers
    const allModels: LLMModel[] = []

    for (const providerName of this.config.providers) {
      const provider = this.providers.get(providerName)
      if (!provider) {
        console.warn(`LLM provider '${providerName}' not found`)
        continue
      }

      try {
        console.log(`Fetching models from provider: ${providerName}`)
        const models = await provider.fetchModels()
        allModels.push(...models)
      } catch (error) {
        console.error(`Error fetching from provider ${providerName}:`, error)
      }
    }

    // Cache the results
    this.cache.set(cacheKey, {
      data: allModels,
      timestamp: now
    })

    // Store in Supabase for persistence
    await this.persistModels(allModels)

    return allModels
  }

  // Get models filtered by criteria
  async getFilteredModels(filters?: {
    providers?: string[]
    companies?: string[]
    minContextLength?: number
    maxPricing?: { input?: number; output?: number }
    capabilities?: string[]
  }): Promise<LLMModel[]> {
    const allModels = await this.getAllModels()

    return allModels.filter(model => {
      if (filters?.providers && !filters.providers.includes(model.provider)) {
        return false
      }
      if (filters?.companies && model.company && !filters.companies.includes(model.company)) {
        return false
      }
      if (filters?.minContextLength && (model.contextLength || 0) < filters.minContextLength) {
        return false
      }
      if (filters?.maxPricing) {
        if (filters.maxPricing.input && (model.pricing?.input || 0) > filters.maxPricing.input) {
          return false
        }
        if (filters.maxPricing.output && (model.pricing?.output || 0) > filters.maxPricing.output) {
          return false
        }
      }
      if (filters?.capabilities) {
        const modelCapabilities = model.capabilities || []
        if (!filters.capabilities.some(cap => modelCapabilities.includes(cap))) {
          return false
        }
      }
      return true
    })
  }

  // Get model statistics
  async getModelStats(): Promise<{
    totalModels: number
    providers: Record<string, number>
    companies: Record<string, number>
    avgContextLength: number
    priceRanges: {
      input: { min: number; max: number }
      output: { min: number; max: number }
    }
  }> {
    const models = await this.getAllModels()

    const providers: Record<string, number> = {}
    const companies: Record<string, number> = {}
    let totalContextLength = 0
    let contextLengthCount = 0
    const inputPrices: number[] = []
    const outputPrices: number[] = []

    models.forEach(model => {
      // Count by provider
      providers[model.provider] = (providers[model.provider] || 0) + 1

      // Count by company
      if (model.company) {
        companies[model.company] = (companies[model.company] || 0) + 1
      }

      // Calculate context length stats
      if (model.contextLength) {
        totalContextLength += model.contextLength
        contextLengthCount++
      }

      // Collect pricing data
      if (model.pricing?.input) inputPrices.push(model.pricing.input)
      if (model.pricing?.output) outputPrices.push(model.pricing.output)
    })

    return {
      totalModels: models.length,
      providers,
      companies,
      avgContextLength: contextLengthCount > 0 ? totalContextLength / contextLengthCount : 0,
      priceRanges: {
        input: {
          min: inputPrices.length > 0 ? Math.min(...inputPrices) : 0,
          max: inputPrices.length > 0 ? Math.max(...inputPrices) : 0
        },
        output: {
          min: outputPrices.length > 0 ? Math.min(...outputPrices) : 0,
          max: outputPrices.length > 0 ? Math.max(...outputPrices) : 0
        }
      }
    }
  }

  // Manual refresh of all data
  async refreshAll(): Promise<void> {
    await this.getAllModels(true)
  }

  // Start auto-refresh timer
  private startAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
    }

    this.refreshTimer = setInterval(async () => {
      try {
        console.log('Auto-refreshing LLM data...')
        await this.getAllModels(true)
      } catch (error) {
        console.error('Auto-refresh error:', error)
      }
    }, this.config.autoRefreshIntervalMs)
  }

  // Stop auto-refresh
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
  }

  // Persist models to Supabase
  private async persistModels(models: LLMModel[]): Promise<void> {
    try {
      // Store in a dedicated table (you might need to create this table)
      const { error } = await this.supabase
        .from('llm_models_cache')
        .upsert(
          models.map(model => ({
            ...model,
            updated_at: new Date().toISOString()
          })),
          { onConflict: 'id' }
        )

      if (error) {
        console.error('Error persisting LLM models:', error)
      }
    } catch (error) {
      console.error('Error persisting LLM models:', error)
    }
  }

  // Load cached models from Supabase (fallback)
  async loadPersistedModels(): Promise<LLMModel[]> {
    try {
      const { data, error } = await this.supabase
        .from('llm_models_cache')
        .select('*')
        .order('lastUpdated', { ascending: false })

      if (error) {
        console.error('Error loading persisted models:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error loading persisted models:', error)
      return []
    }
  }
}
