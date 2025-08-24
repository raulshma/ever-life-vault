/**
 * API Key Management Hook
 * 
 * React hook for managing API keys, usage tracking, and rate limiting.
 * Provides CRUD operations and real-time usage monitoring.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { useToast } from './use-toast'

export interface APIKeyInfo {
  id: string
  keyName: string
  provider: string
  isActive: boolean
  createdAt: string
  lastUsedAt?: string
  dailyRequestLimit?: number
  dailyTokenLimit?: number
  monthlyRequestLimit?: number
  monthlyTokenLimit?: number
  dailyRequestsUsed: number
  dailyTokensUsed: number
  monthlyRequestsUsed: number
  monthlyTokensUsed: number
  dailyRequestUsagePercent: number
  dailyTokenUsagePercent: number
  monthlyRequestUsagePercent: number
  monthlyTokenUsagePercent: number
  rotationPriority: number
}

export interface UsageStats {
  totalRequests: number
  totalTokens: number
  totalCost: number
  dailyUsage: Array<{ date: string; requests: number; tokens: number; cost: number }>
  topModels: Array<{ model: string; requests: number; tokens: number }>
}

export interface AddAPIKeyData {
  provider: 'openrouter' | 'google' | 'custom'
  keyName: string
  apiKey: string
  dailyRequestLimit?: number
  dailyTokenLimit?: number
  monthlyRequestLimit?: number
  monthlyTokenLimit?: number
  rotationPriority?: number
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

export function useAPIKeyManagement() {
  const [apiKeys, setApiKeys] = useState<APIKeyInfo[]>([])
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { session } = useAuth()
  const { toast } = useToast()

  const authHeaders = {
    'Authorization': `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json'
  }

  // Load API keys
  const loadAPIKeys = useCallback(async (provider?: string) => {
    if (!session) return

    try {
      setLoading(true)
      setError(null)

      const url = provider 
        ? `/api/keys?provider=${provider}`
        : '/api/keys'

      const response = await fetch(url, {
        headers: authHeaders
      })

      const data = await response.json()

      if (data.success) {
        setApiKeys(data.data)
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load API keys'
      setError(errorMsg)
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [session, toast])

  // Load usage statistics
  const loadUsageStats = useCallback(async (provider?: string, days = 30) => {
    if (!session) return

    try {
      const params = new URLSearchParams({
        days: days.toString(),
        ...(provider && { provider })
      })

      const response = await fetch(`/api/usage/stats?${params}`, {
        headers: authHeaders
      })

      const data = await response.json()

      if (data.success) {
        setUsageStats(data.data)
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load usage stats'
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive'
      })
    }
  }, [session, toast])

  // Add new API key
  const addAPIKey = useCallback(async (keyData: AddAPIKeyData) => {
    if (!session) throw new Error('Not authenticated')

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(keyData)
      })

      const data = await response.json()

      if (data.success) {
        await loadAPIKeys()
        toast({
          title: 'Success',
          description: 'API key added successfully'
        })
        return data.data.keyId
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add API key'
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive'
      })
      throw err
    }
  }, [session, toast, loadAPIKeys])

  // Update API key
  const updateAPIKey = useCallback(async (keyId: string, updates: Partial<AddAPIKeyData>) => {
    if (!session) throw new Error('Not authenticated')

    try {
      const response = await fetch(`/api/keys/${keyId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(updates)
      })

      const data = await response.json()

      if (data.success) {
        await loadAPIKeys()
        toast({
          title: 'Success',
          description: 'API key updated successfully'
        })
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update API key'
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive'
      })
      throw err
    }
  }, [session, toast, loadAPIKeys])

  // Delete API key
  const deleteAPIKey = useCallback(async (keyId: string) => {
    if (!session) throw new Error('Not authenticated')

    try {
      const response = await fetch(`/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: authHeaders
      })

      const data = await response.json()

      if (data.success) {
        await loadAPIKeys()
        toast({
          title: 'Success',
          description: 'API key deleted successfully'
        })
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete API key'
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive'
      })
      throw err
    }
  }, [session, toast, loadAPIKeys])

  // Toggle key active status
  const toggleKeyStatus = useCallback(async (keyId: string, isActive: boolean) => {
    await updateAPIKey(keyId, { isActive: !isActive })
  }, [updateAPIKey])

  // Set rate limit configuration
  const setRateLimitConfig = useCallback(async (config: RateLimitConfig) => {
    if (!session) throw new Error('Not authenticated')

    try {
      const response = await fetch(`/api/rate-limits/${config.provider}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(config)
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Rate limit configuration updated'
        })
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to set rate limit config'
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive'
      })
      throw err
    }
  }, [session, toast])

  // Get rate limit configuration
  const getRateLimitConfig = useCallback(async (provider: string): Promise<RateLimitConfig | null> => {
    if (!session) return null

    try {
      const response = await fetch(`/api/rate-limits/${provider}`, {
        headers: authHeaders
      })

      const data = await response.json()

      if (data.success) {
        return data.data
      } else {
        return null
      }
    } catch (err) {
      console.error('Failed to get rate limit config:', err)
      return null
    }
  }, [session])

  // Bulk operations
  const bulkUpdateKeys = useCallback(async (
    keyIds: string[],
    action: 'activate' | 'deactivate' | 'delete',
    updates?: Partial<AddAPIKeyData>
  ) => {
    if (!session) throw new Error('Not authenticated')

    try {
      const response = await fetch('/api/keys/bulk', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action,
          keyIds,
          updates
        })
      })

      const data = await response.json()

      if (data.success) {
        await loadAPIKeys()
        
        const successful = data.data.filter((r: any) => r.success).length
        const failed = data.data.filter((r: any) => !r.success).length
        
        toast({
          title: 'Bulk Operation Complete',
          description: `${successful} keys updated successfully${failed > 0 ? `, ${failed} failed` : ''}`
        })
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to perform bulk operation'
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive'
      })
      throw err
    }
  }, [session, toast, loadAPIKeys])

  // Test API key
  const testAPIKey = useCallback(async (keyId: string) => {
    if (!session) throw new Error('Not authenticated')

    try {
      const response = await fetch(`/api/keys/${keyId}/test`, {
        method: 'POST',
        headers: authHeaders
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Test Successful',
          description: 'API key is valid and working'
        })
        return true
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'API key test failed'
      toast({
        title: 'Test Failed',
        description: errorMsg,
        variant: 'destructive'
      })
      return false
    }
  }, [session, toast])

  // Load initial data
  useEffect(() => {
    if (session) {
      loadAPIKeys()
      loadUsageStats()
    }
  }, [session, loadAPIKeys, loadUsageStats])

  return {
    // Data
    apiKeys,
    usageStats,
    loading,
    error,

    // Actions
    loadAPIKeys,
    loadUsageStats,
    addAPIKey,
    updateAPIKey,
    deleteAPIKey,
    toggleKeyStatus,
    setRateLimitConfig,
    getRateLimitConfig,
    bulkUpdateKeys,
    testAPIKey,

    // Helper functions
    refresh: () => {
      loadAPIKeys()
      loadUsageStats()
    }
  }
}