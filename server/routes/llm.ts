import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LLMDataService } from '../services/LLMDataService.js'
import { OpenRouterProvider } from '../services/providers/OpenRouterProvider.js'

interface RequireUserFunction {
  (request: FastifyRequest, reply: FastifyReply): Promise<{ id: string } | null>
}

interface LLMRouteConfig {
  requireSupabaseUser: RequireUserFunction
  supabase: SupabaseClient
  openRouterApiKey?: string
}

// Global service instance
let llmDataService: LLMDataService | null = null

export function registerLLMRoutes(server: FastifyInstance, cfg: LLMRouteConfig): void {
  // Initialize LLM data service if not already done
  if (!llmDataService) {
    const config = {
      providers: ['openrouter'], // Start with OpenRouter
      cacheTimeMs: 5 * 60 * 1000, // 5 minutes cache
      autoRefreshIntervalMs: 30 * 60 * 1000 // 30 minutes auto-refresh
    }

    llmDataService = new LLMDataService(cfg.supabase, config)

    // Register OpenRouter provider
    if (cfg.openRouterApiKey) {
      const openRouterProvider = new OpenRouterProvider(cfg.openRouterApiKey)
      llmDataService.registerProvider(openRouterProvider)
    }
  }

  // Get all LLM models
  server.get('/api/llm/models', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const { forceRefresh } = (request.query as Record<string, unknown>) || {}

      const models = await llmDataService!.getAllModels(forceRefresh === 'true')

      return reply.send({
        success: true,
        data: models,
        count: models.length
      })
    } catch (error) {
      server.log.error({ event: 'llm_models_error', error }, 'Error fetching LLM models')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch LLM models'
      })
    }
  })

  // Get filtered LLM models
  server.get('/api/llm/models/filtered', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const query = request.query as Record<string, unknown>
      const filters = {
        providers: query.providers ? (Array.isArray(query.providers) ? query.providers : [query.providers]) as string[] : undefined,
        companies: query.companies ? (Array.isArray(query.companies) ? query.companies : [query.companies]) as string[] : undefined,
        minContextLength: query.minContextLength ? parseInt(query.minContextLength as string) : undefined,
        maxPricing: query.maxInputPrice || query.maxOutputPrice ? {
          input: query.maxInputPrice ? parseFloat(query.maxInputPrice as string) : undefined,
          output: query.maxOutputPrice ? parseFloat(query.maxOutputPrice as string) : undefined
        } : undefined,
        capabilities: query.capabilities ? (Array.isArray(query.capabilities) ? query.capabilities : [query.capabilities]) as string[] : undefined
      }

      const models = await llmDataService!.getFilteredModels(filters)

      return reply.send({
        success: true,
        data: models,
        count: models.length,
        filters
      })
    } catch (error) {
      server.log.error({ event: 'llm_filtered_models_error', error }, 'Error fetching filtered LLM models')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch filtered LLM models'
      })
    }
  })

  // Get model statistics
  server.get('/api/llm/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const stats = await llmDataService!.getModelStats()

      return reply.send({
        success: true,
        data: stats
      })
    } catch (error) {
      server.log.error({ event: 'llm_stats_error', error }, 'Error fetching LLM stats')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch LLM statistics'
      })
    }
  })

  // Get available providers
  server.get('/api/llm/providers', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const providers = llmDataService!.getAvailableProviders()

      return reply.send({
        success: true,
        data: providers
      })
    } catch (error) {
      server.log.error({ event: 'llm_providers_error', error }, 'Error fetching LLM providers')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch LLM providers'
      })
    }
  })

  // Refresh all data manually
  server.post('/api/llm/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return

    try {
      await llmDataService!.refreshAll()

      return reply.send({
        success: true,
        message: 'LLM data refreshed successfully'
      })
    } catch (error) {
      server.log.error({ event: 'llm_refresh_error', error }, 'Error refreshing LLM data')
      return reply.code(500).send({
        success: false,
        error: 'Failed to refresh LLM data'
      })
    }
  })

  // Get model details by ID
  server.get('/api/llm/models/:modelId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const { modelId } = (request.params as Record<string, unknown>) || {}

      if (!modelId || typeof modelId !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Model ID is required'
        })
      }

      const models = await llmDataService!.getAllModels()
      const model = models.find(m => m.id === modelId)

      if (!model) {
        return reply.code(404).send({
          success: false,
          error: 'Model not found'
        })
      }

      return reply.send({
        success: true,
        data: model
      })
    } catch (error) {
      server.log.error({ event: 'llm_model_details_error', error }, 'Error fetching model details')
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch model details'
      })
    }
  })

  // Search models
  server.get('/api/llm/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await cfg.requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const { q, limit } = (request.query as Record<string, unknown>) || {}
      const max = Number(limit) > 0 ? Number(limit) : 20

      if (!q || typeof q !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Search query is required'
        })
      }

      const models = await llmDataService!.getAllModels()
      const searchTerm = q.toLowerCase()

      const filteredModels = models.filter(model =>
        model.name.toLowerCase().includes(searchTerm) ||
        model.description?.toLowerCase().includes(searchTerm) ||
        model.company?.toLowerCase().includes(searchTerm) ||
        model.provider.toLowerCase().includes(searchTerm)
      ).slice(0, max)

      return reply.send({
        success: true,
        data: filteredModels,
        count: filteredModels.length,
        query: q
      })
    } catch (error) {
      server.log.error({ event: 'llm_search_error', error }, 'Error searching LLM models')
      return reply.code(500).send({
        success: false,
        error: 'Failed to search LLM models'
      })
    }
  })
}
