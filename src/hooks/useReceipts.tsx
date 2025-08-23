import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import type { Tables } from '@/integrations/supabase/types';

// Use Supabase generated types
type ReceiptBase = Tables<'receipts'>;
type ReceiptDocument = Tables<'receipt_documents'>;
type ReceiptItem = Tables<'receipt_items'>;
type Merchant = Tables<'merchants'>;
type ExpenseCategory = Tables<'expense_categories'>;
type AnalysisJob = Tables<'receipt_analysis_jobs'>;

// Extended receipt type with documents
type Receipt = ReceiptBase & {
  receipt_documents?: ReceiptDocument[];
  merchants?: Merchant;
};

// Custom types for API operations
interface ReceiptFilters {
  category?: string;
  date_from?: string;
  date_to?: string;
  merchant?: string;
  min_amount?: number;
  max_amount?: number;
  is_business_expense?: boolean;
  analysis_status?: string;
}

interface ReceiptFormData {
  name: string;
  description: string;
  total_amount: number;
  currency: string;
  receipt_date: string;
  merchant_name: string;
  category: string;
  tax_amount?: number;
  payment_method?: string;
  is_business_expense: boolean;
  is_tax_deductible: boolean;
  notes: string;
}

// Analysis result types
interface MerchantInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  tax_id?: string | null;
}

interface TransactionInfo {
  date: string;
  time?: string | null;
  total_amount: number;
  currency: string;
  tax_amount?: number | null;
  tax_rate?: number | null;
  tip_amount?: number | null;
  subtotal?: number | null;
  payment_method?: string | null;
}

interface ItemInfo {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string | null;
  sku?: string | null;
  tax_amount?: number | null;
  line_number: number;
}

interface ClassificationInfo {
  category: string;
  subcategory?: string | null;
  is_business_expense: boolean;
  is_tax_deductible: boolean;
  confidence_score: number;
}

interface MetadataInfo {
  receipt_number?: string | null;
  cashier?: string | null;
  register?: string | null;
  discounts?: number | null;
  loyalty_program?: string | null;
  special_offers: string[];
}

interface ReceiptAnalysisResult {
  merchant: MerchantInfo;
  transaction: TransactionInfo;
  items: ItemInfo[];
  classification: ClassificationInfo;
  metadata: MetadataInfo;
}

interface DocumentInfo {
  type: 'warranty' | 'manual' | 'invoice' | 'guarantee' | 'certificate' | 'other';
  title?: string | null;
  language?: string | null;
  page_count?: number | null;
  format?: string | null;
}

interface ProductInfo {
  name?: string | null;
  brand?: string | null;
  model_number?: string | null;
  serial_number?: string | null;
  category?: string | null;
  description?: string | null;
}

interface WarrantyInfo {
  duration?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  coverage_type?: string | null;
  terms: string[];
  exclusions: string[];
  claim_process?: string | null;
}

interface DatesInfo {
  purchase_date?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  registration_deadline?: string | null;
}

interface SupportInfo {
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
}

interface ReferencesInfo {
  document_number?: string | null;
  certificate_number?: string | null;
  policy_number?: string | null;
  order_number?: string | null;
}

interface KeyInformation {
  category: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
}

interface AnalysisMetadata {
  confidence_score: number;
  extracted_text_length: number;
  processing_notes: string[];
  suggested_actions: string[];
}

interface DocumentAnalysisResult {
  document_info: DocumentInfo;
  product: ProductInfo;
  warranty: WarrantyInfo;
  dates: DatesInfo;
  support: SupportInfo;
  references: ReferencesInfo;
  key_information: KeyInformation[];
  analysis_metadata: AnalysisMetadata;
}

const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8787';

export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [quickAnalyzing, setQuickAnalyzing] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, limit: 50, hasMore: true });
  const [searchCache, setSearchCache] = useState<Map<string, Receipt[]>>(new Map());
  
  const { user, getToken } = useAuth();
  const { toast } = useToast();

  // Helper function to make authenticated requests
  const makeRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }, [getToken]);

  // Fetch receipts with optional filters and enhanced caching
  const fetchReceipts = useCallback(async (
    filters: ReceiptFilters = {},
    paginationOptions = { limit: 50, offset: 0, append: false }
  ) => {
    if (!user) return;

    // Create cache key for this query
    const cacheKey = JSON.stringify({ filters, ...paginationOptions });
    
    // Check cache for exact match (only for non-append operations)
    if (!paginationOptions.append && searchCache.has(cacheKey)) {
      const cachedData = searchCache.get(cacheKey)!;
      setReceipts(cachedData);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        limit: paginationOptions.limit.toString(),
        offset: paginationOptions.offset.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });

      const data = await makeRequest(`/api/receipts?${queryParams}`);
      const newReceipts = data.receipts || [];
      
      if (paginationOptions.append) {
        // Append to existing receipts for pagination
        setReceipts(prev => {
          const combined = [...prev, ...newReceipts];
          // Cache the combined result
          setSearchCache(cache => new Map(cache.set(cacheKey, combined)));
          return combined;
        });
      } else {
        // Replace receipts for new search
        setReceipts(newReceipts);
        // Cache the result
        setSearchCache(cache => new Map(cache.set(cacheKey, newReceipts)));
      }
      
      // Update pagination state
      setPagination(prev => ({
        ...prev,
        hasMore: newReceipts.length === paginationOptions.limit,
        page: paginationOptions.append ? prev.page + 1 : 0
      }));
      
    } catch (error) {
      console.error('Error fetching receipts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch receipts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, makeRequest, toast, searchCache]);

  // Fetch expense categories
  const fetchCategories = useCallback(async () => {
    if (!user) return;

    try {
      const data = await makeRequest('/api/expense-categories');
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: "Error",
        description: "Failed to fetch expense categories",
        variant: "destructive",
      });
    }
  }, [user, makeRequest, toast]);

  // Fetch merchants
  const fetchMerchants = useCallback(async () => {
    if (!user) return;

    try {
      const data = await makeRequest('/api/merchants');
      setMerchants(data.merchants || []);
    } catch (error) {
      console.error('Error fetching merchants:', error);
      toast({
        title: "Error",
        description: "Failed to fetch merchants",
        variant: "destructive",
      });
    }
  }, [user, makeRequest, toast]);

  // Get single receipt
  const getReceipt = useCallback(async (id: string): Promise<Receipt | null> => {
    try {
      const data = await makeRequest(`/api/receipts/${id}`);
      return data.receipt;
    } catch (error) {
      console.error('Error fetching receipt:', error);
      toast({
        title: "Error",
        description: "Failed to fetch receipt",
        variant: "destructive",
      });
      return null;
    }
  }, [makeRequest, toast]);

  // Create new receipt
  const createReceipt = useCallback(async (receiptData: Partial<Receipt>): Promise<Receipt | null> => {
    try {
      const data = await makeRequest('/api/receipts', {
        method: 'POST',
        body: JSON.stringify(receiptData),
      });

      const newReceipt = data.receipt;
      setReceipts(prev => [newReceipt, ...prev]);
      
      toast({
        title: "Success",
        description: "Receipt created successfully",
      });

      return newReceipt;
    } catch (error) {
      console.error('Error creating receipt:', error);
      toast({
        title: "Error",
        description: "Failed to create receipt",
        variant: "destructive",
      });
      return null;
    }
  }, [makeRequest, toast]);

  // Update receipt
  const updateReceipt = useCallback(async (id: string, receiptData: Partial<Receipt>): Promise<Receipt | null> => {
    try {
      const data = await makeRequest(`/api/receipts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(receiptData),
      });

      const updatedReceipt = data.receipt;
      setReceipts(prev => prev.map(r => r.id === id ? updatedReceipt : r));
      
      toast({
        title: "Success",
        description: "Receipt updated successfully",
      });

      return updatedReceipt;
    } catch (error) {
      console.error('Error updating receipt:', error);
      toast({
        title: "Error",
        description: "Failed to update receipt",
        variant: "destructive",
      });
      return null;
    }
  }, [makeRequest, toast]);

  // Delete receipt
  const deleteReceipt = useCallback(async (id: string): Promise<boolean> => {
    try {
      await makeRequest(`/api/receipts/${id}`, {
        method: 'DELETE',
      });

      setReceipts(prev => prev.filter(r => r.id !== id));
      
      toast({
        title: "Success",
        description: "Receipt deleted successfully",
      });

      return true;
    } catch (error) {
      console.error('Error deleting receipt:', error);
      toast({
        title: "Error",
        description: "Failed to delete receipt",
        variant: "destructive",
      });
      return false;
    }
  }, [makeRequest, toast]);

  // Upload receipt image and create receipt
  const uploadReceiptImage = useCallback(async (
    file: File, 
    receiptData: Partial<Receipt>
  ): Promise<Receipt | null> => {
    setUploading(true);
    try {
      // First, upload the image to Supabase storage
      // This would typically be done via the existing inventory upload pattern
      // For now, we'll assume the image URL is provided or handled separately
      
      const newReceipt = await createReceipt({
        ...receiptData,
        image_url: receiptData.image_url, // This should be set from file upload
        file_size: file.size,
        mime_type: file.type,
        analysis_status: 'pending',
      });

      return newReceipt;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast({
        title: "Error",
        description: "Failed to upload receipt",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  }, [createReceipt, toast]);

  // Trigger AI analysis
  const analyzeReceipt = useCallback(async (
    receiptId: string, 
    jobType: 'ocr_only' | 'structure_analysis' | 'full_analysis' = 'full_analysis'
  ): Promise<boolean> => {
    setAnalyzing(prev => new Set(prev).add(receiptId));
    
    try {
      await makeRequest(`/api/receipts/${receiptId}/analyze`, {
        method: 'POST',
        body: JSON.stringify({ job_type: jobType }),
      });

      // Update receipt status locally
      setReceipts(prev => prev.map(r => 
        r.id === receiptId 
          ? { ...r, analysis_status: 'processing' as const }
          : r
      ));

      toast({
        title: "Analysis Started",
        description: "Receipt analysis has been queued. Results will appear shortly.",
      });

      return true;
    } catch (error) {
      console.error('Error starting analysis:', error);
      toast({
        title: "Error",
        description: "Failed to start receipt analysis",
        variant: "destructive",
      });
      return false;
    } finally {
      setAnalyzing(prev => {
        const newSet = new Set(prev);
        newSet.delete(receiptId);
        return newSet;
      });
    }
  }, [makeRequest, toast]);

  // Get analysis status/results
  const getAnalysisStatus = useCallback(async (receiptId: string): Promise<AnalysisJob | null> => {
    try {
      const data = await makeRequest(`/api/receipts/${receiptId}/analysis`);
      return data.analysis;
    } catch (error) {
      console.error('Error fetching analysis status:', error);
      return null;
    }
  }, [makeRequest]);

  // Calculate expense totals and statistics with memoization
  const getExpenseStats = useMemo(() => {
    const stats = {
      totalAmount: 0,
      totalTax: 0,
      businessExpenses: 0,
      personalExpenses: 0,
      reimbursableAmount: 0,
      receiptCount: receipts.length,
      categoryCounts: {} as Record<string, number>,
      monthlyTotals: {} as Record<string, number>,
    };

    receipts.forEach(receipt => {
      stats.totalAmount += receipt.total_amount;
      stats.totalTax += receipt.tax_amount || 0;
      
      if (receipt.is_business_expense) {
        stats.businessExpenses += receipt.total_amount;
      } else {
        stats.personalExpenses += receipt.total_amount;
      }
      
      if (receipt.is_reimbursable) {
        stats.reimbursableAmount += receipt.total_amount;
      }

      // Category counts
      stats.categoryCounts[receipt.category] = (stats.categoryCounts[receipt.category] || 0) + 1;

      // Monthly totals
      const month = receipt.receipt_date.substring(0, 7); // YYYY-MM
      stats.monthlyTotals[month] = (stats.monthlyTotals[month] || 0) + receipt.total_amount;
    });

    return stats;
  }, [receipts]);

  // Initial load with dependency optimization
  useEffect(() => {
    if (user) {
      // Clear cache on user change
      setSearchCache(new Map());
      setPagination({ page: 0, limit: 50, hasMore: true });
      
      Promise.all([
        fetchReceipts(),
        fetchCategories(),
        fetchMerchants(),
      ]);
    }
  }, [user]); // Removed other dependencies to prevent unnecessary re-renders

  // Quick analysis for form auto-fill
  const quickAnalyzeReceipt = useCallback(async (imageUrl: string): Promise<ReceiptFormData | null> => {
    if (!user) return null;

    setQuickAnalyzing(true);
    try {
      const data = await makeRequest('/api/receipts/quick-analyze', {
        method: 'POST',
        body: JSON.stringify({ image_url: imageUrl }),
      });

      return data.formData;
    } catch (error) {
      console.error('Error analyzing receipt for form:', error);
      toast({
        title: "Analysis Error",
        description: "Failed to analyze receipt for auto-fill",
        variant: "destructive",
      });
      return null;
    } finally {
      setQuickAnalyzing(false);
    }
  }, [user, makeRequest, toast]);

  // Receipt document management
  const getReceiptDocuments = useCallback(async (receiptId: string): Promise<ReceiptDocument[]> => {
    if (!user) return [];

    try {
      const data = await makeRequest(`/api/receipts/${receiptId}/documents`);
      return data.documents || [];
    } catch (error) {
      console.error('Error fetching receipt documents:', error);
      toast({
        title: "Error",
        description: "Failed to fetch receipt documents",
        variant: "destructive",
      });
      return [];
    }
  }, [user, makeRequest, toast]);

  const addReceiptDocument = useCallback(async (receiptId: string, documentData: Omit<ReceiptDocument, 'id' | 'receipt_id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ReceiptDocument | null> => {
    if (!user) return null;

    try {
      const data = await makeRequest(`/api/receipts/${receiptId}/documents`, {
        method: 'POST',
        body: JSON.stringify(documentData),
      });

      // Update the local state
      setReceipts(prev => prev.map(receipt => {
        if (receipt.id === receiptId) {
          return {
            ...receipt,
            receipt_documents: [...(receipt.receipt_documents || []), data.document]
          };
        }
        return receipt;
      }));

      toast({
        title: "Success",
        description: "Document attached to receipt",
      });

      return data.document;
    } catch (error) {
      console.error('Error adding receipt document:', error);
      toast({
        title: "Error",
        description: "Failed to attach document to receipt",
        variant: "destructive",
      });
      return null;
    }
  }, [user, makeRequest, toast]);

  const updateReceiptDocument = useCallback(async (receiptId: string, documentId: string, updates: Partial<ReceiptDocument>): Promise<ReceiptDocument | null> => {
    if (!user) return null;

    try {
      const data = await makeRequest(`/api/receipts/${receiptId}/documents/${documentId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      // Update the local state
      setReceipts(prev => prev.map(receipt => {
        if (receipt.id === receiptId) {
          return {
            ...receipt,
            receipt_documents: (receipt.receipt_documents || []).map(doc => 
              doc.id === documentId ? { ...doc, ...data.document } : doc
            )
          };
        }
        return receipt;
      }));

      toast({
        title: "Success",
        description: "Document updated successfully",
      });

      return data.document;
    } catch (error) {
      console.error('Error updating receipt document:', error);
      toast({
        title: "Error",
        description: "Failed to update document",
        variant: "destructive",
      });
      return null;
    }
  }, [user, makeRequest, toast]);

  const deleteReceiptDocument = useCallback(async (receiptId: string, documentId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      await makeRequest(`/api/receipts/${receiptId}/documents/${documentId}`, {
        method: 'DELETE',
      });

      // Update the local state
      setReceipts(prev => prev.map(receipt => {
        if (receipt.id === receiptId) {
          return {
            ...receipt,
            receipt_documents: (receipt.receipt_documents || []).filter(doc => doc.id !== documentId)
          };
        }
        return receipt;
      }));

      toast({
        title: "Success",
        description: "Document removed from receipt",
      });

      return true;
    } catch (error) {
      console.error('Error deleting receipt document:', error);
      toast({
        title: "Error",
        description: "Failed to remove document",
        variant: "destructive",
      });
      return false;
    }
  }, [user, makeRequest, toast]);

  // Document analysis functions
  const analyzeDocument = useCallback(async (receiptId: string, documentId: string): Promise<DocumentAnalysisResult | null> => {
    if (!user) return null;

    try {
      const data = await makeRequest(`/api/receipts/${receiptId}/documents/${documentId}/analyze`, {
        method: 'POST',
      });

      // Update the local state with analysis results
      setReceipts(prev => prev.map(receipt => {
        if (receipt.id === receiptId) {
          return {
            ...receipt,
            receipt_documents: (receipt.receipt_documents || []).map(doc => 
              doc.id === documentId ? { 
                ...doc, 
                analysis_status: 'completed' as const,
                ai_analysis_data: data.analysis,
                ai_confidence_score: data.analysis?.analysis_metadata?.confidence_score
              } : doc
            )
          };
        }
        return receipt;
      }));

      toast({
        title: "Success",
        description: "Document analysis completed",
      });

      return data.analysis;
    } catch (error) {
      console.error('Error analyzing document:', error);
      
      // Update status to failed
      setReceipts(prev => prev.map(receipt => {
        if (receipt.id === receiptId) {
          return {
            ...receipt,
            receipt_documents: (receipt.receipt_documents || []).map(doc => 
              doc.id === documentId ? { ...doc, analysis_status: 'failed' as const } : doc
            )
          };
        }
        return receipt;
      }));

      toast({
        title: "Error",
        description: "Failed to analyze document",
        variant: "destructive",
      });
      return null;
    }
  }, [user, makeRequest, toast]);

  const analyzeAllDocuments = useCallback(async (receiptId: string): Promise<DocumentAnalysisResult[] | null> => {
    if (!user) return null;

    try {
      const data = await makeRequest(`/api/receipts/${receiptId}/analyze-documents`, {
        method: 'POST',
      });

      // Update the local state with analysis results
      setReceipts(prev => prev.map(receipt => {
        if (receipt.id === receiptId) {
          const updatedDocuments = (receipt.receipt_documents || []).map(doc => {
            const analysisResult = data.results?.find((r: { documentId: string; analysis: DocumentAnalysisResult }) => r.documentId === doc.id);
            if (analysisResult) {
              return {
                ...doc,
                analysis_status: 'completed' as const,
                ai_analysis_data: analysisResult.analysis,
                ai_confidence_score: analysisResult.analysis?.analysis_metadata?.confidence_score
              };
            }
            return doc;
          });

          return {
            ...receipt,
            receipt_documents: updatedDocuments
          };
        }
        return receipt;
      }));

      toast({
        title: "Success",
        description: `Analysis completed for ${data.results?.length || 0} documents`,
      });

      return data.results;
    } catch (error) {
      console.error('Error analyzing documents:', error);
      toast({
        title: "Error",
        description: "Failed to analyze documents",
        variant: "destructive",
      });
      return null;
    }
  }, [user, makeRequest, toast]);

  // Load more receipts for infinite scroll
  const loadMoreReceipts = useCallback(async (filters: ReceiptFilters = {}) => {
    if (!pagination.hasMore || loading) return;
    
    await fetchReceipts(filters, {
      limit: pagination.limit,
      offset: (pagination.page + 1) * pagination.limit,
      append: true
    });
  }, [fetchReceipts, pagination, loading]);
  
  // Clear cache when filters change significantly
  const clearCache = useCallback(() => {
    setSearchCache(new Map());
    setPagination({ page: 0, limit: 50, hasMore: true });
  }, []);

  return {
    // Data
    receipts,
    categories,
    merchants,
    
    // Loading states
    loading,
    uploading,
    analyzing,
    quickAnalyzing,
    
    // Pagination
    pagination,
    loadMoreReceipts,
    clearCache,
    
    // Actions
    fetchReceipts,
    getReceipt,
    createReceipt,
    updateReceipt,
    deleteReceipt,
    uploadReceiptImage,
    analyzeReceipt,
    getAnalysisStatus,
    quickAnalyzeReceipt,
    
    // Document management
    getReceiptDocuments,
    addReceiptDocument,
    updateReceiptDocument,
    deleteReceiptDocument,
    analyzeDocument,
    analyzeAllDocuments,
    
    // Helper functions
    getExpenseStats,
    
    // Refresh functions
    refetch: () => Promise.all([
      fetchReceipts(),
      fetchCategories(),
      fetchMerchants(),
    ]),
  };
}