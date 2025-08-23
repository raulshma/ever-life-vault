import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Brain, MessageSquare, DollarSign, Star, Plus } from 'lucide-react'
import { LLMModel } from '../types'
import { PROVIDER_COLORS, CAPABILITY_COLORS, QUALITY_ICONS, GRADIENT_BACKGROUNDS } from '../constants'
import { getModelQualityScore, formatContextLength } from '../utils'
import { PaginationControls } from './PaginationControls'

interface ModelsListProps {
  models: LLMModel[]
  loading: boolean
  onModelSelect: (model: LLMModel) => void
  onModelCompare: (model: LLMModel) => void
  compareModels: LLMModel[]
  isCompareMode: boolean
  // Pagination props
  currentPage?: number
  totalPages?: number
  totalItems?: number
  itemsPerPage?: number
  onPageChange?: (page: number) => void
  onItemsPerPageChange?: (itemsPerPage: number) => void
  showPagination?: boolean
}

export function ModelsList({
  models,
  loading,
  onModelSelect,
  onModelCompare,
  compareModels,
  isCompareMode,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 50,
  onPageChange,
  onItemsPerPageChange,
  showPagination = true
}: ModelsListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-64">
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map(model => {
          const qualityScore = getModelQualityScore(model)
          const isSelected = compareModels.some(m => m.id === model.id)

          return (
            <Card
              key={model.id}
              className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg cursor-pointer ${
                isCompareMode && isSelected ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => onModelSelect(model)}
            >
              {/* Quality indicator */}
              <div className="absolute top-3 right-3">
                {React.createElement(QUALITY_ICONS.premium, {
                  className: "h-5 w-5 text-amber-500"
                })}
              </div>

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold line-clamp-1">
                      {model.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        className="text-xs px-2 py-0.5"
                        style={{
                          backgroundColor: `${PROVIDER_COLORS[model.provider]}20`,
                          color: PROVIDER_COLORS[model.provider]
                        }}
                      >
                        {model.provider}
                      </Badge>
                      {model.company && (
                        <Badge variant="outline" className="text-xs">
                          {model.company}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {model.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {model.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {model.contextLength && (
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-3 w-3 text-blue-500" />
                      <span className="font-medium">
                        {formatContextLength(model.contextLength)}
                      </span>
                    </div>
                  )}

                  {model.pricing?.input && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-3 w-3 text-green-500" />
                      <span className="font-medium">
                        ${(model.pricing.input * 1000000).toFixed(2)}/M
                      </span>
                    </div>
                  )}
                </div>

                {model.capabilities && model.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {model.capabilities.slice(0, 3).map(capability => (
                      <Badge
                        key={capability}
                        variant="secondary"
                        className="text-xs px-2 py-0.5"
                        style={{
                          backgroundColor: `${CAPABILITY_COLORS[capability]}15`,
                          color: CAPABILITY_COLORS[capability]
                        }}
                      >
                        {capability.replace('_', ' ')}
                      </Badge>
                    ))}
                    {model.capabilities.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{model.capabilities.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-500 fill-current" />
                    <span className="text-xs text-muted-foreground">
                      {qualityScore}% quality
                    </span>
                  </div>

                  {isCompareMode && (
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onModelCompare(model)
                      }}
                      className="h-7 px-2"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Pagination Controls */}
      {showPagination && !loading && models.length > 0 && totalPages > 1 && (
        <div className="mt-6">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={onPageChange || (() => {})}
            onItemsPerPageChange={onItemsPerPageChange}
            className="justify-center"
          />
        </div>
      )}
    </div>
  )
}
