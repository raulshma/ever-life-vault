import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReceiptDialog } from '@/components/ReceiptDialog';
import { BulkCategorization } from '@/components/BulkCategorization';
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
  Loader2
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
  
  const [filters, setFilters] = useState<ReceiptFilters>({
    search: '',
    category: 'all',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    merchant: '',
    isBusinessExpense: '',
    analysisStatus: '',
  });

  const { 
    receipts, 
    categories, 
    merchants,
    loading, 
    fetchReceipts,
    deleteReceipt,
    getExpenseStats 
  } = useReceipts();

  // Filter receipts based on current filters
  const filteredReceipts = receipts.filter(receipt => {
    if (filters.search && !receipt.name.toLowerCase().includes(filters.search.toLowerCase()) &&
        !receipt.merchant_name?.toLowerCase().includes(filters.search.toLowerCase()) &&
        !receipt.description?.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    
    if (filters.category && filters.category !== 'all' && receipt.category !== filters.category) {
      return false;
    }
    
    if (filters.dateFrom && receipt.receipt_date < filters.dateFrom) {
      return false;
    }
    
    if (filters.dateTo && receipt.receipt_date > filters.dateTo) {
      return false;
    }
    
    if (filters.minAmount && receipt.total_amount < parseFloat(filters.minAmount)) {
      return false;
    }
    
    if (filters.maxAmount && receipt.total_amount > parseFloat(filters.maxAmount)) {
      return false;
    }
    
    if (filters.merchant && !receipt.merchant_name?.toLowerCase().includes(filters.merchant.toLowerCase())) {
      return false;
    }
    
    if (filters.isBusinessExpense === 'true' && !receipt.is_business_expense) {
      return false;
    }
    
    if (filters.isBusinessExpense === 'false' && receipt.is_business_expense) {
      return false;
    }
    
    if (filters.analysisStatus && receipt.analysis_status !== filters.analysisStatus) {
      return false;
    }

    return true;
  });

  // Tab-based filtering
  const getReceiptsForTab = (tab: string) => {
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
  };

  const currentReceipts = getReceiptsForTab(activeTab);
  const stats = getExpenseStats();

  // Get uncategorized receipts for bulk categorization
  const uncategorizedReceipts = receipts.filter(r => !r.category || r.category === 'other');

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

  const clearFilters = () => {
    setFilters({
      search: '',
      category: 'all',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      merchant: '',
      isBusinessExpense: '',
      analysisStatus: '',
    });
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

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

  const ReceiptCard = ({ receipt }: { receipt: Receipt }) => (
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
  );

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      <PageHeader 
        title="Receipt Management" 
        description="Manage your receipts with AI-powered analysis and expense tracking"
      />

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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mobile: Stack filters vertically, Desktop: Grid layout */}
          <div className="space-y-4 md:space-y-0">
            {/* Search and Category - Full width on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              <div className="relative md:col-span-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search receipts..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>

              <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.name.toLowerCase().replace(/\s+/g, '_')}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date filters - hide on mobile, show on desktop */}
              <div className="hidden lg:block">
                <Input
                  type="date"
                  placeholder="From Date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>
            </div>

            {/* Date filters - mobile layout */}
            <div className="grid grid-cols-2 gap-3 lg:hidden">
              <Input
                type="date"
                placeholder="From Date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
              <Input
                type="date"
                placeholder="To Date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>

            {/* Desktop: Date To filter */}
            <div className="hidden lg:block">
              <Input
                type="date"
                placeholder="To Date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {/* Mobile: Stack buttons, Desktop: Horizontal layout */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-1">
              <Button variant="outline" onClick={clearFilters} className="w-full sm:w-auto">
                Clear Filters
              </Button>
              {uncategorizedReceipts.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={handleBulkCategorization}
                  className="w-full sm:w-auto"
                >
                  <Brain className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">
                    {isMobile ? `Smart (${uncategorizedReceipts.length})` : `Smart Categorize (${uncategorizedReceipts.length})`}
                  </span>
                </Button>
              )}
            </div>
            <Button onClick={handleAddReceipt} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2 flex-shrink-0" />
              Add Receipt
            </Button>
          </div>
        </CardContent>
      </Card>

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
                  {isMobile ? `All (${filteredReceipts.length})` : `All (${filteredReceipts.length})`}
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
                    </div>
                  ) : (
                    // Desktop: Grid layout
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {currentReceipts.map(receipt => (
                        <ReceiptCard key={receipt.id} receipt={receipt} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ReceiptIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No receipts found</h3>
                  <p className="text-muted-foreground mb-4">
                    {filters.search || filters.category ? 
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
    </div>
  );
}