import { useState, useMemo, useCallback } from 'react'
import { LLMModel, SortBy, SortOrder } from '../types'
import { DEFAULT_FILTERS, DEFAULT_SORT } from '../constants'

export function useLLMFilters(models: LLMModel[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState<string>(DEFAULT_FILTERS.provider)
  const [companyFilter, setCompanyFilter] = useState<string>(DEFAULT_FILTERS.company)
  const [capabilityFilter, setCapabilityFilter] = useState<string>(DEFAULT_FILTERS.capability)
  const [sortBy, setSortBy] = useState<SortBy>(DEFAULT_SORT.by)
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT.order)

  // Debounced search effect
  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Filtered and sorted models
  const filteredModels = useMemo(() => {
    let filtered = [...models]

    // Search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter(model =>
        model.name.toLowerCase().includes(query) ||
        model.provider.toLowerCase().includes(query) ||
        model.description?.toLowerCase().includes(query) ||
        model.capabilities?.some(cap => cap.toLowerCase().includes(query))
      )
    }

    // Provider filter
    if (providerFilter !== 'all') {
      filtered = filtered.filter(model => model.provider === providerFilter)
    }

    // Company filter
    if (companyFilter !== 'all') {
      filtered = filtered.filter(model => model.company === companyFilter)
    }

    // Capability filter
    if (capabilityFilter !== 'all') {
      filtered = filtered.filter(model =>
        model.capabilities?.includes(capabilityFilter)
      )
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'contextLength':
          aValue = a.contextLength || 0
          bValue = b.contextLength || 0
          break
        case 'inputPrice':
          aValue = a.pricing?.input || 0
          bValue = b.pricing?.input || 0
          break
        case 'outputPrice':
          aValue = a.pricing?.output || 0
          bValue = b.pricing?.output || 0
          break
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }

      if (sortOrder === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    return filtered
  }, [models, debouncedSearchQuery, providerFilter, companyFilter, capabilityFilter, sortBy, sortOrder])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setSearchQuery('')
    setDebouncedSearchQuery('')
    setProviderFilter(DEFAULT_FILTERS.provider)
    setCompanyFilter(DEFAULT_FILTERS.company)
    setCapabilityFilter(DEFAULT_FILTERS.capability)
    setSortBy(DEFAULT_SORT.by)
    setSortOrder(DEFAULT_SORT.order)
  }, [])

  // Toggle sort order
  const toggleSortOrder = useCallback(() => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }, [])

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    providerFilter,
    setProviderFilter,
    companyFilter,
    setCompanyFilter,
    capabilityFilter,
    setCapabilityFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    filteredModels,
    resetFilters,
    toggleSortOrder
  }
}
