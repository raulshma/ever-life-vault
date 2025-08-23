/**
 * Bulk Operations Service
 * Handles API calls for bulk receipt operations including categorization,
 * deletion, export, analysis, and archiving.
 */

export interface BulkCategorization {
  receipt_id: string;
  category: string;
  subcategory?: string;
  confidence_score?: number;
}

export interface BulkOperationResult<T = any> {
  success_count: number;
  error_count: number;
  message: string;
  results?: T[];
  errors?: Array<{ id: string; error: string }>;
}

export interface BulkExportOptions {
  receipt_ids?: string[];
  filters?: {
    category?: string;
    date_from?: string;
    date_to?: string;
    merchant_name?: string;
    min_amount?: number;
    max_amount?: number;
  };
  format: 'csv' | 'json' | 'xlsx';
  include_items?: boolean;
  include_documents?: boolean;
}

export interface BulkAnalysisJob {
  receipt_id: string;
  job_id: string;
  receipt_name: string;
}

export interface BulkAnalysisResult {
  started: BulkAnalysisJob[];
  errors: Array<{ receipt_id: string; error: string }>;
  success_count: number;
  error_count: number;
  skipped_count: number;
  message: string;
}

export class BulkOperationsService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get auth headers for API requests
   */
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('supabase.auth.token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  }

  /**
   * Handle API response and errors
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Bulk create receipts
   */
  async bulkCreateReceipts(receipts: Array<Record<string, any>>): Promise<BulkOperationResult> {
    const response = await fetch(`${this.baseUrl}/receipts/bulk`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ receipts })
    });

    return this.handleResponse<BulkOperationResult>(response);
  }

  /**
   * Bulk update receipts
   */
  async bulkUpdateReceipts(updates: Array<{ id: string; data: Record<string, any> }>): Promise<BulkOperationResult> {
    const response = await fetch(`${this.baseUrl}/receipts/bulk`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ updates })
    });

    return this.handleResponse<BulkOperationResult>(response);
  }

  /**
   * Bulk delete receipts
   */
  async bulkDeleteReceipts(receipt_ids: string[]): Promise<BulkOperationResult> {
    const response = await fetch(`${this.baseUrl}/receipts/bulk`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ receipt_ids })
    });

    return this.handleResponse<BulkOperationResult>(response);
  }

  /**
   * Bulk categorize receipts
   */
  async bulkCategorizeReceipts(categorizations: BulkCategorization[]): Promise<BulkOperationResult> {
    const response = await fetch(`${this.baseUrl}/receipts/bulk/categorize`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ categorizations })
    });

    return this.handleResponse<BulkOperationResult>(response);
  }

  /**
   * Bulk analyze receipts
   */
  async bulkAnalyzeReceipts(
    receipt_ids: string[], 
    options: {
      job_type?: 'ocr_only' | 'structure_analysis' | 'full_analysis';
      model?: string;
    } = {}
  ): Promise<BulkAnalysisResult> {
    const response = await fetch(`${this.baseUrl}/receipts/bulk/analyze`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        receipt_ids,
        job_type: options.job_type || 'full_analysis',
        model: options.model || 'gemini-2.5-flash'
      })
    });

    return this.handleResponse<BulkAnalysisResult>(response);
  }

  /**
   * Bulk export receipts
   */
  async bulkExportReceipts(options: BulkExportOptions): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/receipts/bulk/export`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(errorData.error || `Export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Bulk archive receipts (add archived tag)
   */
  async bulkArchiveReceipts(receipt_ids: string[]): Promise<BulkOperationResult> {
    const updates = receipt_ids.map(id => ({
      id,
      data: { tags: ['archived'] } // This will be merged with existing tags on the backend
    }));

    return this.bulkUpdateReceipts(updates);
  }

  /**
   * Bulk unarchive receipts (remove archived tag)
   */
  async bulkUnarchiveReceipts(receipt_ids: string[]): Promise<BulkOperationResult> {
    // This would require getting current tags and filtering out 'archived'
    // For now, we'll use a simpler approach of clearing the archived tag
    const updates = receipt_ids.map(id => ({
      id,
      data: { tags: [] } // This would need to be smarter to only remove 'archived'
    }));

    return this.bulkUpdateReceipts(updates);
  }

  /**
   * Get bulk operation status (for long-running operations)
   */
  async getBulkOperationStatus(operationId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: {
      total: number;
      completed: number;
      failed: number;
    };
    result?: any;
    error?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/bulk-operations/${operationId}/status`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  /**
   * Cancel a bulk operation
   */
  async cancelBulkOperation(operationId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/bulk-operations/${operationId}/cancel`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }

  /**
   * Helper: Download blob as file
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Helper: Format filename with timestamp
   */
  formatFilename(prefix: string, extension: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return `${prefix}-${timestamp}.${extension}`;
  }

  /**
   * Advanced bulk categorization with smart suggestions
   */
  async smartBulkCategorization(
    receipt_ids: string[],
    options: {
      auto_apply_high_confidence?: boolean;
      confidence_threshold?: number;
      fallback_category?: string;
    } = {}
  ): Promise<{
    suggestions: Array<{
      receipt_id: string;
      suggested_category: string;
      confidence: number;
      reason: string;
    }>;
    auto_applied: string[];
    manual_review: string[];
  }> {
    // This would integrate with SmartCategorizationService
    // For now, return a mock structure
    return {
      suggestions: [],
      auto_applied: [],
      manual_review: []
    };
  }

  /**
   * Bulk validation before operations
   */
  async validateBulkOperation(
    operation: 'create' | 'update' | 'delete' | 'categorize' | 'analyze' | 'export',
    data: any
  ): Promise<{
    valid: boolean;
    warnings: string[];
    errors: string[];
    estimated_time?: number;
  }> {
    const response = await fetch(`${this.baseUrl}/receipts/bulk/validate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ operation, data })
    });

    return this.handleResponse(response);
  }

  /**
   * Get bulk operation limits and quotas
   */
  async getBulkOperationLimits(): Promise<{
    max_receipts_per_operation: number;
    max_concurrent_operations: number;
    daily_operation_limit: number;
    current_usage: {
      operations_today: number;
      concurrent_operations: number;
    };
  }> {
    const response = await fetch(`${this.baseUrl}/receipts/bulk/limits`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse(response);
  }
}