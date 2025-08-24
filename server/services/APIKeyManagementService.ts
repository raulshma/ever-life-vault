/**
 * API Key Management Service
 * 
 * This service provides comprehensive API key management including:
 * - Multiple key storage and rotation
 * - Usage tracking and rate limiting
 * - Automatic key rotation based on usage patterns
 * - Integration with OpenRouter and Gemini API providers
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { SecretsService } from './SecretsService.js'

export interface APIKeyConfig {
  id?: string
  userId: string
  provider: 'openrouter' | 'google' | 'custom'
  keyName: string
  apiKey: string
  isActive?: boolean
  
  // Usage limits (per key)
  dailyRequestLimit?: number
  dailyTokenLimit?: number
  monthlyRequestLimit?: number
  monthlyTokenLimit?: number
  
  // Rotation priority (higher = higher priority)
  rotationPriority?: number
}

export interface APIKeyInfo {
  id: string
  keyName: string
  provider: string
  isActive: boolean
  createdAt: string
  lastUsedAt?: string
  
  // Usage limits
  dailyRequestLimit?: number
  dailyTokenLimit?: number
  monthlyRequestLimit?: number
  monthlyTokenLimit?: number
  
  // Current usage
  dailyRequestsUsed: number
  dailyTokensUsed: number
  monthlyRequestsUsed: number
  monthlyTokensUsed: number
  
  // Usage percentages
  dailyRequestUsagePercent: number
  dailyTokenUsagePercent: number
  monthlyRequestUsagePercent: number
  monthlyTokenUsagePercent: number
  
  rotationPriority: number
}

export interface UsageLogEntry {
  id: string
  timestamp: string
  provider: string
  modelUsed?: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  responseTimeMs?: number
  statusCode?: number
  success: boolean
  errorMessage?: string
  estimatedCostUsd?: number
}

export interface RateLimitConfig {
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

export interface ProviderRateLimit {
  provider: string
  tierName: string
  modelPattern?: string
  requestsPerMinute?: number
  requestsPerHour?: number
  requestsPerDay?: number
  tokensPerMinute?: number
  tokensPerHour?: number
  tokensPerDay?: number
  concurrentRequests?: number
}

export interface KeyRotationResult {
  rotatedTo: string
  previousKey: string
  reason: string
}

export class APIKeyManagementService {
  private supabase: SupabaseClient
  private userId: string
  private secretsService: SecretsService

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.secretsService = new SecretsService(supabase)
  }

  /**
   * Add a new API key
   */
  async addAPIKey(config: APIKeyConfig): Promise<string> {
    // Hash the API key for secure storage
    const keyHash = this.hashAPIKey(config.apiKey)
    
    const { data, error } = await this.supabase
      .from('api_keys')
      .insert({
        user_id: this.userId,
        provider: config.provider,
        key_name: config.keyName,
        key_hash: keyHash,
        is_active: config.isActive ?? true,
        daily_request_limit: config.dailyRequestLimit,
        daily_token_limit: config.dailyTokenLimit,
        monthly_request_limit: config.monthlyRequestLimit,
        monthly_token_limit: config.monthlyTokenLimit,
        rotation_priority: config.rotationPriority ?? 1
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to add API key: ${error.message}`)
    }

    // Store the raw API key securely via SecretsService (encrypted per user)
    try {
      await this.secretsService.storeSecret(this.getSecretStorageKey(data.id), config.apiKey, this.userId)
    } catch (e) {
      // Best-effort cleanup if secret storage fails
      await this.supabase.from('api_keys').delete().eq('id', data.id).eq('user_id', this.userId)
      throw e instanceof Error ? e : new Error('Failed to securely store API key')
    }

    return data.id
  }

  /**
   * Get all API keys for the user (without revealing actual keys)
   */
  async getAPIKeys(provider?: string): Promise<APIKeyInfo[]> {
    let query = this.supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', this.userId)

    if (provider) {
      query = query.eq('provider', provider)
    }

    const { data, error } = await query.order('rotation_priority', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch API keys: ${error.message}`)
    }

    return data.map(key => this.transformToAPIKeyInfo(key))
  }

  /**
   * Update API key configuration
   */
  async updateAPIKey(keyId: string, updates: Partial<APIKeyConfig>): Promise<void> {
    const updateData: any = {}

    if (updates.keyName) updateData.key_name = updates.keyName
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive
    if (updates.dailyRequestLimit !== undefined) updateData.daily_request_limit = updates.dailyRequestLimit
    if (updates.dailyTokenLimit !== undefined) updateData.daily_token_limit = updates.dailyTokenLimit
    if (updates.monthlyRequestLimit !== undefined) updateData.monthly_request_limit = updates.monthlyRequestLimit
    if (updates.monthlyTokenLimit !== undefined) updateData.monthly_token_limit = updates.monthlyTokenLimit
    if (updates.rotationPriority !== undefined) updateData.rotation_priority = updates.rotationPriority

    if (updates.apiKey) {
      updateData.key_hash = this.hashAPIKey(updates.apiKey)
    }

    const { error } = await this.supabase
      .from('api_keys')
      .update(updateData)
      .eq('id', keyId)
      .eq('user_id', this.userId)

    if (error) {
      throw new Error(`Failed to update API key: ${error.message}`)
    }

    // If API key value is being updated, also update the encrypted secret storage
    if (updates.apiKey) {
      await this.secretsService.storeSecret(this.getSecretStorageKey(keyId), updates.apiKey, this.userId)
    }
  }

  /**
   * Delete an API key
   */
  async deleteAPIKey(keyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', this.userId)

    if (error) {
      throw new Error(`Failed to delete API key: ${error.message}`)
    }

    // Best-effort removal of the encrypted secret
    try {
      await this.secretsService.deleteSecret(this.getSecretStorageKey(keyId), this.userId)
    } catch {
      // ignore secret deletion errors to avoid masking primary deletion success
    }
  }

  /**
   * Get the best available API key for a provider with rotation logic
   */
  async getBestAPIKey(provider: string, requiredTokens = 0): Promise<{ keyId: string; apiKey: string } | null> {
    // Get all active keys for the provider, ordered by priority and usage
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', this.userId)
      .eq('provider', provider)
      .eq('is_active', true)
      .order('rotation_priority', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch API keys: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return null
    }

    // Reset counters if needed
    await this.resetCountersIfNeeded()

    // Find the best key based on usage and limits
    for (const key of data) {
      if (this.canUseKey(key, requiredTokens)) {
        // Retrieve and return the API key from encrypted storage
        const apiKey = await this.getDecryptedAPIKeyById(key.id)
        return {
          keyId: key.id,
          apiKey
        }
      }
    }

    return null
  }

  /**
   * Log API usage for tracking and billing
   */
  async logAPIUsage(keyId: string, usage: {
    provider: string
    modelUsed?: string
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
    responseTimeMs?: number
    statusCode?: number
    success: boolean
    errorMessage?: string
    endpoint?: string
    method?: string
    estimatedCostUsd?: number
    metadata?: any
  }): Promise<void> {
    // Log the usage
    const { error: logError } = await this.supabase
      .from('api_usage_logs')
      .insert({
        user_id: this.userId,
        api_key_id: keyId,
        provider: usage.provider,
        model_used: usage.modelUsed,
        prompt_tokens: usage.promptTokens ?? 0,
        completion_tokens: usage.completionTokens ?? 0,
        total_tokens: usage.totalTokens ?? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
        response_time_ms: usage.responseTimeMs,
        status_code: usage.statusCode,
        success: usage.success,
        error_message: usage.errorMessage,
        endpoint: usage.endpoint,
        method: usage.method,
        estimated_cost_usd: usage.estimatedCostUsd,
        metadata: usage.metadata
      })

    if (logError) {
      console.error('Failed to log API usage:', logError)
      // Don't throw error to avoid breaking the main request
    }

    // Update usage counters on the key (read-modify-write; consider RPC for atomic increments)
    try {
      const totalTokens = usage.totalTokens ?? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0)
      const { data: counters, error: fetchError } = await this.supabase
        .from('api_keys')
        .select('daily_requests_used, daily_tokens_used, monthly_requests_used, monthly_tokens_used')
        .eq('id', keyId)
        .single()

      if (!fetchError && counters) {
        const { error: updateError } = await this.supabase
          .from('api_keys')
          .update({
            daily_requests_used: (counters.daily_requests_used ?? 0) + 1,
            daily_tokens_used: (counters.daily_tokens_used ?? 0) + totalTokens,
            monthly_requests_used: (counters.monthly_requests_used ?? 0) + 1,
            monthly_tokens_used: (counters.monthly_tokens_used ?? 0) + totalTokens,
            last_used_at: new Date().toISOString()
          })
          .eq('id', keyId)

        if (updateError) {
          console.error('Failed to update usage counters:', updateError)
        }
      }
    } catch (e) {
      console.error('Failed to update usage counters:', e)
    }
  }

  /**
   * Get usage statistics for a provider or all providers
   */
  async getUsageStats(provider?: string, days = 30): Promise<{
    totalRequests: number
    totalTokens: number
    totalCost: number
    dailyUsage: Array<{ date: string; requests: number; tokens: number; cost: number }>
    topModels: Array<{ model: string; requests: number; tokens: number }>
  }> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = this.supabase
      .from('api_usage_logs')
      .select('*')
      .eq('user_id', this.userId)
      .gte('request_timestamp', startDate.toISOString())

    if (provider) {
      query = query.eq('provider', provider)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch usage stats: ${error.message}`)
    }

    const stats = {
      totalRequests: data.length,
      totalTokens: data.reduce((sum, log) => sum + (log.total_tokens ?? 0), 0),
      totalCost: data.reduce((sum, log) => sum + (log.estimated_cost_usd ?? 0), 0),
      dailyUsage: {} as Record<string, { requests: number; tokens: number; cost: number }>,
      modelUsage: {} as Record<string, { requests: number; tokens: number }>
    }

    // Process daily and model usage
    data.forEach(log => {
      const date = log.request_timestamp.split('T')[0]
      
      if (!stats.dailyUsage[date]) {
        stats.dailyUsage[date] = { requests: 0, tokens: 0, cost: 0 }
      }
      
      stats.dailyUsage[date].requests++
      stats.dailyUsage[date].tokens += log.total_tokens ?? 0
      stats.dailyUsage[date].cost += log.estimated_cost_usd ?? 0

      if (log.model_used) {
        if (!stats.modelUsage[log.model_used]) {
          stats.modelUsage[log.model_used] = { requests: 0, tokens: 0 }
        }
        stats.modelUsage[log.model_used].requests++
        stats.modelUsage[log.model_used].tokens += log.total_tokens ?? 0
      }
    })

    // Convert to arrays and sort
    const dailyUsage = Object.entries(stats.dailyUsage)
      .map(([date, usage]) => ({ date, ...usage }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const topModels = Object.entries(stats.modelUsage)
      .map(([model, usage]) => ({ model, ...usage }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10)

    return {
      totalRequests: stats.totalRequests,
      totalTokens: stats.totalTokens,
      totalCost: stats.totalCost,
      dailyUsage,
      topModels
    }
  }

  /**
   * Set rate limiting configuration for a provider
   */
  async setRateLimitConfig(config: RateLimitConfig): Promise<void> {
    const { error } = await this.supabase
      .from('rate_limit_configs')
      .upsert({
        user_id: this.userId,
        provider: config.provider,
        requests_per_minute: config.requestsPerMinute,
        requests_per_hour: config.requestsPerHour,
        requests_per_day: config.requestsPerDay,
        tokens_per_minute: config.tokensPerMinute,
        tokens_per_hour: config.tokensPerHour,
        tokens_per_day: config.tokensPerDay,
        throttle_enabled: config.throttleEnabled ?? false,
        throttle_delay_ms: config.throttleDelayMs ?? 1000,
        burst_allowance: config.burstAllowance ?? 5
      })

    if (error) {
      throw new Error(`Failed to set rate limit config: ${error.message}`)
    }
  }

  /**
   * Get rate limiting configuration for a provider
   */
  async getRateLimitConfig(provider: string): Promise<RateLimitConfig | null> {
    const { data, error } = await this.supabase
      .from('rate_limit_configs')
      .select('*')
      .eq('user_id', this.userId)
      .eq('provider', provider)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return null
      }
      throw new Error(`Failed to get rate limit config: ${error.message}`)
    }

    return {
      provider: data.provider,
      requestsPerMinute: data.requests_per_minute,
      requestsPerHour: data.requests_per_hour,
      requestsPerDay: data.requests_per_day,
      tokensPerMinute: data.tokens_per_minute,
      tokensPerHour: data.tokens_per_hour,
      tokensPerDay: data.tokens_per_day,
      throttleEnabled: data.throttle_enabled,
      throttleDelayMs: data.throttle_delay_ms,
      burstAllowance: data.burst_allowance
    }
  }

  /**
   * Get default rate limits for a provider based on tier
   */
  async getProviderRateLimits(provider: string, tier?: string): Promise<ProviderRateLimit[]> {
    let query = this.supabase
      .from('provider_rate_limit_presets')
      .select('*')
      .eq('provider', provider)

    if (tier) {
      query = query.eq('tier_name', tier)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get provider rate limits: ${error.message}`)
    }

    return data.map(preset => ({
      provider: preset.provider,
      tierName: preset.tier_name,
      modelPattern: preset.model_pattern,
      requestsPerMinute: preset.requests_per_minute,
      requestsPerHour: preset.requests_per_hour,
      requestsPerDay: preset.requests_per_day,
      tokensPerMinute: preset.tokens_per_minute,
      tokensPerHour: preset.tokens_per_hour,
      tokensPerDay: preset.tokens_per_day,
      concurrentRequests: preset.concurrent_requests
    }))
  }

  // Private helper methods

  private hashAPIKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex')
  }

  private async getDecryptedAPIKeyById(keyId: string): Promise<string> {
    const secret = await this.secretsService.retrieveSecret(this.getSecretStorageKey(keyId), this.userId)
    if (!secret) {
      throw new Error('API key material not found in secure storage')
    }
    return secret
  }

  private canUseKey(key: any, requiredTokens: number): boolean {
    // Check daily limits
    if (key.daily_request_limit && key.daily_requests_used >= key.daily_request_limit) {
      return false
    }
    
    if (key.daily_token_limit && (key.daily_tokens_used + requiredTokens) > key.daily_token_limit) {
      return false
    }

    // Check monthly limits
    if (key.monthly_request_limit && key.monthly_requests_used >= key.monthly_request_limit) {
      return false
    }
    
    if (key.monthly_token_limit && (key.monthly_tokens_used + requiredTokens) > key.monthly_token_limit) {
      return false
    }

    return true
  }

  private async resetCountersIfNeeded(): Promise<void> {
    // Reset daily counters
    await this.supabase.rpc('reset_daily_usage_counters')
    
    // Reset monthly counters
    await this.supabase.rpc('reset_monthly_usage_counters')
  }

  private transformToAPIKeyInfo(key: any): APIKeyInfo {
    const dailyRequestUsagePercent = key.daily_request_limit 
      ? (key.daily_requests_used / key.daily_request_limit) * 100 
      : 0
    
    const dailyTokenUsagePercent = key.daily_token_limit 
      ? (key.daily_tokens_used / key.daily_token_limit) * 100 
      : 0
    
    const monthlyRequestUsagePercent = key.monthly_request_limit 
      ? (key.monthly_requests_used / key.monthly_request_limit) * 100 
      : 0
    
    const monthlyTokenUsagePercent = key.monthly_token_limit 
      ? (key.monthly_tokens_used / key.monthly_token_limit) * 100 
      : 0

    return {
      id: key.id,
      keyName: key.key_name,
      provider: key.provider,
      isActive: key.is_active,
      createdAt: key.created_at,
      lastUsedAt: key.last_used_at,
      dailyRequestLimit: key.daily_request_limit,
      dailyTokenLimit: key.daily_token_limit,
      monthlyRequestLimit: key.monthly_request_limit,
      monthlyTokenLimit: key.monthly_token_limit,
      dailyRequestsUsed: key.daily_requests_used,
      dailyTokensUsed: key.daily_tokens_used,
      monthlyRequestsUsed: key.monthly_requests_used,
      monthlyTokensUsed: key.monthly_tokens_used,
      dailyRequestUsagePercent,
      dailyTokenUsagePercent,
      monthlyRequestUsagePercent,
      monthlyTokenUsagePercent,
      rotationPriority: key.rotation_priority
    }
  }

  private getSecretStorageKey(keyId: string): string {
    // Namespaced secret key per user API key record
    return `user_api_key_${keyId}`
  }
}