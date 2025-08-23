import React, { useEffect, lazy, Suspense } from 'react'
import PageHeader from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// Import LLM components directly
import { useLLMData } from './llm/hooks/useLLMData'
import { useLLMFilters } from './llm/hooks/useLLMFilters'
import { useLLMUI } from './llm/hooks/useLLMUI'
import { useLLMPagination } from './llm/hooks/useLLMPagination'
import { getUniqueProviders, getUniqueCompanies, getUniqueCapabilities } from './llm/utils'
import { GRADIENT_BACKGROUNDS, TAB_CONFIG } from './llm/constants'
import { ModelDetailModal } from './llm/components/ModelDetailModal'
import { HeaderControls } from './llm/components/HeaderControls'
import { ModelsList } from './llm/components/ModelsList'
import { ModelComparisonPanel } from './llm/components/ModelComparisonPanel'

// Lazy loaded chart components for better performance
const ChartsSection = lazy(() => import('./components/LLMChartsSection'))





export default function LLMModels() {
  // Use custom hooks for data, filters, and UI state
  const {
    models,
    stats,
    loading,
    refreshing,
    handleRefresh,
    handleDrillDown
  } = useLLMData()

  const {
    searchQuery,
    setSearchQuery,
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
    filteredModels
  } = useLLMFilters(models)

  const {
    activeTab,
    setActiveTab,
    showAnalytics,
    setShowAnalytics,
    selectedModel,
    handleModelSelect,
    handleModelDeselect,
    compareModels,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isCompareMode,
    toggleCompareMode
  } = useLLMUI()

  // Pagination for models list
  const {
    paginatedModels,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    resetPagination
  } = useLLMPagination({
    models: filteredModels,
    itemsPerPage: 50
  })

  // Reset pagination when filters change
  useEffect(() => {
    resetPagination()
  }, [filteredModels.length, resetPagination])

  // Computed values for filters and display
  const uniqueProviders = getUniqueProviders(models)
  const uniqueCompanies = getUniqueCompanies(models)
  const uniqueCapabilities = getUniqueCapabilities(models)

  // Main render
  return (
    <div className={cn(
      "min-h-screen relative",
      GRADIENT_BACKGROUNDS.primary
    )}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-300/10 dark:bg-violet-700/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/4 -left-40 w-96 h-96 bg-emerald-300/10 dark:bg-emerald-700/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-amber-300/10 dark:bg-amber-700/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute -bottom-32 left-1/3 w-80 h-80 bg-cyan-300/10 dark:bg-cyan-700/10 rounded-full blur-3xl animate-pulse delay-3000"></div>
      </div>

      <div className="relative z-10">
        <PageHeader
          title="LLM Models Analytics"
          description="Comprehensive analysis and comparison of Large Language Models with real-time insights"
        />

        <div className="container py-6 sm:py-10">
          {/* Header Controls */}
          <HeaderControls
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            providerFilter={providerFilter}
            setProviderFilter={setProviderFilter}
            companyFilter={companyFilter}
            setCompanyFilter={setCompanyFilter}
            capabilityFilter={capabilityFilter}
            setCapabilityFilter={setCapabilityFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            showAnalytics={showAnalytics}
            setShowAnalytics={setShowAnalytics}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            uniqueProviders={uniqueProviders}
            uniqueCompanies={uniqueCompanies}
            uniqueCapabilities={uniqueCapabilities}
            totalModels={totalItems}
          />

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value={TAB_CONFIG.overview}>Overview</TabsTrigger>
              <TabsTrigger value={TAB_CONFIG.analytics}>Analytics</TabsTrigger>
              <TabsTrigger value={TAB_CONFIG.comparison}>Comparison</TabsTrigger>
              <TabsTrigger value={TAB_CONFIG.timeline}>Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value={TAB_CONFIG.overview} className="mt-6">
              <ModelsList
                models={paginatedModels}
                loading={loading}
                onModelSelect={handleModelSelect}
                onModelCompare={addToCompare}
                compareModels={compareModels}
                isCompareMode={isCompareMode}
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={goToPage}
                showPagination={true}
              />
            </TabsContent>

            <TabsContent value={TAB_CONFIG.analytics} className="mt-6">
              {showAnalytics && (
                <Suspense fallback={<div>Loading charts...</div>}>
                  <ChartsSection models={models} stats={stats} onDrillDown={handleDrillDown} />
                </Suspense>
              )}
            </TabsContent>

            <TabsContent value={TAB_CONFIG.comparison} className="mt-6">
              <div className="w-full max-w-full">
                <ModelComparisonPanel
                  models={compareModels}
                  onRemoveModel={removeFromCompare}
                  onClearAll={clearCompare}
                />

                {/* Compare Mode Toggle */}
                {compareModels.length === 0 && (
                  <Card className="mt-6">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Model Selection</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={toggleCompareMode}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          >
                            {isCompareMode ? 'Exit Compare Mode' : 'Enable Compare Mode'}
                          </button>
                        </div>
                      </div>
                      <p className="text-muted-foreground">
                        {isCompareMode 
                          ? 'Select models from the Overview tab to add them to your comparison.'
                          : 'Enable compare mode to start selecting models for comparison.'
                        }
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value={TAB_CONFIG.timeline} className="mt-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Release Timeline</h3>
                  <p className="text-muted-foreground">Timeline feature coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Model Detail Modal */}
      <ModelDetailModal
        model={selectedModel}
        onClose={handleModelDeselect}
      />
    </div>
  )
}
