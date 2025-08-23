import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, RefreshCw, BarChart3, Grid3X3, Settings } from 'lucide-react'
import { LLMModel, SortBy, SortOrder } from '../types'
import { GRADIENT_BACKGROUNDS } from '../constants'

interface HeaderControlsProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  providerFilter: string
  setProviderFilter: (provider: string) => void
  companyFilter: string
  setCompanyFilter: (company: string) => void
  capabilityFilter: string
  setCapabilityFilter: (capability: string) => void
  sortBy: SortBy
  setSortBy: (sortBy: SortBy) => void
  sortOrder: SortOrder
  setSortOrder: (sortOrder: SortOrder) => void
  showAnalytics: boolean
  setShowAnalytics: (show: boolean) => void
  refreshing: boolean
  onRefresh: () => void
  uniqueProviders: string[]
  uniqueCompanies: string[]
  uniqueCapabilities: string[]
  totalModels: number
}

export function HeaderControls({
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
  showAnalytics,
  setShowAnalytics,
  refreshing,
  onRefresh,
  uniqueProviders,
  uniqueCompanies,
  uniqueCapabilities,
  totalModels
}: HeaderControlsProps) {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search models by name, provider, or capabilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1">
              {totalModels} Models
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant={showAnalytics ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Provider</label>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {uniqueProviders.map(provider => (
                  <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Company</label>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {uniqueCompanies.map(company => (
                  <SelectItem key={company} value={company}>{company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Capability</label>
            <Select value={capabilityFilter} onValueChange={setCapabilityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Capabilities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Capabilities</SelectItem>
                {uniqueCapabilities.map(capability => (
                  <SelectItem key={capability} value={capability}>
                    {capability.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Sort By</label>
            <div className="flex gap-1">
              <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="contextLength">Context Length</SelectItem>
                  <SelectItem value="inputPrice">Input Price</SelectItem>
                  <SelectItem value="outputPrice">Output Price</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-2"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
