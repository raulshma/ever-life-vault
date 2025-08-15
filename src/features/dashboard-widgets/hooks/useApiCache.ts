import { useCallback, useRef } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface CacheOptions {
  cacheTimeMs?: number
  key?: string
}

export function useApiCache<T>() {
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map())

  const getCached = useCallback((key: string, cacheTimeMs?: number): T | null => {
    if (!cacheTimeMs) return null // No caching
    
    const entry = cacheRef.current.get(key)
    if (!entry) return null
    
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      // Cache expired, remove it
      cacheRef.current.delete(key)
      return null
    }
    
    return entry.data
  }, [])

  const setCached = useCallback((key: string, data: T, cacheTimeMs?: number): void => {
    if (!cacheTimeMs) return // No caching
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: cacheTimeMs
    }
    
    cacheRef.current.set(key, entry)
  }, [])

  const clearCache = useCallback((key?: string): void => {
    if (key) {
      cacheRef.current.delete(key)
    } else {
      cacheRef.current.clear()
    }
  }, [])

  const isExpired = useCallback((key: string): boolean => {
    const entry = cacheRef.current.get(key)
    if (!entry) return true
    
    const now = Date.now()
    return now - entry.timestamp > entry.ttl
  }, [])

  const getCacheInfo = useCallback((key: string): { exists: boolean; age: number; ttl: number; expired: boolean } | null => {
    const entry = cacheRef.current.get(key)
    if (!entry) return null
    
    const now = Date.now()
    const age = now - entry.timestamp
    
    return {
      exists: true,
      age,
      ttl: entry.ttl,
      expired: age > entry.ttl
    }
  }, [])

  return {
    getCached,
    setCached,
    clearCache,
    isExpired,
    getCacheInfo
  }
}

// Helper function to generate cache keys
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${JSON.stringify(params[key])}`)
    .join('|')
  
  return `${prefix}:${sortedParams}`
}

// Predefined cache time constants
export const CACHE_TIMES = {
  SHORT: 30 * 1000,        // 30 seconds
  MEDIUM: 5 * 60 * 1000,   // 5 minutes
  LONG: 15 * 60 * 1000,    // 15 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
  DISABLED: 0               // No caching
} as const

export type CacheTimePreset = keyof typeof CACHE_TIMES
