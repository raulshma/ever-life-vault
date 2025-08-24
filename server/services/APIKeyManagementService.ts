/**
 * API Key Management Service
 * 
 * This service provides comprehensive API key management including:
 * - Multiple key storage and rotation (both user and system keys)
 * - Usage tracking and rate limiting
 * - Automatic key rotation based on usage patterns
 * - Integration with OpenRouter and Gemini API providers
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { SecretsService } from './SecretsService.js'

export interface APIKeyConfig {
  id?: string
  userId?: string // Optional for system keys
  provider: 'openrouter' | 'google' | 'custom'
  keyName: string
  apiKey: string
  isActive?: boolean
  isSystemKey?: boolean
  systemKeyName?: string
  systemKeySource?: 'environment' | 'jenkins' | 'manual'
  
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
  isSystemKey: boolean
  systemKeyName?: string
  systemKeySource?: string
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
  
  // Rotation settings
  rotationPriority: number
}

export interface SystemKeyInfo {
  id: string
  keyName: string
  provider: string
  isActive: boolean
  systemKeyName: string
  systemKeySource: string
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
  
  // Rotation settings
  rotationPriority: number
}

export interface APIUsageLog {
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
  private userId?: string
  private secretsService: SecretsService

  constructor(supabase: SupabaseClient, userId?: string) {
    this.supabase = supabase
    this.userId = userId
    this.secretsService = new SecretsService(supabase)
  }

  /**
   * Initialize system keys from environment variables
   * This should be called during application startup
   */
  async initializeSystemKeys(systemKeys: { google?: string; openrouter?: string }): Promise<void> {
    try {
      // Initialize Google system key if available
      if (systemKeys.google) {
        await this.ensureSystemKeyExists('google', 'GOOGLE_API_KEY', systemKeys.google, 'environment')
      }
      
      // Initialize OpenRouter system key if available
      if (systemKeys.openrouter) {
        await this.ensureSystemKeyExists('openrouter', 'OPENROUTER_API_KEY', systemKeys.openrouter, 'environment')
      }
    } catch (error) {
      console.error('Failed to initialize system keys:', error)
    }
  }

  /**
   * Ensure a system key exists in the database
   */
  private async ensureSystemKeyExists(
    provider: 'openrouter' | 'google' | 'custom', 
    systemKeyName: string, 
    apiKey: string, 
    source: 'environment' | 'jenkins' | 'manual'
  ): Promise<void> {
    try {
      // Check if system key already exists
      const { data: existingKey } = await this.supabase
        .from('api_keys')
        .select('id')
        .eq('is_system_key', true)
        .eq('system_key_name', systemKeyName)
        .single()

      if (existingKey) {
        // Update the existing system key if needed
        await this.updateSystemKey(existingKey.id, { apiKey, source })
        return
      }

      // Create new system key
      await this.addSystemKey({
        provider,
        keyName: `${provider}_system_key`,
        apiKey,
        systemKeyName,
        systemKeySource: source,
        isActive: true,
        dailyRequestLimit: 1000, // Default limits for system keys
        dailyTokenLimit: 1000000,
        monthlyRequestLimit: 30000,
        monthlyTokenLimit: 30000000,
        rotationPriority: 10 // High priority for system keys
      })
    } catch (error) {
      console.error(`Failed to ensure system key exists for ${systemKeyName}:`, error)
    }
  }

  /**
   * Add a new system API key
   */
  async addSystemKey(config: Omit<APIKeyConfig, 'userId'> & { systemKeyName: string; systemKeySource: 'environment' | 'jenkins' | 'manual' }): Promise<string> {
    // Hash the API key for secure storage
    const keyHash = this.hashAPIKey(config.apiKey)
    
    const { data, error } = await this.supabase
      .from('api_keys')
      .insert({
        user_id: null, // System keys don't belong to a specific user
        provider: config.provider,
        key_name: config.keyName,
        key_hash: keyHash,
        is_active: config.isActive ?? true,
        is_system_key: true,
        system_key_name: config.systemKeyName,
        system_key_source: config.systemKeySource,
        daily_request_limit: config.dailyRequestLimit,
        daily_token_limit: config.dailyTokenLimit,
        monthly_request_limit: config.monthlyRequestLimit,
        monthly_token_limit: config.monthlyTokenLimit,
        rotation_priority: config.rotationPriority ?? 10
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to add system API key: ${error.message}`)
    }

    // Store the raw API key securely via SecretsService (encrypted)
    try {
      await this.secretsService.storeSecret(this.getSecretStorageKey(data.id), config.apiKey, 'system')
    } catch (e) {
      // Best-effort cleanup if secret storage fails
      await this.supabase.from('api_keys').delete().eq('id', data.id).eq('is_system_key', true)
      throw e instanceof Error ? e : new Error('Failed to securely store system API key')
    }

    return data.id
  }

  /**
   * Update an existing system key
   */
  private async updateSystemKey(keyId: string, updates: { apiKey?: string; source?: 'environment' | 'jenkins' | 'manual' }): Promise<void> {
    try {
      if (updates.apiKey) {
        // Update the stored API key
        await this.secretsService.storeSecret(this.getSecretStorageKey(keyId), updates.apiKey, 'system')
      }
      
      if (updates.source) {
        // Update the source
        await this.supabase
          .from('api_keys')
          .update({ system_key_source: updates.source })
          .eq('id', keyId)
          .eq('is_system_key', true)
      }
    } catch (error) {
      console.error('Failed to update system key:', error)
    }
  }

  /**
   * Add a new API key (user or system)
   */
  async addAPIKey(config: APIKeyConfig): Promise<string> {
    if (config.isSystemKey) {
      if (!config.systemKeyName || !config.systemKeySource) {
        throw new Error('System keys require systemKeyName and systemKeySource')
      }
      return this.addSystemKey(config as any)
    }

    if (!this.userId) {
      throw new Error('User ID required for user API keys')
    }

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
        is_system_key: false,
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
   * Get all API keys for the user and system (without revealing actual keys)
   */
  async getAPIKeys(provider?: string): Promise<APIKeyInfo[]> {
    let query = this.supabase
      .from('api_keys')
      .select('*')
      .eq('is_system_key', false)
      .eq('user_id', this.userId)

    if (provider) {
      query = query.eq('provider', provider)
    }

    const { data: userKeys, error: userError } = await query

    if (userError) {
      throw new Error(`Failed to fetch user API keys: ${userError.message}`)
    }

    // Get system keys for the same provider(s)
    let systemKeysQuery = this.supabase
      .from('api_keys')
      .select('*')
      .eq('is_system_key', true)

    if (provider) {
      systemKeysQuery = systemKeysQuery.eq('provider', provider)
    }

    const { data: systemKeys, error: systemError } = await systemKeysQuery

    if (systemError) {
      throw new Error(`Failed to fetch system API keys: ${systemError.message}`)
    }

    // Combine and format both user and system keys
    const allKeys = [...(userKeys || []), ...(systemKeys || [])]
    
    return allKeys.map(key => this.formatAPIKeyInfo(key))
  }

  /**
   * Get system keys only
   */
  async getSystemKeys(provider?: string): Promise<SystemKeyInfo[]> {
    let query = this.supabase
      .from('api_keys')
      .select('*')
      .eq('is_system_key', true)

    if (provider) {
      query = query.eq('provider', provider)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch system API keys: ${error.message}`)
    }

    return (data || []).map(key => this.formatSystemKeyInfo(key))
  }

  /**
   * Update API key configuration
   */
  async updateAPIKey(keyId: string, updates: Partial<APIKeyConfig>): Promise<void> {
    if (!this.userId) {
      throw new Error('User ID required for updating API keys')
    }

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
    if (!this.userId) {
      throw new Error('User ID required for deleting API keys')
    }

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
   * This now considers both user and system keys
   */
  async getBestAPIKey(provider: string, requiredTokens = 0): Promise<{ keyId: string; apiKey: string; isSystemKey: boolean } | null> {
    // Get all active keys for the provider (both user and system), ordered by priority and usage
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('*')
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
          apiKey,
          isSystemKey: key.is_system_key
        }
      }
    }

    return null
  }

  /**
   * Log API usage for tracking and billing (both user and system keys)
   */
  async logAPIUsage(keyId: string, usage: APIUsageLog): Promise<void> {
    try {
      // First, check if this is a system key
      const { data: keyInfo } = await this.supabase
        .from('api_keys')
        .select('is_system_key')
        .eq('id', keyId)
        .single()

      if (keyInfo?.is_system_key) {
        // Use the database function for system keys
        await this.supabase.rpc('log_system_api_usage', {
          key_id: keyId,
          usage_data: {
            model: usage.modelUsed,
            prompt_tokens: usage.promptTokens,
            completion_tokens: usage.completionTokens,
            total_tokens: usage.totalTokens,
            response_time_ms: usage.responseTimeMs,
            status_code: usage.statusCode,
            success: usage.success,
            error_message: usage.errorMessage,
            endpoint: usage.endpoint,
            method: usage.method,
            estimated_cost_usd: usage.estimatedCostUsd,
            metadata: usage.metadata
          }
        })
      } else {
        // Use existing logic for user keys
        await this.logUserAPIUsage(keyId, usage)
      }
    } catch (error) {
      console.error('Failed to log API usage:', error)
    }
  }

  /**
   * Log API usage for user keys (existing logic)
   */
  private async logUserAPIUsage(keyId: string, usage: APIUsageLog): Promise<void> {
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
   * Set rate limiting configuration for a provider
   */
  async setRateLimitConfig(provider: string, config: RateLimitConfig): Promise<void> {
    // Implementation for rate limiting configuration
    // This would typically store the config in a separate table or in system settings
    console.log(`Setting rate limit config for ${provider}:`, config)
  }

  /**
   * Get rate limiting configuration for a provider
   */
  async getRateLimitConfig(provider: string): Promise<RateLimitConfig | null> {
    // Implementation for retrieving rate limiting configuration
    // This would typically retrieve the config from a separate table or system settings
    console.log(`Getting rate limit config for ${provider}`)
    return null
  }

  /**
   * Rotate API keys based on usage patterns
   */
  async rotateAPIKeys(provider: string): Promise<KeyRotationResult | null> {
    // Implementation for automatic key rotation
    // This would analyze usage patterns and rotate keys as needed
    console.log(`Rotating API keys for ${provider}`)
    return null
  }

  /**
   * Get usage statistics for API keys
   */
  async getUsageStats(provider?: string, days: number = 30): Promise<any> {
    // Implementation for usage statistics
    // This would aggregate usage data from api_usage_logs
    console.log(`Getting usage stats for ${provider || 'all providers'} for ${days} days`)
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      dailyUsage: [],
      topModels: []
    }
  }

  /**
   * Get provider rate limit presets
   */
  async getProviderRateLimits(provider: string, tier?: string): Promise<ProviderRateLimit[]> {
    // Implementation for provider rate limit presets
    // This would return predefined rate limit configurations
    console.log(`Getting rate limit presets for ${provider} tier ${tier || 'default'}`)
    return []
  }

  /**
   * Reset usage counters if needed
   */
  private async resetCountersIfNeeded(): Promise<void> {
    // Reset daily counters
    await this.supabase.rpc('reset_daily_usage_counters')
    
    // Reset monthly counters
    await this.supabase.rpc('reset_monthly_usage_counters')
  }

  /**
   * Format API key info for response
   */
  private formatAPIKeyInfo(key: any): APIKeyInfo {
    return {
      id: key.id,
      keyName: key.key_name,
      provider: key.provider,
      isActive: key.is_active,
      isSystemKey: key.is_system_key,
      systemKeyName: key.system_key_name,
      systemKeySource: key.system_key_source,
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
      dailyRequestUsagePercent: key.daily_request_limit 
        ? (key.daily_requests_used / key.daily_request_limit) * 100 
        : 0,
      dailyTokenUsagePercent: key.daily_token_limit 
        ? (key.daily_tokens_used / key.daily_token_limit) * 100 
        : 0,
      monthlyRequestUsagePercent: key.monthly_request_limit 
        ? (key.monthly_requests_used / key.monthly_request_limit) * 100 
        : 0,
      monthlyTokenUsagePercent: key.monthly_token_limit 
        ? (key.monthly_tokens_used / key.monthly_token_limit) * 100 
        : 0,
      rotationPriority: key.rotation_priority
    }
  }

  /**
   * Format system key info for response
   */
  private formatSystemKeyInfo(key: any): SystemKeyInfo {
    return {
      id: key.id,
      keyName: key.key_name,
      provider: key.provider,
      isActive: key.is_active,
      systemKeyName: key.system_key_name,
      systemKeySource: key.system_key_source,
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
      dailyRequestUsagePercent: key.daily_request_limit 
        ? (key.daily_requests_used / key.daily_request_limit) * 100 
        : 0,
      dailyTokenUsagePercent: key.daily_token_limit 
        ? (key.daily_tokens_used / key.daily_token_limit) * 100 
        : 0,
      monthlyRequestUsagePercent: key.monthly_request_limit 
        ? (key.monthly_requests_used / key.monthly_request_limit) * 100 
        : 0,
      monthlyTokenUsagePercent: key.monthly_token_limit 
        ? (key.monthly_tokens_used / key.monthly_token_limit) * 100 
        : 0,
      rotationPriority: key.rotation_priority
    }
  }

  /**
   * Get secret storage key for API key
   */
  private getSecretStorageKey(keyId: string): string {
    // Namespaced secret key per user API key record
    return `user_api_key_${keyId}`
  }

  /**
   * Get decrypted API key by ID (works for both user and system keys)
   */
  private async getDecryptedAPIKeyById(keyId: string): Promise<string> {
    try {
      // Check if this is a system key
      const { data: keyInfo } = await this.supabase
        .from('api_keys')
        .select('is_system_key')
        .eq('id', keyId)
        .single()

      if (keyInfo?.is_system_key) {
        // For system keys, use 'system' as the user ID
        return await this.secretsService.retrieveSecret(this.getSecretStorageKey(keyId), 'system') || ''
      } else {
        // For user keys, use the actual user ID
        if (!this.userId) {
          throw new Error('User ID required for user API keys')
        }
        return await this.secretsService.retrieveSecret(this.getSecretStorageKey(keyId), this.userId) || ''
      }
    } catch (error) {
      console.error('Failed to retrieve decrypted API key:', error)
      throw new Error('Failed to retrieve API key')
    }
  }

  /**
   * Check if a key can be used based on its limits
   */
  private canUseKey(key: any, requiredTokens: number): boolean {
    if (!key.is_active) return false
    
    // Check daily request limit
    if (key.daily_request_limit && key.daily_requests_used >= key.daily_request_limit) {
      return false
    }
    
    // Check daily token limit
    if (key.daily_token_limit && (key.daily_tokens_used + requiredTokens) > key.daily_token_limit) {
      return false
    }
    
    // Check monthly request limit
    if (key.monthly_request_limit && key.monthly_requests_used >= key.monthly_request_limit) {
      return false
    }
    
    // Check monthly token limit
    if (key.monthly_token_limit && (key.monthly_tokens_used + requiredTokens) > key.monthly_token_limit) {
      return false
    }
    
    return true
  }

  /**
   * Hash API key for secure storage
   */
  private hashAPIKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex')
  }
}