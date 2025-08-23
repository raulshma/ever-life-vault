import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Search, 
  Filter, 
  X, 
  CalendarIcon, 
  DollarSign,
  Tag,
  Building,
  Clock,
  Save,
  Bookmark,
  TrendingUp,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

export interface AdvancedSearchFilters {
  // Text search
  search: string;
  merchant: string;
  category: string;
  description: string;
  
  // Amount filters
  minAmount: number | null;
  maxAmount: number | null;
  amountRange: [number, number];
  
  // Date filters
  dateFrom: Date | null;
  dateTo: Date | null;
  datePreset: string;
  
  // Boolean filters
  isBusinessExpense: boolean | null;
  isTaxDeductible: boolean | null;
  isReimbursable: boolean | null;
  hasAttachments: boolean | null;
  
  // AI Analysis filters
  analysisStatus: string;
  minConfidence: number | null;
  hasAiAnalysis: boolean | null;
  
  // Advanced filters
  paymentMethod: string;
  tags: string[];
  receiptType: string;
}

interface SavedFilter {
  id: string;
  name: string;
  filters: AdvancedSearchFilters;
  isDefault: boolean;
  usageCount: number;
  lastUsed: string;
}

interface AdvancedReceiptSearchProps {
  filters: AdvancedSearchFilters;
  onFiltersChange: (filters: AdvancedSearchFilters) => void;
  categories: Array<{ id: string; name: string }>;
  merchants: Array<{ id: string; name: string }>;
  totalCount: number;
  filteredCount: number;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  className?: string;
}

const defaultFilters: AdvancedSearchFilters = {
  search: '',
  merchant: 'all_merchants',
  category: 'all_categories',
  description: '',
  minAmount: null,
  maxAmount: null,
  amountRange: [0, 10000],
  dateFrom: null,
  dateTo: null,
  datePreset: 'all_time',
  isBusinessExpense: null,
  isTaxDeductible: null,
  isReimbursable: null,
  hasAttachments: null,
  analysisStatus: 'any_status',
  minConfidence: null,
  hasAiAnalysis: null,
  paymentMethod: 'any_method',
  tags: [],
  receiptType: '',
};

export function AdvancedReceiptSearch({
  filters,
  onFiltersChange,
  categories,
  merchants,
  totalCount,
  filteredCount,
  onApplyFilters,
  onClearFilters,
  className
}: AdvancedReceiptSearchProps) {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load saved filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('receipt-saved-filters');
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading saved filters:', error);
      }
    }
  }, []);

  // Save filters to localStorage
  const saveSavedFilters = useCallback((filters: SavedFilter[]) => {
    localStorage.setItem('receipt-saved-filters', JSON.stringify(filters));
    setSavedFilters(filters);
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.merchant && filters.merchant !== 'all_merchants') count++;
    if (filters.category && filters.category !== 'all_categories') count++;
    if (filters.description) count++;
    if (filters.minAmount !== null) count++;
    if (filters.maxAmount !== null) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.isBusinessExpense !== null) count++;
    if (filters.isTaxDeductible !== null) count++;
    if (filters.isReimbursable !== null) count++;
    if (filters.hasAttachments !== null) count++;
    if (filters.analysisStatus && filters.analysisStatus !== 'any_status') count++;
    if (filters.minConfidence !== null) count++;
    if (filters.hasAiAnalysis !== null) count++;
    if (filters.paymentMethod && filters.paymentMethod !== 'any_method') count++;
    if (filters.tags.length > 0) count++;
    if (filters.receiptType) count++;
    return count;
  }, [filters]);

  // Generate search suggestions based on common searches
  const generateSuggestions = useCallback((query: string) => {
    if (!query || query.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    const suggestions = [
      `"${query}" in merchant name`,
      `"${query}" in description`,
      `"${query}" in all fields`,
      `Business expenses containing "${query}"`,
      `Recent receipts with "${query}"`,
    ];

    setSearchSuggestions(suggestions.slice(0, 5));
  }, []);

  // Date preset options
  const datePresets = [
    { value: 'all_time', label: 'All time' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This week' },
    { value: 'last_week', label: 'Last week' },
    { value: 'this_month', label: 'This month' },
    { value: 'last_month', label: 'Last month' },
    { value: 'this_quarter', label: 'This quarter' },
    { value: 'this_year', label: 'This year' },
    { value: 'last_year', label: 'Last year' },
  ];

  // Apply date preset
  const applyDatePreset = useCallback((preset: string) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    switch (preset) {
      case 'all_time':
        // Clear date filters for all time
        dateFrom = null;
        dateTo = null;
        break;
      case 'today':
        dateFrom = startOfDay;
        dateTo = endOfDay;
        break;
      case 'yesterday':
        const yesterday = new Date(startOfDay);
        yesterday.setDate(yesterday.getDate() - 1);
        dateFrom = yesterday;
        dateTo = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1);
        break;
      case 'this_week':
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        dateFrom = startOfWeek;
        dateTo = endOfDay;
        break;
      case 'last_week':
        const lastWeekStart = new Date(startOfDay);
        lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
        dateFrom = lastWeekStart;
        dateTo = lastWeekEnd;
        break;
      case 'this_month':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        dateTo = endOfDay;
        break;
      case 'last_month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        dateFrom = lastMonth;
        dateTo = lastMonthEnd;
        break;
      // Add more presets as needed
    }

    onFiltersChange({
      ...filters,
      datePreset: preset,
      dateFrom,
      dateTo,
    });
  }, [filters, onFiltersChange]);

  // Save current filters
  const saveCurrentFilters = useCallback(() => {
    if (!newFilterName.trim()) return;

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: newFilterName.trim(),
      filters: { ...filters },
      isDefault: false,
      usageCount: 0,
      lastUsed: new Date().toISOString(),
    };

    const updatedFilters = [...savedFilters, newFilter];
    saveSavedFilters(updatedFilters);
    setNewFilterName('');
    setShowSaveDialog(false);
  }, [filters, newFilterName, savedFilters, saveSavedFilters]);

  // Load saved filter
  const loadSavedFilter = useCallback((savedFilter: SavedFilter) => {
    onFiltersChange(savedFilter.filters);
    
    // Update usage statistics
    const updatedFilters = savedFilters.map(f => 
      f.id === savedFilter.id 
        ? { ...f, usageCount: f.usageCount + 1, lastUsed: new Date().toISOString() }
        : f
    );
    saveSavedFilters(updatedFilters);
  }, [onFiltersChange, savedFilters, saveSavedFilters]);

  // Delete saved filter
  const deleteSavedFilter = useCallback((filterId: string) => {
    const updatedFilters = savedFilters.filter(f => f.id !== filterId);
    saveSavedFilters(updatedFilters);
  }, [savedFilters, saveSavedFilters]);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Advanced Search
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filteredCount} of {totalCount} receipts
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search receipts, merchants, descriptions..."
            value={filters.search}
            onChange={(e) => {
              onFiltersChange({ ...filters, search: e.target.value });
              generateSuggestions(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="pl-10"
          />
          
          {/* Search Suggestions */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-background border rounded-md shadow-md">
              {searchSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                  onClick={() => {
                    onFiltersChange({ ...filters, search: suggestion });
                    setShowSuggestions(false);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          <Select 
            value={filters.category} 
            onValueChange={(value) => onFiltersChange({ ...filters, category: value })}
          >
            <SelectTrigger className="w-auto">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_categories">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={filters.datePreset} 
            onValueChange={applyDatePreset}
          >
            <SelectTrigger className="w-auto">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              {datePresets.map(preset => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={filters.isBusinessExpense === true ? "default" : "outline"}
            size="sm"
            onClick={() => onFiltersChange({ 
              ...filters, 
              isBusinessExpense: filters.isBusinessExpense === true ? null : true 
            })}
          >
            <Building className="w-4 h-4 mr-1" />
            Business
          </Button>

          <Button
            variant={filters.analysisStatus === 'completed' ? "default" : "outline"}
            size="sm"
            onClick={() => onFiltersChange({ 
              ...filters, 
              analysisStatus: filters.analysisStatus === 'completed' ? '' : 'completed'
            })}
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            AI Analyzed
          </Button>
        </div>

        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Saved Filters</Label>
            <div className="flex flex-wrap gap-2">
              {savedFilters.slice(0, 5).map(savedFilter => (
                <div key={savedFilter.id} className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadSavedFilter(savedFilter)}
                    className="h-7"
                  >
                    <Bookmark className="w-3 h-3 mr-1" />
                    {savedFilter.name}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSavedFilter(savedFilter.id)}
                    className="h-7 w-7 p-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expanded Filters */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Merchant Filter */}
              <div className="space-y-2">
                <Label>Merchant</Label>
                <Select 
                  value={filters.merchant} 
                  onValueChange={(value) => onFiltersChange({ ...filters, merchant: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All merchants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_merchants">All Merchants</SelectItem>
                    {merchants.map(merchant => (
                      <SelectItem key={merchant.id} value={merchant.name}>
                        {merchant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select 
                  value={filters.paymentMethod} 
                  onValueChange={(value) => onFiltersChange({ ...filters, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any_method">Any Method</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="digital">Digital Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Analysis Status */}
              <div className="space-y-2">
                <Label>AI Analysis Status</Label>
                <Select 
                  value={filters.analysisStatus} 
                  onValueChange={(value) => onFiltersChange({ ...filters, analysisStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any_status">Any Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Amount Range */}
            <div className="space-y-2">
              <Label>Amount Range: ${filters.amountRange[0]} - ${filters.amountRange[1]}</Label>
              <Slider
                value={filters.amountRange}
                onValueChange={(value) => onFiltersChange({ 
                  ...filters, 
                  amountRange: value as [number, number],
                  minAmount: value[0],
                  maxAmount: value[1]
                })}
                max={10000}
                min={0}
                step={10}
                className="w-full"
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {filters.dateFrom ? format(filters.dateFrom, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateFrom || undefined}
                      onSelect={(date) => onFiltersChange({ ...filters, dateFrom: date || null })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {filters.dateTo ? format(filters.dateTo, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateTo || undefined}
                      onSelect={(date) => onFiltersChange({ ...filters, dateTo: date || null })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Boolean Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={filters.isTaxDeductible === true}
                  onCheckedChange={(checked) => onFiltersChange({ 
                    ...filters, 
                    isTaxDeductible: checked ? true : null 
                  })}
                />
                <Label>Tax Deductible</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={filters.isReimbursable === true}
                  onCheckedChange={(checked) => onFiltersChange({ 
                    ...filters, 
                    isReimbursable: checked ? true : null 
                  })}
                />
                <Label>Reimbursable</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={filters.hasAttachments === true}
                  onCheckedChange={(checked) => onFiltersChange({ 
                    ...filters, 
                    hasAttachments: checked ? true : null 
                  })}
                />
                <Label>Has Attachments</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={filters.hasAiAnalysis === true}
                  onCheckedChange={(checked) => onFiltersChange({ 
                    ...filters, 
                    hasAiAnalysis: checked ? true : null 
                  })}
                />
                <Label>AI Analyzed</Label>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
          <div className="flex gap-2 flex-1">
            <Button onClick={onApplyFilters} className="flex-1 sm:flex-none">
              <Search className="w-4 h-4 mr-2" />
              Apply Filters
            </Button>
            
            <Button variant="outline" onClick={onClearFilters}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowSaveDialog(true)}
              disabled={activeFilterCount === 0}
            >
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </div>

        {/* Save Filter Dialog */}
        {showSaveDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Save Filter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Filter Name</Label>
                  <Input
                    placeholder="Enter filter name..."
                    value={newFilterName}
                    onChange={(e) => setNewFilterName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveCurrentFilters()}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveCurrentFilters} disabled={!newFilterName.trim()}>
                    Save Filter
                  </Button>
                  <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { defaultFilters };