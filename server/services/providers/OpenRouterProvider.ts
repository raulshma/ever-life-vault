import type { LLMDataProvider, LLMModel } from '../LLMDataService.js'

// OpenRouter API response types
interface OpenRouterModel {
  id: string
  name: string
  created: number
  description: string
  context_length: number
  architecture: {
    modality: string
    tokenizer: string
    instruct_type: string | null
  }
  pricing: {
    prompt: string // Cost per token (as string)
    completion: string // Cost per token (as string)
    image?: string
    request?: string
  }
  top_provider: {
    context_length: number
    max_completion_tokens: number
    is_moderated: boolean
  }
  per_request_limits: {
    prompt_tokens?: string
    completion_tokens?: string
  } | null
  endpoints?: Array<{
    name: string
    context_length: number
    max_completion_tokens: number
    is_moderated: boolean
  }>
}

interface OpenRouterResponse {
  data: OpenRouterModel[]
}

// OpenRouter provider implementation
export class OpenRouterProvider implements LLMDataProvider {
  name = 'openrouter'
  private apiKey?: string
  private baseUrl = 'https://openrouter.ai/api/v1'

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY
  }

  async fetchModels(): Promise<LLMModel[]> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required')
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`)
      }

      const data: OpenRouterResponse = await response.json()
      return this.transformModels(data.data)
    } catch (error) {
      console.error('Error fetching from OpenRouter:', error)
      throw error
    }
  }

  private transformModels(openRouterModels: OpenRouterModel[]): LLMModel[] {
    return openRouterModels.map(model => {
      // Extract company from model ID (e.g., "anthropic/claude-3-sonnet" -> "Anthropic")
      const company = this.extractCompany(model.id)

      // Parse pricing (convert from string to number, handle per-token vs per-million)
      const pricing = this.parsePricing(model.pricing)

      // Extract capabilities from architecture
      const capabilities = this.extractCapabilities(model)

      // Get context length (use top provider's if available)
      const contextLength = model.top_provider?.context_length || model.context_length

      // Get max tokens
      const maxTokens = model.top_provider?.max_completion_tokens

      return {
        id: model.id,
        name: model.name,
        provider: 'OpenRouter',
        company,
        description: model.description,
        contextLength,
        pricing,
        capabilities,
        maxTokens,
        architecture: model.architecture?.modality,
        isAvailable: true,
        lastUpdated: new Date().toISOString(),
        metadata: {
          architecture: model.architecture,
          topProvider: model.top_provider,
          perRequestLimits: model.per_request_limits,
          endpoints: model.endpoints,
          created: model.created
        }
      }
    })
  }

  private extractCompany(modelId: string): string {
    const companyMap: Record<string, string> = {
      'anthropic': 'Anthropic',
      'openai': 'OpenAI',
      'google': 'Google',
      'meta': 'Meta',
      'cohere': 'Cohere',
      'mistral': 'Mistral',
      'perplexity': 'Perplexity',
      'xai': 'xAI',
      'microsoft': 'Microsoft',
      'together': 'Together AI',
      'deepseek': 'DeepSeek',
      'qwen': 'Alibaba',
      'grok': 'xAI'
    }

    const companyKey = modelId.split('/')[0].toLowerCase()
    return companyMap[companyKey] || this.capitalizeFirst(companyKey)
  }

  private parsePricing(pricing: OpenRouterModel['pricing']) {
    // OpenRouter pricing is typically per token, but we convert to per million tokens
    // for consistency with other providers
    const multiplier = 1000000 // Convert per-token to per-million

    return {
      input: pricing.prompt ? parseFloat(pricing.prompt) * multiplier : undefined,
      output: pricing.completion ? parseFloat(pricing.completion) * multiplier : undefined,
      image: pricing.image ? parseFloat(pricing.image) : undefined,
      request: pricing.request ? parseFloat(pricing.request) : undefined
    }
  }

  private extractCapabilities(model: OpenRouterModel): string[] {
    const capabilities: string[] = ['text']

    // Check for vision capabilities
    if (model.architecture?.modality?.includes('vision') ||
        model.description?.toLowerCase().includes('vision')) {
      capabilities.push('vision')
    }

    // Check for function calling
    if (model.description?.toLowerCase().includes('function') ||
        model.description?.toLowerCase().includes('tool')) {
      capabilities.push('function_calling')
    }

    // All models support streaming via OpenRouter
    capabilities.push('streaming')

    return capabilities
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  // Get model details by ID
  async getModelDetails(modelId: string): Promise<LLMModel | null> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required')
    }

    try {
      const response = await fetch(`${this.baseUrl}/models/${modelId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`)
      }

      const model: OpenRouterModel = await response.json()
      const transformed = this.transformModels([model])
      return transformed[0] || null
    } catch (error) {
      console.error(`Error fetching model details for ${modelId}:`, error)
      throw error
    }
  }
}
