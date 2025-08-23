'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
import { useIsMobile } from '@/hooks/use-mobile';
import { SmartCategorizationService, type CategorySuggestion } from '@/services/SmartCategorizationService';
import {
  Brain,
  Sparkles,
  Check,
  X,
  ArrowRight,
  Zap,
  Target,
  TrendingUp,
  Clock
} from 'lucide-react';

interface BulkCategorizationProps {
  uncategorizedReceipts: Receipt[];
  onClose: () => void;
  className?: string;
}

export function BulkCategorization({
  uncategorizedReceipts,
  onClose,
  className
}: BulkCategorizationProps) {
  const isMobile = useIsMobile();
  const [suggestions, setSuggestions] = useState<Map<string, CategorySuggestion[]>>(new Map());
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);

  const { receipts, updateReceipt } = useReceipts();
  const { toast } = useToast();

  const handleGenerateSuggestions = async () => {
    setProcessing(true);
    setProgress(0);

    try {
      const service = new SmartCategorizationService(receipts);
      const bulkSuggestions = service.getBulkCategorySuggestions(uncategorizedReceipts);
      setSuggestions(bulkSuggestions);
      
      // Auto-select receipts with high-confidence suggestions
      const highConfidenceReceipts = new Set<string>();
      bulkSuggestions.forEach((suggestions, receiptId) => {
        if (suggestions.length > 0 && suggestions[0].confidence >= 0.7) {
          highConfidenceReceipts.add(receiptId);
        }
      });
      setSelectedReceipts(highConfidenceReceipts);

      toast({
        title: "Suggestions Generated",
        description: `Generated suggestions for ${bulkSuggestions.size} receipts`,
      });
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast({
        title: "Error",
        description: "Failed to generate suggestions",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const handleApplySelected = async () => {
    if (selectedReceipts.size === 0) return;

    setApplying(true);
    setProgress(0);

    try {
      const selectedReceiptsList = Array.from(selectedReceipts);
      let completed = 0;

      for (const receiptId of selectedReceiptsList) {
        const receiptSuggestions = suggestions.get(receiptId);
        if (receiptSuggestions && receiptSuggestions.length > 0) {
          const topSuggestion = receiptSuggestions[0];
          const receipt = uncategorizedReceipts.find(r => r.id === receiptId);
          
          if (receipt) {
            await updateReceipt(receiptId, {
              ...receipt,
              category: topSuggestion.category
            });
          }
        }
        
        completed++;
        setProgress((completed / selectedReceiptsList.length) * 100);
        
        // Small delay to prevent overwhelming the API
        if (completed % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      toast({
        title: "Categorization Complete",
        description: `Successfully categorized ${completed} receipts`,
      });

      onClose();
    } catch (error) {
      console.error('Error applying categorizations:', error);
      toast({
        title: "Error",
        description: "Failed to apply some categorizations",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
      setProgress(0);
    }
  };

  const toggleReceiptSelection = (receiptId: string) => {
    const newSelected = new Set(selectedReceipts);
    if (newSelected.has(receiptId)) {
      newSelected.delete(receiptId);
    } else {
      newSelected.add(receiptId);
    }
    setSelectedReceipts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedReceipts.size === suggestions.size) {
      setSelectedReceipts(new Set());
    } else {
      setSelectedReceipts(new Set(suggestions.keys()));
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-blue-500';
    if (confidence >= 0.4) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <Target className="w-3 h-3" />;
    if (confidence >= 0.6) return <TrendingUp className="w-3 h-3" />;
    return <Clock className="w-3 h-3" />;
  };

  const formatCategoryName = (category: string) => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const highConfidenceCount = Array.from(suggestions.values()).filter(
    suggestions => suggestions.length > 0 && suggestions[0].confidence >= 0.7
  ).length;

  return (
    <div className={`space-y-4 sm:space-y-6 ${className}`}>
      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Brain className="w-5 h-5 text-info" />
            {isMobile ? 'Bulk Categorization' : 'Bulk Receipt Categorization'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs sm:text-sm text-muted-foreground">
              {uncategorizedReceipts.length} uncategorized receipts found
              {suggestions.size > 0 && (
                <span className="block sm:inline ml-0 sm:ml-2 text-success">
                  • {suggestions.size} with suggestions
                  {highConfidenceCount > 0 && (
                    <span className="ml-1">
                      ({highConfidenceCount} high confidence)
                    </span>
                  )}
                </span>
              )}
            </div>
            
            {suggestions.size === 0 ? (
              <Button 
                onClick={handleGenerateSuggestions} 
                disabled={processing}
                className="w-full sm:w-auto"
                size={isMobile ? "default" : "default"}
              >
                {processing ? (
                  <>
                    <Brain className="w-4 h-4 mr-2 animate-pulse" />
                    {isMobile ? 'Analyzing...' : 'Analyzing...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {isMobile ? 'Generate' : 'Generate Suggestions'}
                  </>
                )}
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  onClick={toggleSelectAll}
                  disabled={applying}
                  className="w-full sm:w-auto"
                  size={isMobile ? "sm" : "default"}
                >
                  {selectedReceipts.size === suggestions.size ? 
                    (isMobile ? 'Deselect' : 'Deselect All') : 
                    (isMobile ? 'Select' : 'Select All')
                  }
                </Button>
                <Button 
                  onClick={handleApplySelected}
                  disabled={selectedReceipts.size === 0 || applying}
                  className="w-full sm:w-auto"
                  size={isMobile ? "default" : "default"}
                >
                  {applying ? (
                    <>
                      <Zap className="w-4 h-4 mr-2 animate-pulse" />
                      {isMobile ? 'Applying...' : 'Applying...'}
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {isMobile ? 
                        `Apply (${selectedReceipts.size})` : 
                        `Apply Selected (${selectedReceipts.size})`
                      }
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {(processing || applying) && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs sm:text-sm">
                <span>{processing ? 'Generating suggestions...' : 'Applying categorizations...'}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {suggestions.size > 0 && (
        <div className="space-y-3">
          <h3 className="text-base sm:text-lg font-semibold">Suggested Categorizations</h3>
          
          {uncategorizedReceipts.map(receipt => {
            const receiptSuggestions = suggestions.get(receipt.id);
            if (!receiptSuggestions || receiptSuggestions.length === 0) return null;

            const topSuggestion = receiptSuggestions[0];
            const isSelected = selectedReceipts.has(receipt.id);

            return (
              <Card 
                key={receipt.id}
                className={`transition-all ${
                  isSelected ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-muted/50'
                }`}
              >
                <CardContent className="p-3 sm:p-4">
                  {isMobile ? (
                    // Mobile: Vertical layout
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleReceiptSelection(receipt.id)}
                          disabled={applying}
                          className="mt-1 flex-shrink-0"
                        />
                        
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{receipt.name}</span>
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              ${receipt.total_amount.toFixed(2)}
                            </Badge>
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            {receipt.merchant_name && (
                              <span className="block truncate">{receipt.merchant_name}</span>
                            )}
                            <span>{new Date(receipt.receipt_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pl-8">
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        
                        <div className="flex items-center gap-2">
                          {getConfidenceIcon(topSuggestion.confidence)}
                          <span className="font-medium text-sm">
                            {formatCategoryName(topSuggestion.category)}
                          </span>
                          <div className="flex items-center gap-1">
                            <div 
                              className={`w-2 h-2 rounded-full ${getConfidenceColor(topSuggestion.confidence)}`}
                            />
                            <span className="text-xs text-muted-foreground">
                              {Math.round(topSuggestion.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground pl-8">
                        {topSuggestion.reason}
                      </div>
                    </div>
                  ) : (
                    // Desktop: Horizontal layout
                    <>
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleReceiptSelection(receipt.id)}
                          disabled={applying}
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{receipt.name}</span>
                            <Badge variant="outline" className="text-xs">
                              ${receipt.total_amount.toFixed(2)}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-muted-foreground truncate">
                            {receipt.merchant_name && (
                              <span>{receipt.merchant_name} • </span>
                            )}
                            <span>{new Date(receipt.receipt_date).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getConfidenceIcon(topSuggestion.confidence)}
                          <span className="font-medium">
                            {formatCategoryName(topSuggestion.category)}
                          </span>
                          <div className="flex items-center gap-1">
                            <div 
                              className={`w-2 h-2 rounded-full ${getConfidenceColor(topSuggestion.confidence)}`}
                            />
                            <span className="text-xs text-gray-500">
                              {Math.round(topSuggestion.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2 ml-6 text-xs text-gray-500">
                        {topSuggestion.reason}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {suggestions.size > 0 && (
        <div className="flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={applying}
            className="w-full sm:w-auto"
            size={isMobile ? "default" : "default"}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}