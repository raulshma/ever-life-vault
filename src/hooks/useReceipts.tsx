import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

// Types for receipt management
export interface ReceiptDocument {
  id: string;
  receipt_id: string;
  user_id: string;
  name: string;
  description?: string;
  document_type: 'warranty' | 'manual' | 'invoice' | 'guarantee' | 'certificate' | 'other';
  file_path: string;
  file_size?: number;
  mime_type?: string;
  original_filename?: string;
  expiry_date?: string;
  issue_date?: string;
  document_number?: string;
  issuer?: string;
  tags: string[];
  notes?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  total_amount: number;
  currency: string;
  receipt_date: string;
  merchant_name?: string;
  merchant_address?: string;
  merchant_phone?: string;
  merchant_tax_id?: string;
  image_url?: string;
  image_path?: string;
  file_size?: number;
  mime_type?: string;
  ocr_raw_text?: string;
  ai_analysis_data?: any;
  ai_confidence_score?: number;
  analysis_status: 'pending' | 'processing' | 'completed' | 'failed';
  category: string;
  subcategory?: string;
  tags: string[];
  tax_amount?: number;
  tax_rate?: number;
  pre_tax_amount?: number;
  tip_amount?: number;
  payment_method?: string;
  is_business_expense: boolean;
  is_reimbursable: boolean;
  is_tax_deductible: boolean;
  reimbursement_status: 'not_applicable' | 'pending' | 'submitted' | 'approved' | 'paid' | 'rejected';
  notes?: string;
  created_at: string;
  updated_at: string;
  receipt_items?: ReceiptItem[];
  receipt_documents?: ReceiptDocument[];
  merchants?: Merchant;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sku?: string;
  barcode?: string;
  product_category?: string;
  tax_amount?: number;
  is_taxable: boolean;
  line_number?: number;
  created_at: string;
  updated_at: string;
}

export interface Merchant {
  id: string;
  user_id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country: string;
  phone?: string;
  email?: string;
  website?: string;
  tax_id?: string;
  business_type?: string;
  category?: string;
  logo_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCategory {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  parent_category_id?: string;
  is_tax_deductible: boolean;
  is_business_category: boolean;
  default_payment_method?: string;
  monthly_budget_limit?: number;
  yearly_budget_limit?: number;
  color?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnalysisJob {
  id: string;
  receipt_id: string;
  user_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  job_type: 'ocr_only' | 'structure_analysis' | 'full_analysis';
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  retry_count: number;
  ocr_result?: any;
  analysis_result?: any;
  confidence_scores?: any;
  ai_model_used?: string;
  processing_duration_ms?: number;
  created_at: string;
  updated_at: string;
}

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

const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8787';

export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [quickAnalyzing, setQuickAnalyzing] = useState(false);
  
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

  // Fetch receipts with optional filters
  const fetchReceipts = useCallback(async (filters: ReceiptFilters = {}, pagination = { limit: 50, offset: 0 }) => {
    if (!user) return;

    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
        ),
      });

      const data = await makeRequest(`/api/receipts?${queryParams}`);
      setReceipts(data.receipts || []);
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
  }, [user, makeRequest, toast]);

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

  // Calculate expense totals and statistics
  const getExpenseStats = useCallback(() => {
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

  // Initial load
  useEffect(() => {
    if (user) {
      Promise.all([
        fetchReceipts(),
        fetchCategories(),
        fetchMerchants(),
      ]);
    }
  }, [user, fetchReceipts, fetchCategories, fetchMerchants]);

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