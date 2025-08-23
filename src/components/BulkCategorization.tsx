'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
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
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-500" />
            Bulk Receipt Categorization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {uncategorizedReceipts.length} uncategorized receipts found
              {suggestions.size > 0 && (
                <span className="ml-2 text-green-600">
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
              <Button onClick={handleGenerateSuggestions} disabled={processing}>
                {processing ? (
                  <>
                    <Brain className="w-4 h-4 mr-2 animate-pulse" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Suggestions
                  </>
                )}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={toggleSelectAll}
                  disabled={applying}
                >
                  {selectedReceipts.size === suggestions.size ? 'Deselect All' : 'Select All'}
                </Button>
                <Button 
                  onClick={handleApplySelected}
                  disabled={selectedReceipts.size === 0 || applying}
                >
                  {applying ? (
                    <>
                      <Zap className="w-4 h-4 mr-2 animate-pulse" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Apply Selected ({selectedReceipts.size})
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {(processing || applying) && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
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
          <h3 className="text-lg font-semibold">Suggested Categorizations</h3>
          
          {uncategorizedReceipts.map(receipt => {
            const receiptSuggestions = suggestions.get(receipt.id);
            if (!receiptSuggestions || receiptSuggestions.length === 0) return null;

            const topSuggestion = receiptSuggestions[0];
            const isSelected = selectedReceipts.has(receipt.id);

            return (
              <Card 
                key={receipt.id}
                className={`transition-all ${
                  isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <CardContent className="p-4">
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
                      
                      <div className="text-sm text-gray-600 truncate">
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {suggestions.size > 0 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={applying}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}