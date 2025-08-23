import { useState } from 'react'
import { LLMModel } from '../types'
import { TAB_CONFIG } from '../constants'

export function useLLMUI() {
  const [activeTab, setActiveTab] = useState(TAB_CONFIG.overview)
  const [showAnalytics, setShowAnalytics] = useState(true)
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null)
  const [compareModels, setCompareModels] = useState<LLMModel[]>([])
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [interactiveMode, setInteractiveMode] = useState(false)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['contextLength', 'pricing', 'performance'])
  const [customFilters, setCustomFilters] = useState<Record<string, any>>({})
  const [scenarioComparison, setScenarioComparison] = useState(false)
  const [realTimeUpdates, setRealTimeUpdates] = useState(false)
  const [analyticsAdvanced, setAnalyticsAdvanced] = useState(false)
  const [costsAdvanced, setCostsAdvanced] = useState(false)

  // Model selection
  const handleModelSelect = (model: LLMModel) => {
    setSelectedModel(model)
  }

  const handleModelDeselect = () => {
    setSelectedModel(null)
  }

  // Compare mode functions
  const addToCompare = (model: LLMModel) => {
    if (!compareModels.find(m => m.id === model.id)) {
      setCompareModels(prev => [...prev, model])
    }
  }

  const removeFromCompare = (modelId: string) => {
    setCompareModels(prev => prev.filter(m => m.id !== modelId))
  }

  const clearCompare = () => {
    setCompareModels([])
  }

  const toggleCompareMode = () => {
    setIsCompareMode(prev => !prev)
    if (isCompareMode) {
      clearCompare()
    }
  }

  // Tab management
  const switchTab = (tab: string) => {
    setActiveTab(tab)
  }

  // Analytics toggle
  const toggleAnalytics = () => {
    setShowAnalytics(prev => !prev)
  }

  // Interactive mode
  const toggleInteractiveMode = () => {
    setInteractiveMode(prev => !prev)
  }

  // Advanced view toggles
  const toggleAnalyticsAdvanced = () => {
    setAnalyticsAdvanced(prev => !prev)
  }

  const toggleCostsAdvanced = () => {
    setCostsAdvanced(prev => !prev)
  }

  return {
    activeTab,
    setActiveTab: switchTab,
    showAnalytics,
    setShowAnalytics: toggleAnalytics,
    selectedModel,
    handleModelSelect,
    handleModelDeselect,
    compareModels,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isCompareMode,
    toggleCompareMode,
    interactiveMode,
    toggleInteractiveMode,
    selectedMetrics,
    setSelectedMetrics,
    customFilters,
    setCustomFilters,
    scenarioComparison,
    setScenarioComparison,
    realTimeUpdates,
    setRealTimeUpdates,
    analyticsAdvanced,
    toggleAnalyticsAdvanced,
    costsAdvanced,
    toggleCostsAdvanced
  }
}
