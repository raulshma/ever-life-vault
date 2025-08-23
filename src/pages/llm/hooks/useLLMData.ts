import { useState, useCallback, useEffect } from 'react'
import { fetchWithAuth } from '@/lib/aggregatorClient'
import { LLMModel, LLMStats, DrillDownFilter } from '../types'
import { CACHE_CONFIG } from '../constants'

export function useLLMData() {
  const [models, setModels] = useState<LLMModel[]>([])
  const [stats, setStats] = useState<LLMStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [drillDownModels, setDrillDownModels] = useState<LLMModel[]>([])
  const [drillDownFilter, setDrillDownFilter] = useState<DrillDownFilter | null>(null)

  // Fetch models with caching
  const fetchModels = useCallback(async (forceRefresh = false) => {
    const now = Date.now()

    // Check cache unless force refresh
    if (!forceRefresh) {
      const cached = localStorage.getItem(CACHE_CONFIG.key)
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        if (now - timestamp < CACHE_CONFIG.duration) {
          setModels(data)
          return
        }
      }
    }

    setLoading(true)
    try {
      const response = await fetchWithAuth('/api/llm/models' + (forceRefresh ? '?forceRefresh=true' : ''))
      if (!response.ok) throw new Error('Failed to fetch models')
      const data = await response.json()

      if (data.success) {
        setModels(data.data)
        localStorage.setItem(CACHE_CONFIG.key, JSON.stringify({
          data: data.data,
          timestamp: now
        }))
      }
    } catch (error) {
      console.error('Error fetching LLM models:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/llm/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error fetching LLM stats:', error)
    }
  }, [])

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchModels(true)
    await fetchStats()
    setRefreshing(false)
  }, [fetchModels, fetchStats])

  // Drill-down filtering
  const handleDrillDown = useCallback(async (filter: DrillDownFilter) => {
    setDrillDownFilter(filter)

    try {
      const queryParams = new URLSearchParams()

      switch (filter.type) {
        case 'provider': {
          queryParams.append('providers', filter.value as string)
          break
        }
        case 'capability': {
          queryParams.append('capabilities', filter.value as string)
          break
        }
        case 'contextRange': {
          const contextRange = filter.value as { min: number; max: number }
          queryParams.append('minContext', contextRange.min.toString())
          queryParams.append('maxContext', contextRange.max.toString())
          break
        }
        case 'pricingRange': {
          const pricingRange = filter.value as { min: number; max: number }
          queryParams.append('minPrice', pricingRange.min.toString())
          queryParams.append('maxPrice', pricingRange.max.toString())
          break
        }
        case 'quality': {
          queryParams.append('quality', filter.value as string)
          break
        }
        case 'availability': {
          queryParams.append('available', filter.value as string)
          break
        }
      }

      const response = await fetchWithAuth(`/api/llm/filter?${queryParams}`)
      if (!response.ok) throw new Error('Failed to fetch filtered models')
      const data = await response.json()

      if (data.success) {
        setDrillDownModels(data.data)
      }
    } catch (error) {
      console.error('Error fetching filtered models:', error)
    }
  }, [])

  // Clear drill-down
  const clearDrillDown = useCallback(() => {
    setDrillDownFilter(null)
    setDrillDownModels([])
  }, [])

  // Initial data loading
  useEffect(() => {
    fetchModels()
    fetchStats()
  }, [fetchModels, fetchStats])

  return {
    models,
    stats,
    loading,
    refreshing,
    drillDownModels,
    drillDownFilter,
    fetchModels,
    fetchStats,
    handleRefresh,
    handleDrillDown,
    clearDrillDown
  }
}
