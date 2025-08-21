import { useCallback, useRef } from 'react'
import type { BaseWidgetConfig } from '../types'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface CacheOptions {
  cacheTimeMs?: number
  key?: string
}

// Global cache singleton that persists across component lifecycle changes
// Minimal IndexedDB store wrapper for persistent cache
class IndexedDBCacheStore {
  private db: IDBDatabase | null = null
  private readonly dbName = 'ELV_WidgetApiCache'
  private readonly storeName = 'cache'

  async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') return
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' })
        }
      }
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
    })
  }

  close(): void {
    try { this.db?.close() } catch {}
  }

  async put<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.db) return
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.put({ key, ...entry })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error || new Error('IndexedDB put failed'))
    })
  }

  async delete(key: string): Promise<void> {
    if (!this.db) return
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error || new Error('IndexedDB delete failed'))
    })
  }

  async clear(): Promise<void> {
    if (!this.db) return
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite')
      const store = tx.objectStore(this.storeName)
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error || new Error('IndexedDB clear failed'))
    })
  }

  async getAllEntries<T>(): Promise<Array<{ key: string; entry: CacheEntry<T> }>> {
    if (!this.db) return []
    return await new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      const request = store.getAll()
      request.onsuccess = () => {
        const rows = (request.result || []) as Array<any>
        resolve(rows.map((row) => ({ key: row.key as string, entry: { data: row.data, timestamp: row.timestamp, ttl: row.ttl } }))
      )}
      request.onerror = () => reject(request.error || new Error('IndexedDB getAll failed'))
    })
  }

  async getByKey<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) return null
    return await new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly')
      const store = tx.objectStore(this.storeName)
      const request = store.get(key)
      request.onsuccess = () => {
        const row = request.result as any
        if (!row) { resolve(null); return }
        resolve({ data: row.data as T, timestamp: row.timestamp as number, ttl: row.ttl as number })
      }
      request.onerror = () => reject(request.error || new Error('IndexedDB get failed'))
    })
  }

  async cleanupExpired(now: number): Promise<void> {
    if (!this.db) return
    try {
      const all = await this.getAllEntries<any>()
      const expiredKeys = all.filter(({ entry }) => now - entry.timestamp > entry.ttl).map(({ key }) => key)
      if (expiredKeys.length === 0) return
      await Promise.all(expiredKeys.map((k) => this.delete(k)))
    } catch {}
  }
}

class GlobalCache {
  private cache = new Map<string, CacheEntry<any>>()
  private cleanupInterval: number | null = null
  private store: IndexedDBCacheStore | null = null
  private preloaded = false

  constructor() {
    // Set up periodic cleanup of expired entries
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupExpired()
    }, 60000) // Clean up every minute

    // Attempt to initialize IndexedDB store and preload existing cache
    try {
      if (typeof window !== 'undefined' && 'indexedDB' in window) {
        this.store = new IndexedDBCacheStore()
        void this.store.init().then(async () => {
          try {
            const now = Date.now()
            const rows = await this.store!.getAllEntries<any>()
            let loaded = 0
            for (const { key, entry } of rows) {
              if (now - entry.timestamp <= entry.ttl) {
                this.cache.set(key, entry)
                loaded++
              } else {
                // Drop expired entries from persistent store
                void this.store!.delete(key)
              }
            }
            this.preloaded = true
            console.log(`[GlobalCache] Preloaded ${loaded} entries from IndexedDB`)
          } catch (e) {
            console.warn('[GlobalCache] Failed to preload from IndexedDB:', e)
          }
        })
      }
    } catch (e) {
      console.warn('[GlobalCache] IndexedDB not available, falling back to in-memory only')
    }
  }

  private cleanupExpired() {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
    // Best-effort cleanup in persistent store
    void this.store?.cleanupExpired(now)
  }

  get<T>(key: string, cacheTimeMs?: number): T | null {
    console.log(`[GlobalCache] get() called with key: ${key}, cacheTimeMs: ${cacheTimeMs}`)
    
    if (!cacheTimeMs) {
      console.log(`[GlobalCache] No cache time provided, returning null`)
      return null // No caching
    }
    
    const entry = this.cache.get(key)
    if (!entry) {
      console.log(`[GlobalCache] Cache miss for key: ${key}`)
      return null
    }
    
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      // Cache expired, remove it
      console.log(`[GlobalCache] Cache expired for key: ${key}, age: ${now - entry.timestamp}ms, ttl: ${entry.ttl}ms`)
      this.cache.delete(key)
      return null
    }
    
    const age = now - entry.timestamp
    console.log(`[GlobalCache] Cache hit for key: ${key}, age: ${age}ms, ttl: ${entry.ttl}ms`)
    return entry.data
  }

  async getAsync<T>(key: string, cacheTimeMs?: number): Promise<T | null> {
    // Fast path: in-memory
    const inMem = this.get<T>(key, cacheTimeMs)
    if (inMem !== null) return inMem
    if (!cacheTimeMs) return null
    if (!this.store) return null
    try {
      const row = await this.store.getByKey<T>(key)
      if (!row) return null
      const now = Date.now()
      if (now - row.timestamp > row.ttl) {
        void this.store.delete(key)
        return null
      }
      // hydrate in-memory for subsequent fast hits
      this.cache.set(key, row)
      return row.data
    } catch {
      return null
    }
  }

  set<T>(key: string, data: T, cacheTimeMs?: number): void {
    console.log(`[GlobalCache] set() called with key: ${key}, cacheTimeMs: ${cacheTimeMs}`)
    
    if (!cacheTimeMs) {
      console.log(`[GlobalCache] No cache time provided, not caching`)
      return // No caching
    }
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: cacheTimeMs
    }
    
    this.cache.set(key, entry)
    console.log(`[GlobalCache] Cached data for key: ${key}, ttl: ${cacheTimeMs}ms, cache size: ${this.cache.size}`)

    // Write-through to IndexedDB if available
    if (this.store) {
      void this.store.put(key, entry).catch((e) => console.warn('[GlobalCache] Failed to persist cache entry:', e))
    }
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key)
      if (this.store) { void this.store.delete(key).catch(() => {}) }
    } else {
      this.cache.clear()
      if (this.store) { void this.store.clear().catch(() => {}) }
    }
  }

  isExpired(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return true
    
    const now = Date.now()
    return now - entry.timestamp > entry.ttl
  }

  getInfo(key: string): { exists: boolean; age: number; ttl: number; expired: boolean } | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    const now = Date.now()
    const age = now - entry.timestamp
    
    return {
      exists: true,
      age,
      ttl: entry.ttl,
      expired: age > entry.ttl
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  // Debug method to log cache state
  debug(): void {
    const stats = this.getStats()
    console.log(`[GlobalCache] Cache state:`, stats)
    
    for (const [key, entry] of this.cache.entries()) {
      const age = Date.now() - entry.timestamp
      const remaining = entry.ttl - age
      console.log(`[GlobalCache] Entry: ${key}`, { age: `${Math.round(age/1000)}s`, remaining: `${Math.round(remaining/1000)}s`, ttl: `${Math.round(entry.ttl/1000)}s` })
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      window.clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.cache.clear()
    try { this.store?.close() } catch {}
  }
}

// Create global cache instance
const globalCache = new GlobalCache()

// Add a flag to track if the cache has been initialized
let cacheInitialized = false

export function useApiCache<T>() {
  // Check if this is the first time the hook is being used
  if (!cacheInitialized) {
    console.log('[GlobalCache] First use of useApiCache hook, cache initialized')
    cacheInitialized = true
  }
  
  // Use useRef to store the functions so they don't change on every render
  const functionsRef = useRef({
    getCached: (key: string, cacheTimeMs?: number): T | null => {
      if (!cacheTimeMs) {
        // Try to get default cache time from registry if available
        try {
          const registry = (window as any).__WIDGET_REGISTRY__
          if (registry) {
            // This is a fallback for when widgets don't have cache settings yet
            console.log('[Cache] No cache time provided, checking registry for defaults...')
          }
        } catch {}
        return null // No caching
      }
      
      return globalCache.get<T>(key, cacheTimeMs)
    },
    getCachedAsync: async (key: string, cacheTimeMs?: number): Promise<T | null> => {
      return await globalCache.getAsync<T>(key, cacheTimeMs)
    },
    setCached: (key: string, data: T, cacheTimeMs?: number): void => {
      if (!cacheTimeMs) return // No caching
      
      globalCache.set(key, data, cacheTimeMs)
    },
    clearCache: (key?: string): void => {
      globalCache.clear(key)
    },
    isExpired: (key: string): boolean => {
      return globalCache.isExpired(key)
    },
    getCacheInfo: (key: string): { exists: boolean; age: number; ttl: number; expired: boolean } | null => {
      return globalCache.getInfo(key)
    },
    debug: () => globalCache.debug() // Add debug method to the ref
  })

  return functionsRef.current
}

// Export the global cache instance for debugging
export { globalCache }

// Helper function to generate cache keys
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  try {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => {
        try {
          return `${key}:${JSON.stringify(params[key])}`
        } catch (error) {
          console.warn(`[Cache] Failed to stringify param ${key}:`, error)
          return `${key}:<error>`
        }
      })
      .join('|')
    
    const cacheKey = `${prefix}:${sortedParams}`
    console.log(`[Cache] Generated cache key: ${cacheKey}`, { prefix, params })
    return cacheKey
  } catch (error) {
    console.error(`[Cache] Failed to generate cache key:`, error)
    // Fallback to a simple key
    return `${prefix}:fallback-${Date.now()}`
  }
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

// Helper function to get effective cache time for a widget
export function getEffectiveCacheTime<T extends BaseWidgetConfig>(
  config: T, 
  widgetType: string, 
  registry: any
): number | undefined {
  try {
    console.log(`[Cache] getEffectiveCacheTime called with:`, { widgetType, configCacheTime: config?.cacheTimeMs, registryExists: !!registry })
    
    // If config has cache time, use it
    if (config?.cacheTimeMs !== undefined) {
      console.log(`[Cache] Using config cache time: ${config.cacheTimeMs}ms`)
      return config.cacheTimeMs
    }
    
    // Otherwise, try to get default from registry
    try {
      if (!registry || typeof registry.get !== 'function') {
        console.log(`[Cache] Registry is not available or invalid`)
        return undefined
      }
      
      const def = registry.get(widgetType)
      console.log(`[Cache] Registry lookup for ${widgetType}:`, { def: def ? { usesExternalApis: def.usesExternalApis, defaultCacheTimeMs: def.defaultCacheTimeMs } : null })
      if (def?.usesExternalApis && def?.defaultCacheTimeMs) {
        console.log(`[Cache] Using registry default cache time: ${def.defaultCacheTimeMs}ms`)
        return def.defaultCacheTimeMs
      }
    } catch (error) {
      console.log(`[Cache] Registry lookup failed:`, error)
    }
    
    // Fallback: try to infer widget type from config structure if registry lookup failed
    try {
      if (config && typeof config === 'object') {
        let inferredType: string | null = null
        
        // Check for location-based widgets
        if ('lat' in config && 'lon' in config) {
          if ('scale' in config && config.scale === 'us') {
            inferredType = 'air-quality'
          } else if ('units' in config && config.units === 'kmh') {
            inferredType = 'wind-focus'
          } else if ('mode' in config && config.mode === 'official') {
            inferredType = 'sun-phases'
          }
        }
        
        if (inferredType) {
          console.log(`[Cache] Inferred widget type from config: ${inferredType}`)
          const def = registry?.get?.(inferredType)
          if (def?.usesExternalApis && def?.defaultCacheTimeMs) {
            console.log(`[Cache] Using inferred cache time: ${def.defaultCacheTimeMs}ms`)
            return def.defaultCacheTimeMs
          }
        }
      }
    } catch (error) {
      console.log(`[Cache] Fallback inference failed:`, error)
    }
    
    console.log(`[Cache] No cache time found, returning undefined`)
    return undefined
  } catch (error) {
    console.error(`[Cache] getEffectiveCacheTime failed:`, error)
    return undefined
  }
}

/**
 * Batch multiple API calls for better performance
 * This utility helps widgets make multiple API calls in parallel
 */
export function useBatchApiCalls() {
  const { getCached, getCachedAsync, setCached } = useApiCache()

  /**
   * Execute multiple API calls in parallel with caching
   */
  const batchApiCalls = useCallback(async <T extends Record<string, any>>(
    calls: Array<{
      key: string
      cacheKey: string
      cacheTimeMs: number
      apiCall: () => Promise<any>
    }>
  ): Promise<T> => {
    // Check cache first for all calls
    const cacheResults = await Promise.all(
      calls.map(async (call) => {
        const cached = await getCachedAsync(call.cacheKey, call.cacheTimeMs)
        return { ...call, cached, needsFetch: !cached }
      })
    )

    // Filter calls that need fresh data
    const callsNeedingFetch = cacheResults.filter(call => call.needsFetch)

    // Execute API calls in parallel for those that need fresh data
    let freshResults: Array<{ key: string; data: any }> = []
    if (callsNeedingFetch.length > 0) {
      const apiResults = await Promise.all(
        callsNeedingFetch.map(async (call) => {
          try {
            const data = await call.apiCall()
            // Cache the fresh result
            setCached(call.cacheKey, data, call.cacheTimeMs)
            return { key: call.key, data }
          } catch (error) {
            console.error(`API call failed for ${call.key}:`, error)
            return { key: call.key, data: null }
          }
        })
      )
      freshResults = apiResults.filter(result => result.data !== null)
    }

    // Combine cached and fresh results
    const combined = {} as T
    cacheResults.forEach(call => {
      if (call.cached) {
        ;(combined as any)[call.key] = call.cached
      }
    })
    freshResults.forEach(result => {
      ;(combined as any)[result.key] = result.data
    })

    return combined
  }, [getCached, getCachedAsync, setCached])

  return { batchApiCalls }
}
