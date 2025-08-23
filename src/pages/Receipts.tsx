import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReceiptDialog } from '@/components/ReceiptDialog';
import { BulkCategorization } from '@/components/BulkCategorization';
import { BulkOperations } from '@/components/BulkOperations';
import { AdvancedReceiptSearch, type AdvancedSearchFilters, defaultFilters } from '@/components/AdvancedReceiptSearch';
import { PageHeader } from '@/components/PageHeader';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Receipt as ReceiptIcon, 
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Calendar,
  DollarSign,
  Store,
  Tag,
  Eye,
  Edit3,
  Trash2,
  TrendingUp,
  FileText,
  Brain,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  RefreshCw,
  Settings
} from 'lucide-react';

interface ReceiptFilters {
  search: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  merchant: string;
  isBusinessExpense: string;
  analysisStatus: string;
}

export default function Receipts() {
  const isMobile = useIsMobile();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | undefined>();
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | 'view'>('add');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [bulkCategorizationOpen, setBulkCategorizationOpen] = useState(false);
  const [bulkOperationsOpen, setBulkOperationsOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>(defaultFilters);

  const { 
    receipts, 
    categories, 
    merchants,
    loading, 
    pagination,
    fetchReceipts,
    deleteReceipt,
    getExpenseStats,
    loadMoreReceipts,
    clearCache
  } = useReceipts();

  // Enhanced filtered receipts using advanced search
  const filteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      // Text search across multiple fields
      if (advancedFilters.search) {
        const searchLower = advancedFilters.search.toLowerCase();
        const searchFields = [
          receipt.name,
          receipt.merchant_name,
          receipt.description,
          receipt.notes
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchFields.includes(searchLower)) {
          return false;
        }
      }
      
      // Category filter
      if (advancedFilters.category && advancedFilters.category !== 'all_categories' && receipt.category !== advancedFilters.category) {
        return false;
      }
      
      // Merchant filter
      if (advancedFilters.merchant && advancedFilters.merchant !== 'all_merchants' &&
          (!receipt.merchant_name || !receipt.merchant_name.toLowerCase().includes(advancedFilters.merchant.toLowerCase()))) {
        return false;
      }
      
      // Date range filter
      if (advancedFilters.dateFrom && receipt.receipt_date < advancedFilters.dateFrom.toISOString().split('T')[0]) {
        return false;
      }
      
      if (advancedFilters.dateTo && receipt.receipt_date > advancedFilters.dateTo.toISOString().split('T')[0]) {
        return false;
      }
      
      // Amount range filter
      if (advancedFilters.minAmount !== null && receipt.total_amount < advancedFilters.minAmount) {
        return false;
      }
      
      if (advancedFilters.maxAmount !== null && receipt.total_amount > advancedFilters.maxAmount) {
        return false;
      }
      
      // Boolean filters
      if (advancedFilters.isBusinessExpense !== null && receipt.is_business_expense !== advancedFilters.isBusinessExpense) {
        return false;
      }
      
      if (advancedFilters.isTaxDeductible !== null && receipt.is_tax_deductible !== advancedFilters.isTaxDeductible) {
        return false;
      }
      
      if (advancedFilters.isReimbursable !== null && receipt.is_reimbursable !== advancedFilters.isReimbursable) {
        return false;
      }
      
      // Analysis status filter
      if (advancedFilters.analysisStatus && advancedFilters.analysisStatus !== 'any_status' && receipt.analysis_status !== advancedFilters.analysisStatus) {
        return false;
      }
      
      // Payment method filter
      if (advancedFilters.paymentMethod && advancedFilters.paymentMethod !== 'any_method' && receipt.payment_method !== advancedFilters.paymentMethod) {
        return false;
      }
      
      // AI analysis filters
      if (advancedFilters.hasAiAnalysis !== null) {
        const hasAnalysis = receipt.ai_analysis_data !== null;
        if (hasAnalysis !== advancedFilters.hasAiAnalysis) {
          return false;
        }
      }
      
      if (advancedFilters.minConfidence !== null && 
          (!receipt.ai_confidence_score || receipt.ai_confidence_score < advancedFilters.minConfidence)) {
        return false;
      }
      
      // Attachments filter
      if (advancedFilters.hasAttachments !== null) {
        const hasAttachments = receipt.receipt_documents && receipt.receipt_documents.length > 0;
        if (hasAttachments !== advancedFilters.hasAttachments) {
          return false;
        }
      }

      return true;
    });
  }, [receipts, advancedFilters]);

  // Tab-based filtering with memoization
  const getReceiptsForTab = useCallback((tab: string) => {
    switch (tab) {
      case 'business':
        return filteredReceipts.filter(r => r.is_business_expense);
      case 'personal':
        return filteredReceipts.filter(r => !r.is_business_expense);
      case 'pending':
        return filteredReceipts.filter(r => r.analysis_status === 'pending' || r.analysis_status === 'processing');
      default:
        return filteredReceipts;
    }
  }, [filteredReceipts]);

  const currentReceipts = useMemo(() => getReceiptsForTab(activeTab), [getReceiptsForTab, activeTab]);
  const stats = useMemo(() => getExpenseStats, [getExpenseStats]);

  // Get uncategorized receipts for bulk categorization
  const uncategorizedReceipts = useMemo(() => {
    return receipts.filter(r => !r.category || r.category === 'other');
  }, [receipts]);

  const handleAddReceipt = () => {
    setSelectedReceipt(undefined);
    setDialogMode('add');
    setDialogOpen(true);
  };

  const handleViewReceipt = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setDialogMode('view');
    setDialogOpen(true);
  };

  const handleEditReceipt = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const handleDeleteReceipt = async (receipt: Receipt) => {
    if (window.confirm(`Are you sure you want to delete "${receipt.name}"?`)) {
      await deleteReceipt(receipt.id);
    }
  };

  const handleBulkCategorization = () => {
    setBulkCategorizationOpen(true);
  };

  const handleBulkOperations = () => {
    setBulkOperationsOpen(true);
  };

  // Debounced search to avoid excessive API calls
  const debouncedSearch = useMemo(() => {
    const timeoutRef = { current: null as NodeJS.Timeout | null };
    
    return (searchFilters: AdvancedSearchFilters) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        setAdvancedFilters(searchFilters);
      }, 300);
    };
  }, []);

  const clearFilters = useCallback(() => {
    setAdvancedFilters(defaultFilters);
    clearCache(); // Clear cache when filters change
  }, [clearCache]);
  
  const applyFilters = useCallback(() => {
    // Convert advanced filters to API format and fetch
    const apiFilters = {
      search: advancedFilters.search,
      category: advancedFilters.category !== 'all_categories' ? advancedFilters.category : undefined,
      date_from: advancedFilters.dateFrom?.toISOString().split('T')[0],
      date_to: advancedFilters.dateTo?.toISOString().split('T')[0],
      min_amount: advancedFilters.minAmount,
      max_amount: advancedFilters.maxAmount,
      merchant: advancedFilters.merchant !== 'all_merchants' ? advancedFilters.merchant : undefined,
      is_business_expense: advancedFilters.isBusinessExpense,
      analysis_status: advancedFilters.analysisStatus !== 'any_status' ? advancedFilters.analysisStatus : undefined,
    };
    
    fetchReceipts(apiFilters);
  }, [advancedFilters, fetchReceipts]);

  const handleLoadMore = useCallback(() => {
    // Convert advanced filters for load more
    const apiFilters = {
      search: advancedFilters.search,
      category: advancedFilters.category !== 'all_categories' ? advancedFilters.category : undefined,
      date_from: advancedFilters.dateFrom?.toISOString().split('T')[0],
      date_to: advancedFilters.dateTo?.toISOString().split('T')[0],
      min_amount: advancedFilters.minAmount,
      max_amount: advancedFilters.maxAmount,
      merchant: advancedFilters.merchant !== 'all_merchants' ? advancedFilters.merchant : undefined,
      is_business_expense: advancedFilters.isBusinessExpense,
      analysis_status: advancedFilters.analysisStatus !== 'any_status' ? advancedFilters.analysisStatus : undefined,
    };
    loadMoreReceipts(apiFilters);
  }, [loadMoreReceipts, advancedFilters]);

  const formatCurrency = useCallback((amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }, []);

  const getAnalysisStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-info" />;
      default:
        return <Brain className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Memoized receipt card component for better performance
  const ReceiptCard = React.memo(({ receipt }: { receipt: Receipt }) => (
    <Card key={receipt.id} className="hover:shadow-md transition-shadow w-full max-w-full">
      <CardContent className="p-3 sm:p-4">
        {isMobile ? (
          // Mobile: Compact vertical layout
          <div className="space-y-3">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base sm:text-lg truncate">{receipt.name}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {receipt.merchant_name || 'Unknown Merchant'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold text-success">
                  {formatCurrency(receipt.total_amount, receipt.currency)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(receipt.receipt_date).toLocaleDateString()}
                </div>
              </div>
            </div>
            
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant="secondary" className="text-xs">{receipt.category}</Badge>
              {receipt.is_business_expense && (
                <Badge variant="outline" className="text-xs">Business</Badge>
              )}
              {receipt.is_tax_deductible && (
                <Badge variant="outline" className="text-xs">Tax</Badge>
              )}
            </div>
            
            {/* Status and Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {getAnalysisStatusIcon(receipt.analysis_status)}
                <span className="text-xs text-muted-foreground capitalize truncate">
                  {receipt.analysis_status}
                </span>
                {receipt.ai_confidence_score && (
                  <span className="text-xs text-muted-foreground">
                    ({Math.round(receipt.ai_confidence_score * 100)}%)
                  </span>
                )}
              </div>
              
              <div className="flex gap-1 flex-shrink-0">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleViewReceipt(receipt)}
                  className="h-8 w-8 p-0"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleEditReceipt(receipt)}
                  className="h-8 w-8 p-0"
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleDeleteReceipt(receipt)}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {receipt.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {receipt.description}
              </p>
            )}
          </div>
        ) : (
          // Desktop: Original layout
          <>
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{receipt.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {receipt.merchant_name || 'Unknown Merchant'}
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{receipt.category}</Badge>
                  {receipt.is_business_expense && (
                    <Badge variant="outline">Business</Badge>
                  )}
                  {receipt.is_tax_deductible && (
                    <Badge variant="outline">Tax Deductible</Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-success">
                  {formatCurrency(receipt.total_amount, receipt.currency)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(receipt.receipt_date).toLocaleDateString()}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getAnalysisStatusIcon(receipt.analysis_status)}
                <span className="text-xs text-muted-foreground capitalize">
                  {receipt.analysis_status}
                </span>
                {receipt.ai_confidence_score && (
                  <span className="text-xs text-muted-foreground">
                    ({Math.round(receipt.ai_confidence_score * 100)}%)
                  </span>
                )}
              </div>
              
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleViewReceipt(receipt)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleEditReceipt(receipt)}
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleDeleteReceipt(receipt)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {receipt.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {receipt.description}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  ));
  
  // Set display name for debugging
  ReceiptCard.displayName = 'ReceiptCard';

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      <PageHeader 
        title="Receipt Management" 
        description="Manage your receipts with AI-powered analysis and expense tracking"
      >
        {/* Action Buttons */}
        <Button 
          variant="outline" 
          onClick={handleBulkOperations}
          disabled={receipts.length === 0}
          className="hidden sm:flex"
        >
          <Settings className="w-4 h-4 mr-2" />
          Bulk Operations
        </Button>
        
        {uncategorizedReceipts.length > 0 && (
          <Button 
            variant="outline" 
            onClick={handleBulkCategorization}
            className="hidden sm:flex"
          >
            <Brain className="w-4 h-4 mr-2" />
            Categorize ({uncategorizedReceipts.length})
          </Button>
        )}
        
        <Button 
          variant="default" 
          onClick={handleAddReceipt}
          className="hidden sm:flex"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Receipt
        </Button>

        {/* Mobile: Compact buttons */}
        <Button 
          variant="outline" 
          size="icon"
          onClick={handleBulkOperations}
          disabled={receipts.length === 0}
          className="sm:hidden"
          aria-label="Bulk Operations"
        >
          <Settings className="w-5 h-5" />
        </Button>
        
        {uncategorizedReceipts.length > 0 && (
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleBulkCategorization}
            className="sm:hidden"
            aria-label="Bulk Categorization"
          >
            <Brain className="w-5 h-5" />
          </Button>
        )}
        
        <Button 
          variant="default" 
          size="icon"
          onClick={handleAddReceipt}
          className="sm:hidden"
          aria-label="Add Receipt"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </PageHeader>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Receipts</p>
                <p className="text-lg sm:text-2xl font-bold">{stats.receiptCount}</p>
              </div>
              <ReceiptIcon className="w-6 h-6 sm:w-8 sm:h-8 text-info flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Amount</p>
                <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(stats.totalAmount)}</p>
              </div>
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-success flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Business</p>
                <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(stats.businessExpenses)}</p>
              </div>
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-info flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Reimbursable</p>
                <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(stats.reimbursableAmount)}</p>
              </div>
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-warning flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Search */}
      <AdvancedReceiptSearch
        filters={advancedFilters}
        onFiltersChange={debouncedSearch}
        categories={categories}
        merchants={merchants}
        totalCount={receipts.length}
        filteredCount={filteredReceipts.length}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
      />

      {/* Receipts List */}
      <Card>
        <CardHeader>
          <CardTitle>Receipts</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
              <TabsTrigger value="all" className="text-xs sm:text-sm px-2 py-2">
                <span className="truncate">
                  {isMobile ? `All (${filteredReceipts.length})` : `All Receipts (${filteredReceipts.length})`}
                </span>
              </TabsTrigger>
              <TabsTrigger value="business" className="text-xs sm:text-sm px-2 py-2">
                <span className="truncate">Business</span>
              </TabsTrigger>
              <TabsTrigger value="personal" className="text-xs sm:text-sm px-2 py-2">
                <span className="truncate">Personal</span>
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs sm:text-sm px-2 py-2">
                <span className="truncate">
                  {isMobile ? 'Pending' : 'Pending Analysis'}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading receipts...</p>
                </div>
              ) : currentReceipts.length > 0 ? (
                <div className="w-full max-w-full overflow-hidden">
                  {isMobile ? (
                    // Mobile: Single column with compact cards
                    <div className="space-y-3">
                      {currentReceipts.map(receipt => (
                        <ReceiptCard key={receipt.id} receipt={receipt} />
                      ))}
                                    
                      {/* Load More Button for mobile */}
                      {pagination.hasMore && currentReceipts.length > 0 && (
                        <div className="flex justify-center py-4">
                          <Button 
                            variant="outline" 
                            onClick={handleLoadMore}
                            disabled={loading}
                            className="w-full sm:w-auto"
                          >
                            {loading ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <ChevronDown className="w-4 h-4 mr-2" />
                            )}
                            {loading ? 'Loading...' : 'Load More'}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Desktop: Grid layout with infinite scroll
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {currentReceipts.map(receipt => (
                          <ReceiptCard key={receipt.id} receipt={receipt} />
                        ))}
                      </div>
                                    
                      {/* Load More for desktop */}
                      {pagination.hasMore && currentReceipts.length > 0 && (
                        <div className="flex justify-center py-6">
                          <Button 
                            variant="outline" 
                            onClick={handleLoadMore}
                            disabled={loading}
                            size="lg"
                          >
                            {loading ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <ChevronDown className="w-4 h-4 mr-2" />
                            )}
                            {loading ? 'Loading more receipts...' : 'Load More Receipts'}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ReceiptIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No receipts found</h3>
                  <p className="text-muted-foreground mb-4">
                    {advancedFilters.search || advancedFilters.category ? 
                      'Try adjusting your filters to see more results.' :
                      'Get started by adding your first receipt.'
                    }
                  </p>
                  <Button onClick={handleAddReceipt}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Receipt
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      <ReceiptDialog
        receipt={selectedReceipt}
        mode={dialogMode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Bulk Categorization Dialog */}
      {bulkCategorizationOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-background rounded-lg max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            <div className="p-3 sm:p-6 max-h-full overflow-y-auto">
              <BulkCategorization
                uncategorizedReceipts={uncategorizedReceipts}
                onClose={() => setBulkCategorizationOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bulk Operations Dialog */}
      {bulkOperationsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-background rounded-lg max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
            <div className="p-3 sm:p-6 max-h-full overflow-y-auto">
              <BulkOperations
                receipts={receipts}
                onClose={() => setBulkOperationsOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}