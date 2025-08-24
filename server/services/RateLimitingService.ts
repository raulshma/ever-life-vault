/**
 * Rate Limiting Service
 * 
 * Provides intelligent rate limiting and throttling for AI API providers.
 * Supports OpenRouter and Gemini with configurable limits and automatic backoff.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RateLimitConfig } from './APIKeyManagementService.js'

export interface RateLimitState {
  requests: number
  tokens: number
  lastRequest: number
  resetTime: number
}

export interface RateLimitResult {
  allowed: boolean
  waitTime?: number
  reason?: string
  retryAfter?: number
}

export interface ThrottleConfig {
  enabled: boolean
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitter: boolean
}

export class RateLimitingService {
  private supabase: SupabaseClient
  private userId: string
  
  // In-memory rate limit tracking
  private rateLimitStates = new Map<string, {
    minute: RateLimitState
    hour: RateLimitState
    day: RateLimitState
  }>()

  private requestQueue = new Map<string, Array<{
    resolve: (value: boolean) => void
    reject: (error: Error) => void
    tokens: number
    priority: number
  }>>()

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId

    // Clean up old rate limit states every 5 minutes
    setInterval(() => this.cleanupOldStates(), 5 * 60 * 1000)
  }

  /**
   * Check if a request is allowed under current rate limits
   */
  async checkRateLimit(
    provider: string,
    keyId: string,
    tokens: number = 1,
    priority: number = 1
  ): Promise<RateLimitResult> {
    const config = await this.getRateLimitConfig(provider)
    if (!config) {
      return { allowed: true }
    }

    const stateKey = `${provider}:${keyId}`
    const now = Date.now()
    
    // Initialize state if not exists
    if (!this.rateLimitStates.has(stateKey)) {
      this.initializeRateLimitState(stateKey, now)
    }

    const state = this.rateLimitStates.get(stateKey)!
    
    // Reset counters if time windows have passed
    this.resetCountersIfNeeded(state, now)

    // Check rate limits
    const minuteCheck = this.checkLimit(state.minute, config.requestsPerMinute, config.tokensPerMinute, tokens)
    const hourCheck = this.checkLimit(state.hour, config.requestsPerHour, config.tokensPerHour, tokens)
    const dayCheck = this.checkLimit(state.day, config.requestsPerDay, config.tokensPerDay, tokens)

    // Find the most restrictive limit
    const checks = [
      { check: minuteCheck, window: 'minute', resetIn: 60 - Math.floor((now / 1000) % 60) },
      { check: hourCheck, window: 'hour', resetIn: 3600 - Math.floor((now / 1000) % 3600) },
      { check: dayCheck, window: 'day', resetIn: 86400 - Math.floor((now / 1000) % 86400) }
    ].filter(c => !c.check.allowed)

    if (checks.length > 0) {
      const mostRestrictive = checks.reduce((min, current) => 
        current.resetIn < min.resetIn ? current : min
      )

      // If throttling is enabled, queue the request
      if (config.throttleEnabled) {
        return await this.queueRequest(stateKey, tokens, priority, config)
      }

      return {
        allowed: false,
        reason: `Rate limit exceeded for ${mostRestrictive.window}`,
        retryAfter: mostRestrictive.resetIn,
        waitTime: mostRestrictive.resetIn * 1000
      }
    }

    // Update counters
    this.updateCounters(state, tokens, now)

    return { allowed: true }
  }

  /**
   * Queue a request when throttling is enabled
   */
  private async queueRequest(
    stateKey: string,
    tokens: number,
    priority: number,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    return new Promise((resolve, reject) => {
      if (!this.requestQueue.has(stateKey)) {
        this.requestQueue.set(stateKey, [])
      }

      const queue = this.requestQueue.get(stateKey)!
      queue.push({
        resolve: (allowed: boolean) => resolve({ allowed }),
        reject,
        tokens,
        priority
      })

      // Sort by priority (higher first)
      queue.sort((a, b) => b.priority - a.priority)

      // Process queue after delay
      setTimeout(() => {
        this.processQueue(stateKey, config)
      }, config.throttleDelayMs || 1000)
    })
  }

  /**
   * Process queued requests with throttling
   */
  private async processQueue(stateKey: string, config: RateLimitConfig) {
    const queue = this.requestQueue.get(stateKey)
    if (!queue || queue.length === 0) return

    const request = queue.shift()!
    
    try {
      const result = await this.checkRateLimit(
        stateKey.split(':')[0], 
        stateKey.split(':')[1], 
        request.tokens, 
        request.priority
      )
      
      request.resolve(result.allowed)
    } catch (error) {
      request.reject(error as Error)
    }

    // Continue processing if there are more requests
    if (queue.length > 0) {
      setTimeout(() => {
        this.processQueue(stateKey, config)
      }, config.throttleDelayMs || 1000)
    }
  }

  /**
   * Get adaptive throttling configuration based on recent failures
   */
  async getAdaptiveThrottling(provider: string, keyId: string): Promise<ThrottleConfig> {
    // Get recent error rate for this key
    const recentErrors = await this.getRecentErrorRate(keyId)
    
    let baseDelay = 1000
    let maxDelay = 10000
    let backoffMultiplier = 1.5

    // Increase delays based on error rate
    if (recentErrors > 0.5) { // 50% error rate
      baseDelay = 5000
      maxDelay = 30000
      backoffMultiplier = 2.0
    } else if (recentErrors > 0.2) { // 20% error rate
      baseDelay = 2000
      maxDelay = 15000
      backoffMultiplier = 1.8
    }

    return {
      enabled: true,
      baseDelay,
      maxDelay,
      backoffMultiplier,
      jitter: true
    }
  }

  /**
   * Calculate dynamic delay with exponential backoff and jitter
   */
  calculateThrottleDelay(
    attempt: number,
    config: ThrottleConfig,
    lastDelay: number = 0
  ): number {
    if (!config.enabled) return 0

    let delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
      config.maxDelay
    )

    // Add jitter to prevent thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5)
    }

    return Math.floor(delay)
  }

  /**
   * Get OpenRouter specific rate limits based on tier
   */
  getOpenRouterLimits(hasPaidCredits: boolean = false): RateLimitConfig {
    if (hasPaidCredits) {
      return {
        provider: 'openrouter',
        requestsPerMinute: 20,
        requestsPerDay: 1000,
        tokensPerMinute: 250000,
        throttleEnabled: true,
        throttleDelayMs: 1000,
        burstAllowance: 5
      }
    } else {
      return {
        provider: 'openrouter',
        requestsPerMinute: 20,
        requestsPerDay: 50,
        tokensPerMinute: 250000,
        throttleEnabled: true,
        throttleDelayMs: 2000,
        burstAllowance: 3
      }
    }
  }

  /**
   * Get Gemini specific rate limits based on model
   */
  getGeminiLimits(model: string): RateLimitConfig {
    const modelLimits: Record<string, Partial<RateLimitConfig>> = {
      'gemini-2.5-pro': {
        requestsPerMinute: 5,
        requestsPerDay: 100,
        tokensPerMinute: 250000
      },
      'gemini-2.5-flash': {
        requestsPerMinute: 10,
        requestsPerDay: 250,
        tokensPerMinute: 250000
      },
      'gemini-2.5-flash-lite': {
        requestsPerMinute: 15,
        requestsPerDay: 1000,
        tokensPerMinute: 250000
      },
      'gemini-2.0-flash': {
        requestsPerMinute: 15,
        requestsPerDay: 200,
        tokensPerMinute: 1000000
      },
      'gemini-2.0-flash-lite': {
        requestsPerMinute: 30,
        requestsPerDay: 200,
        tokensPerMinute: 1000000
      }
    }

    const limits = modelLimits[model] || modelLimits['gemini-2.5-flash']

    return {
      provider: 'google',
      throttleEnabled: true,
      throttleDelayMs: 1500,
      burstAllowance: 2,
      ...limits
    }
  }

  /**
   * Monitor and report rate limit violations
   */
  async reportRateLimitViolation(
    provider: string,
    keyId: string,
    violationType: 'requests' | 'tokens',
    attemptedValue: number,
    limit: number
  ): Promise<void> {
    console.warn(`Rate limit violation for ${provider}:${keyId} - ${violationType}: ${attemptedValue}/${limit}`)
    
    // Log to usage logs for analysis
    await this.supabase
      .from('api_usage_logs')
      .insert({
        user_id: this.userId,
        api_key_id: keyId,
        provider,
        success: false,
        error_message: `Rate limit violation: ${violationType} ${attemptedValue}/${limit}`,
        metadata: {
          violation_type: violationType,
          attempted_value: attemptedValue,
          limit_value: limit,
          timestamp: new Date().toISOString()
        }
      })
  }

  // Private helper methods

  private async getRateLimitConfig(provider: string): Promise<RateLimitConfig | null> {
    const { data, error } = await this.supabase
      .from('rate_limit_configs')
      .select('*')
      .eq('user_id', this.userId)
      .eq('provider', provider)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to get rate limit config:', error)
      return null
    }

    if (!data) return null

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

  private initializeRateLimitState(stateKey: string, now: number) {
    this.rateLimitStates.set(stateKey, {
      minute: { requests: 0, tokens: 0, lastRequest: now, resetTime: now + 60000 },
      hour: { requests: 0, tokens: 0, lastRequest: now, resetTime: now + 3600000 },
      day: { requests: 0, tokens: 0, lastRequest: now, resetTime: now + 86400000 }
    })
  }

  private resetCountersIfNeeded(state: any, now: number) {
    if (now >= state.minute.resetTime) {
      state.minute = { requests: 0, tokens: 0, lastRequest: now, resetTime: now + 60000 }
    }
    if (now >= state.hour.resetTime) {
      state.hour = { requests: 0, tokens: 0, lastRequest: now, resetTime: now + 3600000 }
    }
    if (now >= state.day.resetTime) {
      state.day = { requests: 0, tokens: 0, lastRequest: now, resetTime: now + 86400000 }
    }
  }

  private checkLimit(
    state: RateLimitState,
    requestLimit?: number,
    tokenLimit?: number,
    tokens: number = 1
  ): { allowed: boolean; reason?: string } {
    if (requestLimit && state.requests >= requestLimit) {
      return { allowed: false, reason: 'Request limit exceeded' }
    }
    
    if (tokenLimit && (state.tokens + tokens) > tokenLimit) {
      return { allowed: false, reason: 'Token limit exceeded' }
    }

    return { allowed: true }
  }

  private updateCounters(state: any, tokens: number, now: number) {
    state.minute.requests++
    state.minute.tokens += tokens
    state.minute.lastRequest = now

    state.hour.requests++
    state.hour.tokens += tokens
    state.hour.lastRequest = now

    state.day.requests++
    state.day.tokens += tokens
    state.day.lastRequest = now
  }

  private async getRecentErrorRate(keyId: string): Promise<number> {
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const { data, error } = await this.supabase
      .from('api_usage_logs')
      .select('success')
      .eq('api_key_id', keyId)
      .gte('request_timestamp', oneDayAgo.toISOString())

    if (error || !data || data.length === 0) {
      return 0
    }

    const errorCount = data.filter(log => !log.success).length
    return errorCount / data.length
  }

  private cleanupOldStates() {
    const now = Date.now()
    const cutoff = now - 86400000 // 24 hours

    for (const [key, state] of this.rateLimitStates.entries()) {
      if (state.day.lastRequest < cutoff) {
        this.rateLimitStates.delete(key)
      }
    }
  }
}