import { useState, useMemo } from 'react'
import { LLMModel } from '../types'

interface UseLLMPaginationProps {
  models: LLMModel[]
  itemsPerPage?: number
  initialPage?: number
}

export function useLLMPagination({
  models,
  itemsPerPage = 50,
  initialPage = 1
}: UseLLMPaginationProps) {
  const [currentPage, setCurrentPage] = useState(initialPage)

  // Calculate pagination data
  const paginationData = useMemo(() => {
    const totalItems = models.length
    const totalPages = Math.ceil(totalItems / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedModels = models.slice(startIndex, endIndex)

    return {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage,
      paginatedModels,
      startIndex,
      endIndex,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1
    }
  }, [models, currentPage, itemsPerPage])

  // Navigation functions
  const goToPage = (page: number) => {
    if (page >= 1 && page <= paginationData.totalPages) {
      setCurrentPage(page)
    }
  }

  const goToNextPage = () => {
    if (paginationData.hasNextPage) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const goToPreviousPage = () => {
    if (paginationData.hasPreviousPage) {
      setCurrentPage(prev => prev - 1)
    }
  }

  const goToFirstPage = () => {
    setCurrentPage(1)
  }

  const goToLastPage = () => {
    setCurrentPage(paginationData.totalPages)
  }

  // Reset to first page when models change
  const resetPagination = () => {
    setCurrentPage(1)
  }

  return {
    ...paginationData,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    resetPagination
  }
}
