'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
  Clock,
  Trash2,
  Download,
  Upload,
  Settings,
  Eye,
  FileText,
  Filter,
  Copy,
  Archive
} from 'lucide-react';

interface BulkOperationsProps {
  receipts: Receipt[];
  onClose: () => void;
  className?: string;
}

type BulkOperationType = 'categorize' | 'delete' | 'export' | 'analyze' | 'archive';

interface BulkProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
}

const CATEGORY_OPTIONS = [
  { value: 'food_dining', label: 'Food & Dining' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'business', label: 'Business' },
  { value: 'travel', label: 'Travel' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'home_garden', label: 'Home & Garden' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' }
];

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV', description: 'Comma-separated values' },
  { value: 'json', label: 'JSON', description: 'JavaScript Object Notation' },
  { value: 'xlsx', label: 'Excel', description: 'Excel spreadsheet' }
];

export function BulkOperations({ receipts, onClose, className }: BulkOperationsProps) {
  const isMobile = useIsMobile();
  const { updateReceipt, deleteReceipt } = useReceipts();
  const { toast } = useToast();

  // State management
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [operation, setOperation] = useState<BulkOperationType>('categorize');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<BulkProgress>({ total: 0, completed: 0, failed: 0 });

  // Categorization state
  const [suggestions, setSuggestions] = useState<Map<string, CategorySuggestion[]>>(new Map());
  const [manualCategory, setManualCategory] = useState<string>('');

  // Export state
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xlsx'>('csv');
  const [includeItems, setIncludeItems] = useState(false);
  const [includeDocuments, setIncludeDocuments] = useState(false);

  // Filtered receipts based on current needs
  const uncategorizedReceipts = useMemo(() => 
    receipts.filter(r => !r.category || r.category === 'other'),
    [receipts]
  );

  const analyzableReceipts = useMemo(() => 
    receipts.filter(r => r.image_url && r.analysis_status !== 'processing'),
    [receipts]
  );

  // Selection handlers
  const toggleReceiptSelection = useCallback((receiptId: string) => {
    setSelectedReceipts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(receiptId)) {
        newSet.delete(receiptId);
      } else {
        newSet.add(receiptId);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const relevantReceipts = operation === 'categorize' 
      ? uncategorizedReceipts 
      : operation === 'analyze' 
        ? analyzableReceipts 
        : receipts;

    if (selectedReceipts.size === relevantReceipts.length) {
      setSelectedReceipts(new Set());
    } else {
      setSelectedReceipts(new Set(relevantReceipts.map(r => r.id)));
    }
  }, [operation, uncategorizedReceipts, analyzableReceipts, receipts, selectedReceipts.size]);

  const clearSelection = useCallback(() => {
    setSelectedReceipts(new Set());
  }, []);

  // Smart categorization
  const generateCategorySuggestions = useCallback(async () => {
    setProcessing(true);
    setProgress({ total: uncategorizedReceipts.length, completed: 0, failed: 0 });

    try {
      const service = new SmartCategorizationService(receipts);
      const bulkSuggestions = service.getBulkCategorySuggestions(uncategorizedReceipts);
      setSuggestions(bulkSuggestions);
      
      // Auto-select high-confidence suggestions
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
      setProgress({ total: 0, completed: 0, failed: 0 });
    }
  }, [uncategorizedReceipts, receipts, toast]);

  // Bulk operations
  const executeBulkOperation = useCallback(async () => {
    if (selectedReceipts.size === 0) return;

    setProcessing(true);
    const selectedArray = Array.from(selectedReceipts);
    setProgress({ total: selectedArray.length, completed: 0, failed: 0 });

    try {
      let results: any[] = [];
      let errors: any[] = [];

      switch (operation) {
        case 'categorize':
          if (suggestions.size > 0) {
            // Apply AI suggestions
            for (let i = 0; i < selectedArray.length; i++) {
              const receiptId = selectedArray[i];
              const receiptSuggestions = suggestions.get(receiptId);
              
              try {
                if (receiptSuggestions && receiptSuggestions.length > 0) {
                  const topSuggestion = receiptSuggestions[0];
                  const receipt = receipts.find(r => r.id === receiptId);
                  
                  if (receipt) {
                    await updateReceipt(receiptId, {
                      ...receipt,
                      category: topSuggestion.category,
                      subcategory: topSuggestion.subcategory
                    });
                    results.push({ id: receiptId, category: topSuggestion.category });
                  }
                }
              } catch (error) {
                errors.push({ id: receiptId, error: error instanceof Error ? error.message : 'Unknown error' });
              }
              
              setProgress(prev => ({ ...prev, completed: i + 1, failed: errors.length }));
            }
          } else if (manualCategory) {
            // Apply manual category
            for (let i = 0; i < selectedArray.length; i++) {
              const receiptId = selectedArray[i];
              const receipt = receipts.find(r => r.id === receiptId);
              
              try {
                if (receipt) {
                  await updateReceipt(receiptId, {
                    ...receipt,
                    category: manualCategory
                  });
                  results.push({ id: receiptId, category: manualCategory });
                }
              } catch (error) {
                errors.push({ id: receiptId, error: error instanceof Error ? error.message : 'Unknown error' });
              }
              
              setProgress(prev => ({ ...prev, completed: i + 1, failed: errors.length }));
            }
          }
          break;

        case 'delete':
          for (let i = 0; i < selectedArray.length; i++) {
            const receiptId = selectedArray[i];
            
            try {
              await deleteReceipt(receiptId);
              results.push({ id: receiptId });
            } catch (error) {
              errors.push({ id: receiptId, error: error instanceof Error ? error.message : 'Unknown error' });
            }
            
            setProgress(prev => ({ ...prev, completed: i + 1, failed: errors.length }));
          }
          break;

        case 'export':
          try {
            const exportReceipts = receipts.filter(r => selectedReceipts.has(r.id));
            await handleExport(exportReceipts);
            results.push({ count: exportReceipts.length });
          } catch (error) {
            errors.push({ error: error instanceof Error ? error.message : 'Export failed' });
          }
          setProgress(prev => ({ ...prev, completed: selectedArray.length }));
          break;

        case 'analyze':
          // This would call the bulk analyze API endpoint
          try {
            const response = await fetch('/api/receipts/bulk/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                receipt_ids: selectedArray,
                job_type: 'full_analysis'
              })
            });

            if (response.ok) {
              const data = await response.json();
              results = data.started || [];
              errors = data.errors || [];
            } else {
              throw new Error('Failed to start bulk analysis');
            }
          } catch (error) {
            errors.push({ error: error instanceof Error ? error.message : 'Analysis failed' });
          }
          setProgress(prev => ({ ...prev, completed: selectedArray.length }));
          break;

        case 'archive':
          for (let i = 0; i < selectedArray.length; i++) {
            const receiptId = selectedArray[i];
            const receipt = receipts.find(r => r.id === receiptId);
            
            try {
              if (receipt) {
                await updateReceipt(receiptId, {
                  ...receipt,
                  tags: [...(receipt.tags || []), 'archived']
                });
                results.push({ id: receiptId });
              }
            } catch (error) {
              errors.push({ id: receiptId, error: error instanceof Error ? error.message : 'Unknown error' });
            }
            
            setProgress(prev => ({ ...prev, completed: i + 1, failed: errors.length }));
          }
          break;
      }

      const successCount = results.length;
      const errorCount = errors.length;

      toast({
        title: "Operation Complete",
        description: `Successfully processed ${successCount} receipts${errorCount > 0 ? ` with ${errorCount} errors` : ''}`,
        variant: errorCount > 0 ? "destructive" : "default"
      });

      if (successCount > 0) {
        onClose();
      }
    } catch (error) {
      console.error('Bulk operation failed:', error);
      toast({
        title: "Error",
        description: "Bulk operation failed",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setProgress({ total: 0, completed: 0, failed: 0 });
    }
  }, [selectedReceipts, operation, suggestions, manualCategory, receipts, updateReceipt, deleteReceipt, toast, onClose]);

  const handleExport = async (exportReceipts: Receipt[]) => {
    const timestamp = new Date().toISOString().split('T')[0];
    let data: string;
    let filename: string;

    switch (exportFormat) {
      case 'csv':
        const csvHeaders = [
          'ID', 'Name', 'Amount', 'Date', 'Merchant', 'Category', 'Description', 'Tags'
        ];
        const csvRows = exportReceipts.map(receipt => [
          receipt.id,
          receipt.name,
          receipt.total_amount,
          receipt.receipt_date,
          receipt.merchant_name || '',
          receipt.category || '',
          receipt.description || '',
          (receipt.tags || []).join(';')
        ]);
        data = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
        filename = `receipts-${timestamp}.csv`;
        break;

      case 'json':
        data = JSON.stringify({ receipts: exportReceipts, exported_at: new Date().toISOString() }, null, 2);
        filename = `receipts-${timestamp}.json`;
        break;

      case 'xlsx':
        // For now, export as JSON and let user know about Excel format
        data = JSON.stringify({ receipts: exportReceipts, exported_at: new Date().toISOString() }, null, 2);
        filename = `receipts-${timestamp}.json`;
        toast({
          title: "Export Notice",
          description: "Excel format exported as JSON. Use a converter tool for .xlsx format.",
        });
        break;
    }

    // Create download
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper functions
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

  const getOperationIcon = (op: BulkOperationType) => {
    switch (op) {
      case 'categorize': return <Brain className="w-4 h-4" />;
      case 'delete': return <Trash2 className="w-4 h-4" />;
      case 'export': return <Download className="w-4 h-4" />;
      case 'analyze': return <Sparkles className="w-4 h-4" />;
      case 'archive': return <Archive className="w-4 h-4" />;
    }
  };

  const getRelevantReceipts = () => {
    switch (operation) {
      case 'categorize': return uncategorizedReceipts;
      case 'analyze': return analyzableReceipts;
      default: return receipts;
    }
  };

  const relevantReceipts = getRelevantReceipts();
  const canProceed = selectedReceipts.size > 0 && !processing;
  const progressPercentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className={`space-y-4 sm:space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Settings className="w-5 h-5 text-primary" />
            Bulk Operations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Operation Selection */}
          <Tabs value={operation} onValueChange={(value) => setOperation(value as BulkOperationType)}>
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
              <TabsTrigger value="categorize" className="flex items-center gap-1">
                {getOperationIcon('categorize')}
                <span className="hidden sm:inline">Categorize</span>
              </TabsTrigger>
              <TabsTrigger value="analyze" className="flex items-center gap-1">
                {getOperationIcon('analyze')}
                <span className="hidden sm:inline">Analyze</span>
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-1">
                {getOperationIcon('export')}
                <span className="hidden sm:inline">Export</span>
              </TabsTrigger>
              <TabsTrigger value="archive" className="flex items-center gap-1">
                {getOperationIcon('archive')}
                <span className="hidden sm:inline">Archive</span>
              </TabsTrigger>
              <TabsTrigger value="delete" className="flex items-center gap-1">
                {getOperationIcon('delete')}
                <span className="hidden sm:inline">Delete</span>
              </TabsTrigger>
            </TabsList>

            {/* Operation-specific content */}
            <TabsContent value="categorize" className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={generateCategorySuggestions}
                  disabled={processing || uncategorizedReceipts.length === 0}
                  variant="outline"
                  className="flex-1"
                >
                  <Brain className="w-4 h-4 mr-2" />
                  Generate AI Suggestions
                </Button>
                <div className="flex-1">
                  <Select value={manualCategory} onValueChange={setManualCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Or choose manual category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="export" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="format">Export Format</Label>
                  <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPORT_FORMATS.map(format => (
                        <SelectItem key={format.value} value={format.value}>
                          <div>
                            <div className="font-medium">{format.label}</div>
                            <div className="text-xs text-muted-foreground">{format.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeItems" 
                    checked={includeItems} 
                    onCheckedChange={(checked) => setIncludeItems(!!checked)}
                  />
                  <Label htmlFor="includeItems">Include Items</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeDocuments" 
                    checked={includeDocuments} 
                    onCheckedChange={(checked) => setIncludeDocuments(!!checked)}
                  />
                  <Label htmlFor="includeDocuments">Include Documents</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analyze" className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Start AI analysis for selected receipts. Only receipts with images that aren't currently being processed will be analyzed.
              </div>
            </TabsContent>

            <TabsContent value="archive" className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Archive selected receipts by adding an "archived" tag. Archived receipts will be hidden from the main view but remain accessible.
              </div>
            </TabsContent>

            <TabsContent value="delete" className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center gap-2 text-destructive font-medium">
                  <Trash2 className="w-4 h-4" />
                  Warning: Permanent Deletion
                </div>
                <div className="text-sm text-destructive/80 mt-1">
                  This action cannot be undone. Selected receipts and all associated data will be permanently deleted.
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Selection Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {relevantReceipts.length} {operation === 'categorize' ? 'uncategorized' : operation === 'analyze' ? 'analyzable' : 'total'} receipts
              {selectedReceipts.size > 0 && (
                <span className="ml-2 text-primary font-medium">
                  • {selectedReceipts.size} selected
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={toggleSelectAll}
                disabled={processing || relevantReceipts.length === 0}
              >
                {selectedReceipts.size === relevantReceipts.length ? 'Deselect All' : 'Select All'}
              </Button>
              {selectedReceipts.size > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={clearSelection}
                  disabled={processing}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Progress */}
          {processing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing...</span>
                <span>{progress.completed}/{progress.total}</span>
              </div>
              <Progress value={progressPercentage} className="w-full" />
              {progress.failed > 0 && (
                <div className="text-xs text-destructive">
                  {progress.failed} failed
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={processing}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            
            <Button 
              onClick={executeBulkOperation}
              disabled={!canProceed}
              variant={operation === 'delete' ? 'destructive' : 'default'}
            >
              {processing ? (
                <>
                  <Zap className="w-4 h-4 mr-2 animate-pulse" />
                  Processing...
                </>
              ) : (
                <>
                  {getOperationIcon(operation)}
                  <span className="ml-2">
                    {operation === 'categorize' && 'Categorize Selected'}
                    {operation === 'delete' && 'Delete Selected'}
                    {operation === 'export' && 'Export Selected'}
                    {operation === 'analyze' && 'Analyze Selected'}
                    {operation === 'archive' && 'Archive Selected'}
                  </span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Receipt List */}
      {relevantReceipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {operation === 'categorize' && 'Uncategorized Receipts'}
              {operation === 'analyze' && 'Analyzable Receipts'}
              {operation === 'export' && 'Available Receipts'}
              {operation === 'archive' && 'Receipts to Archive'}
              {operation === 'delete' && 'Receipts to Delete'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {relevantReceipts.map(receipt => {
              const isSelected = selectedReceipts.has(receipt.id);
              const receiptSuggestions = suggestions.get(receipt.id);
              const topSuggestion = receiptSuggestions?.[0];

              return (
                <Card 
                  key={receipt.id}
                  className={`transition-all cursor-pointer ${
                    isSelected ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => toggleReceiptSelection(receipt.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => {}} // Handled by card click
                        disabled={processing}
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
                          {receipt.category && receipt.category !== 'other' && (
                            <span> • {formatCategoryName(receipt.category)}</span>
                          )}
                        </div>
                      </div>

                      {/* Show suggestion for categorize operation */}
                      {operation === 'categorize' && topSuggestion && (
                        <>
                          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex items-center gap-2 flex-shrink-0">
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
                        </>
                      )}

                      {/* Show status indicators */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {receipt.image_url && <Eye className="w-3 h-3 text-muted-foreground" />}
                        {receipt.receipt_documents && receipt.receipt_documents.length > 0 && (
                          <FileText className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}