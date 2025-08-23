'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useReceipts } from '@/hooks/useReceipts';
import { SmartCategorizationService, type CategorySuggestion } from '@/services/SmartCategorizationService';
import {
  Brain,
  Sparkles,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Clock,
  Target
} from 'lucide-react';

interface CategorySuggestionsProps {
  receiptData: {
    merchant_name?: string;
    total_amount: number;
    receipt_date: string;
    description?: string;
  };
  currentCategory: string;
  onCategorySelect: (category: string) => void;
  onLearnFromCorrection?: (suggestedCategory: string, actualCategory: string) => void;
  className?: string;
}

export function CategorySuggestions({
  receiptData,
  currentCategory,
  onCategorySelect,
  onLearnFromCorrection,
  className
}: CategorySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [categorizationService, setCategorizationService] = useState<SmartCategorizationService | null>(null);
  const [lastSuggestion, setLastSuggestion] = useState<string | null>(null);

  const { receipts } = useReceipts();

  // Initialize categorization service when receipts are loaded
  useEffect(() => {
    if (receipts.length > 0) {
      const service = new SmartCategorizationService(receipts);
      setCategorizationService(service);
    }
  }, [receipts]);

  // Generate suggestions when receipt data changes
  useEffect(() => {
    if (categorizationService && receiptData.merchant_name && receiptData.total_amount > 0) {
      setLoading(true);
      
      try {
        const newSuggestions = categorizationService.getCategorySuggestions(receiptData);
        setSuggestions(newSuggestions);
      } catch (error) {
        console.error('Error generating category suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    } else {
      setSuggestions([]);
    }
  }, [categorizationService, receiptData.merchant_name, receiptData.total_amount, receiptData.receipt_date]);

  // Track when user selects a different category than suggested (for learning)
  useEffect(() => {
    if (suggestions.length > 0 && currentCategory && currentCategory !== 'other') {
      const topSuggestion = suggestions[0];
      if (topSuggestion && topSuggestion.category !== currentCategory && lastSuggestion !== topSuggestion.category) {
        setLastSuggestion(topSuggestion.category);
        if (onLearnFromCorrection) {
          onLearnFromCorrection(topSuggestion.category, currentCategory);
        }
      }
    }
  }, [currentCategory, suggestions, lastSuggestion, onLearnFromCorrection]);

  const handleSuggestionClick = (suggestion: CategorySuggestion) => {
    onCategorySelect(suggestion.category);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 border-green-200';
    if (confidence >= 0.6) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (confidence >= 0.4) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
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

  if (!categorizationService || (!receiptData.merchant_name && !receiptData.description)) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium text-gray-700">Smart Category Suggestions</span>
        {loading && <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" />}
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Brain className="w-4 h-4 animate-pulse" />
              <span>Analyzing receipt patterns...</span>
            </div>
          </CardContent>
        </Card>
      ) : suggestions.length > 0 ? (
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <Card 
              key={suggestion.category}
              className={`cursor-pointer transition-all hover:shadow-md ${
                suggestion.category === currentCategory 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-2">
                      {getConfidenceIcon(suggestion.confidence)}
                      <span className="font-medium text-sm">
                        {formatCategoryName(suggestion.category)}
                      </span>
                      {suggestion.subcategory && (
                        <Badge variant="outline" className="text-xs">
                          {formatCategoryName(suggestion.subcategory)}
                        </Badge>
                      )}
                    </div>
                    
                    {suggestion.category === currentCategory && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}
                    >
                      {Math.round(suggestion.confidence * 100)}%
                    </Badge>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                  </div>
                </div>
                
                <div className="mt-1 text-xs text-gray-500">
                  {suggestion.reason}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {suggestions.length > 0 && (
            <Alert>
              <Sparkles className="w-4 h-4" />
              <AlertDescription className="text-xs">
                These suggestions are based on your spending patterns and merchant history. 
                Your selections help improve future suggestions.
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : receiptData.merchant_name ? (
        <Card>
          <CardContent className="p-3">
            <div className="text-sm text-gray-500 text-center">
              No automatic suggestions available for this merchant.
              <br />
              <span className="text-xs">Your categorization will help improve future suggestions.</span>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

interface BulkCategorizationSuggestionsProps {
  receipts: any[];
  onBulkCategorize: (suggestions: Map<string, CategorySuggestion[]>) => void;
  className?: string;
}

export function BulkCategorizationSuggestions({
  receipts,
  onBulkCategorize,
  className
}: BulkCategorizationSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Map<string, CategorySuggestion[]>>(new Map());
  const { receipts: allReceipts } = useReceipts();

  const handleGenerateBulkSuggestions = async () => {
    if (allReceipts.length === 0) return;

    setLoading(true);
    try {
      const service = new SmartCategorizationService(allReceipts);
      const bulkSuggestions = service.getBulkCategorySuggestions(receipts);
      setSuggestions(bulkSuggestions);
      onBulkCategorize(bulkSuggestions);
    } catch (error) {
      console.error('Error generating bulk suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const uncategorizedCount = receipts.filter(r => !r.category || r.category === 'other').length;

  if (uncategorizedCount === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="w-5 h-5 text-blue-500" />
          Bulk Categorization Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          Found {uncategorizedCount} receipts that could benefit from automatic categorization.
        </div>
        
        <Button 
          onClick={handleGenerateBulkSuggestions}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Brain className="w-4 h-4 mr-2 animate-pulse" />
              Analyzing Patterns...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Smart Suggestions
            </>
          )}
        </Button>

        {suggestions.size > 0 && (
          <div className="text-sm text-green-600">
            ✓ Generated suggestions for {suggestions.size} receipts
          </div>
        )}
      </CardContent>
    </Card>
  );
}