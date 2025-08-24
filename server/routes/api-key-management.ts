/**
 * API Key Management Routes
 * 
 * Comprehensive API endpoints for managing API keys, usage tracking,
 * rate limits, and analytics for AI providers (OpenRouter, Gemini).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import { APIKeyManagementService, type APIKeyConfig, type RateLimitConfig } from '../services/APIKeyManagementService.js'
import { RateLimitingService } from '../services/RateLimitingService.js'

interface APIKeyRequest {
  provider: 'openrouter' | 'google' | 'custom'
  keyName: string
  apiKey: string
  dailyRequestLimit?: number
  dailyTokenLimit?: number
  monthlyRequestLimit?: number
  monthlyTokenLimit?: number
  rotationPriority?: number
}

interface RateLimitRequest {
  provider: 'openrouter' | 'google'
  requestsPerMinute?: number
  requestsPerHour?: number
  requestsPerDay?: number
  tokensPerMinute?: number
  tokensPerHour?: number
  tokensPerDay?: number
  throttleEnabled?: boolean
  throttleDelayMs?: number
  burstAllowance?: number
}

interface RequireUserFunction {
  (request: FastifyRequest, reply: FastifyReply): Promise<{ id: string } | null>
}

export async function apiKeyManagementRoutes(
  server: FastifyInstance,
  options: {
    supabase: SupabaseClient
    requireAuth?: boolean
    requireSupabaseUser: RequireUserFunction
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
  }
) {
  const { supabase, requireAuth = true, requireSupabaseUser, SUPABASE_URL, SUPABASE_ANON_KEY } = options

  // Helper to create an authenticated Supabase client tied to the request's JWT
  const makeSupabaseForRequest = (request: any): SupabaseClient | null => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
    const authHeader = request.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    })
  }

  // Get all API keys for the user
  server.get('/api/keys', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest(request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ success: false, error: 'Supabase not configured' })
    }

    try {
      const service = new APIKeyManagementService(authenticatedSupabase, user.id)

      const { provider } = request.query as { provider?: string }
      const keys = await service.getAPIKeys(provider)

      return reply.send({
        success: true,
        data: keys
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch API keys'
      })
    }
  })

  // Add a new API key
  server.post('/api/keys', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest(request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ success: false, error: 'Supabase not configured' })
    }

    try {
      const service = new APIKeyManagementService(authenticatedSupabase, user.id)

      const keyConfig = request.body as APIKeyRequest

      // Validate required fields
      if (!keyConfig.provider || !keyConfig.keyName || !keyConfig.apiKey) {
        return reply.code(400).send({
          success: false,
          error: 'Provider, keyName, and apiKey are required'
        })
      }

      const keyId = await service.addAPIKey({
        userId: user.id,
        ...keyConfig
      })

      return reply.send({
        success: true,
        data: { keyId }
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add API key'
      })
    }
  })

  // Update an API key
  server.put('/api/keys/:keyId', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const authenticatedSupabase = makeSupabaseForRequest(request)
      if (!authenticatedSupabase) {
        return reply.code(500).send({ success: false, error: 'Supabase not configured' })
      }
      const service = new APIKeyManagementService(authenticatedSupabase, user.id)

      const { keyId } = request.params as { keyId: string }
      const updates = request.body as Partial<APIKeyRequest>

      await service.updateAPIKey(keyId, {
        userId: user.id,
        ...updates
      })

      return reply.send({
        success: true,
        message: 'API key updated successfully'
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update API key'
      })
    }
  })

  // Delete an API key
  server.delete('/api/keys/:keyId', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const authenticatedSupabase = makeSupabaseForRequest(request)
      if (!authenticatedSupabase) {
        return reply.code(500).send({ success: false, error: 'Supabase not configured' })
      }
      const service = new APIKeyManagementService(authenticatedSupabase, user.id)

      const { keyId } = request.params as { keyId: string }
      await service.deleteAPIKey(keyId)

      return reply.send({
        success: true,
        message: 'API key deleted successfully'
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete API key'
      })
    }
  })

  // Get usage statistics
  server.get('/api/usage/stats', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const authenticatedSupabase = makeSupabaseForRequest(request)
      if (!authenticatedSupabase) {
        return reply.code(500).send({ success: false, error: 'Supabase not configured' })
      }
      const service = new APIKeyManagementService(authenticatedSupabase, user.id)

      const { provider, days = '30' } = request.query as { provider?: string; days?: string }
      const stats = await service.getUsageStats(provider, parseInt(days, 10))

      return reply.send({
        success: true,
        data: stats
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch usage stats'
      })
    }
  })

  // Get detailed usage logs
  server.get('/api/usage/logs', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const authenticatedSupabase = makeSupabaseForRequest(request)
      if (!authenticatedSupabase) {
        return reply.code(500).send({ success: false, error: 'Supabase not configured' })
      }
      
      const { 
        provider, 
        keyId, 
        limit = '100',
        offset = '0',
        startDate,
        endDate
      } = request.query as { 
        provider?: string
        keyId?: string
        limit?: string
        offset?: string
        startDate?: string
        endDate?: string
      }

      let query = authenticatedSupabase
        .from('api_usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('request_timestamp', { ascending: false })
        .range(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10) - 1)

      if (provider) {
        query = query.eq('provider', provider)
      }

      if (keyId) {
        query = query.eq('api_key_id', keyId)
      }

      if (startDate) {
        query = query.gte('request_timestamp', startDate)
      }

      if (endDate) {
        query = query.lte('request_timestamp', endDate)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      return reply.send({
        success: true,
        data: data || []
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch usage logs'
      })
    }
  })

  // Set rate limit configuration
  server.put('/api/rate-limits/:provider', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const authenticatedSupabase = makeSupabaseForRequest(request)
      if (!authenticatedSupabase) {
        return reply.code(500).send({ success: false, error: 'Supabase not configured' })
      }
      const service = new APIKeyManagementService(authenticatedSupabase, user.id)

      const { provider } = request.params as { provider: string }
      const config = request.body as RateLimitRequest

      if (!['openrouter', 'google'].includes(provider)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid provider. Must be "openrouter" or "google"'
        })
      }

      await service.setRateLimitConfig(provider as 'openrouter' | 'google', {
        ...config,
        provider: provider as 'openrouter' | 'google'
      })

      return reply.send({
        success: true,
        message: 'Rate limit configuration updated successfully'
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set rate limit configuration'
      })
    }
  })

  // Get rate limit configuration
  server.get('/api/rate-limits/:provider', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const authenticatedSupabase = makeSupabaseForRequest(request)
      if (!authenticatedSupabase) {
        return reply.code(500).send({ success: false, error: 'Supabase not configured' })
      }
      const service = new APIKeyManagementService(authenticatedSupabase, user.id)

      const { provider } = request.params as { provider: string }
      const config = await service.getRateLimitConfig(provider)

      return reply.send({
        success: true,
        data: config
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get rate limit configuration'
      })
    }
  })

  // Get provider rate limit presets
  server.get('/api/rate-limits/presets/:provider', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const authenticatedSupabase = makeSupabaseForRequest(request)
      if (!authenticatedSupabase) {
        return reply.code(500).send({ success: false, error: 'Supabase not configured' })
      }
      const service = new APIKeyManagementService(authenticatedSupabase, user.id)

      const { provider } = request.params as { provider: string }
      const { tier } = request.query as { tier?: string }

      const presets = await service.getProviderRateLimits(provider, tier)

      return reply.send({
        success: true,
        data: presets
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get rate limit presets'
      })
    }
  })

  // Test API key functionality
  server.post('/api/keys/:keyId/test', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const authenticatedSupabase = makeSupabaseForRequest(request)
      if (!authenticatedSupabase) {
        return reply.code(500).send({ success: false, error: 'Supabase not configured' })
      }
      const { keyId } = request.params as { keyId: string }

      // Get the API key info
      const service = new APIKeyManagementService(authenticatedSupabase, user.id)
      const keys = await service.getAPIKeys()
      const keyInfo = keys.find(k => k.id === keyId)

      if (!keyInfo) {
        return reply.code(404).send({
          success: false,
          error: 'API key not found'
        })
      }

      // For testing, we'll just verify the key exists and is active
      if (!keyInfo.isActive) {
        return reply.code(400).send({
          success: false,
          error: 'API key is inactive'
        })
      }

      return reply.send({
        success: true,
        message: 'API key is valid and active',
        data: {
          provider: keyInfo.provider,
          keyName: keyInfo.keyName,
          lastUsed: keyInfo.lastUsedAt,
          isActive: keyInfo.isActive
        }
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test API key'
      })
    }
  })

  // Get API key analytics dashboard data
  server.get('/api/analytics/dashboard', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const authenticatedSupabase = makeSupabaseForRequest(request)
      if (!authenticatedSupabase) {
        return reply.code(500).send({ success: false, error: 'Supabase not configured' })
      }
      const service = new APIKeyManagementService(authenticatedSupabase, user.id)

      const { provider, days = '7' } = request.query as { provider?: string; days?: string }
      const daysNum = parseInt(days, 10)

      // Get usage stats
      const usageStats = await service.getUsageStats(provider, daysNum)

      // Get all API keys with usage info
      const apiKeys = await service.getAPIKeys(provider)

      // Calculate key utilization
      const keyUtilization = apiKeys.map(key => ({
        keyId: key.id,
        keyName: key.keyName,
        provider: key.provider,
        dailyUsagePercent: key.dailyRequestUsagePercent,
        monthlyUsagePercent: key.monthlyRequestUsagePercent,
        isActive: key.isActive,
        lastUsed: key.lastUsedAt
      }))

      // Get recent errors
      const { data: recentErrors } = await authenticatedSupabase
        .from('api_usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('success', false)
        .order('request_timestamp', { ascending: false })
        .limit(20)

      return reply.send({
        success: true,
        data: {
          usageStats,
          keyUtilization,
          recentErrors: recentErrors || [],
          summary: {
            totalKeys: apiKeys.length,
            activeKeys: apiKeys.filter(k => k.isActive).length,
            totalRequests: usageStats.totalRequests,
            totalTokens: usageStats.totalTokens,
            totalCost: usageStats.totalCost,
            avgResponseTime: 0 // TODO: Calculate from logs
          }
        }
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics dashboard'
      })
    }
  })

  // Bulk operations for API keys
  server.post('/api/keys/bulk', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const authenticatedSupabase = makeSupabaseForRequest(request)
      if (!authenticatedSupabase) {
        return reply.code(500).send({ success: false, error: 'Supabase not configured' })
      }
      const service = new APIKeyManagementService(authenticatedSupabase, user.id)

      const { action, keyIds, updates } = request.body as {
        action: 'activate' | 'deactivate' | 'delete' | 'update'
        keyIds: string[]
        updates?: Partial<APIKeyConfig>
      }

      if (!action || !keyIds || !Array.isArray(keyIds)) {
        return reply.code(400).send({
          success: false,
          error: 'Action and keyIds array are required'
        })
      }

      const results = []

      for (const keyId of keyIds) {
        try {
          switch (action) {
            case 'activate':
              await service.updateAPIKey(keyId, { isActive: true })
              results.push({ keyId, success: true })
              break

            case 'deactivate':
              await service.updateAPIKey(keyId, { isActive: false })
              results.push({ keyId, success: true })
              break

            case 'delete':
              await service.deleteAPIKey(keyId)
              results.push({ keyId, success: true })
              break

            case 'update':
              if (updates) {
                await service.updateAPIKey(keyId, updates)
                results.push({ keyId, success: true })
              } else {
                results.push({ keyId, success: false, error: 'No updates provided' })
              }
              break

            default:
              results.push({ keyId, success: false, error: 'Invalid action' })
          }
        } catch (error) {
          results.push({
            keyId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      return reply.send({
        success: true,
        data: results
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to perform bulk operation'
      })
    }
  })

  // Export usage data
  server.get('/api/usage/export', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const authenticatedSupabase = makeSupabaseForRequest(request)
      if (!authenticatedSupabase) {
        return reply.code(500).send({ success: false, error: 'Supabase not configured' })
      }
      
      const { 
        format = 'json',
        provider,
        startDate,
        endDate
      } = request.query as { 
        format?: 'json' | 'csv'
        provider?: string
        startDate?: string
        endDate?: string
      }

      let query = authenticatedSupabase
        .from('api_usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('request_timestamp', { ascending: false })

      if (provider) query = query.eq('provider', provider)
      if (startDate) query = query.gte('request_timestamp', startDate)
      if (endDate) query = query.lte('request_timestamp', endDate)

      const { data, error } = await query

      if (error) throw error

      if (format === 'csv') {
        // Convert to CSV
        const headers = [
          'timestamp', 'provider', 'model', 'prompt_tokens', 'completion_tokens',
          'total_tokens', 'response_time_ms', 'success', 'error_message', 'cost'
        ]
        
        const csv = [
          headers.join(','),
          ...data.map(row => [
            row.request_timestamp,
            row.provider,
            row.model_used || '',
            row.prompt_tokens || 0,
            row.completion_tokens || 0,
            row.total_tokens || 0,
            row.response_time_ms || 0,
            row.success,
            row.error_message || '',
            row.estimated_cost_usd || 0
          ].join(','))
        ].join('\n')

        reply.header('Content-Type', 'text/csv')
        reply.header('Content-Disposition', 'attachment; filename=api_usage_export.csv')
        return csv
      }

      return reply.send({
        success: true,
        data: data || []
      })
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export usage data'
      })
    }
  })
}