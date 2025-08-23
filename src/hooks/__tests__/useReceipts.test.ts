import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReceipts } from '../../hooks/useReceipts';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  storage: {
    from: vi.fn().mockReturnThis(),
    upload: vi.fn(),
    getPublicUrl: vi.fn()
  }
};

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient
}));

// Mock useAuth hook
const mockUser = { id: 'test-user-id', email: 'test@example.com' };
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser })
}));

// Mock useToast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

describe('useReceipts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset default mock implementations
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ id: 'new-receipt-id' }],
          error: null
        })
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'updated-receipt-id' }],
            error: null
          })
        })
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null
        })
      })
    });
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useReceipts());

      expect(result.current.receipts).toEqual([]);
      expect(result.current.categories).toEqual([]);
      expect(result.current.merchants).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.uploading).toBeInstanceOf(Set);
      expect(result.current.analyzing).toBeInstanceOf(Set);
    });

    it('should fetch data when user is available', async () => {
      const mockReceipts = [
        {
          id: '1',
          name: 'Test Receipt',
          total_amount: 10.50,
          receipt_date: '2024-01-15',
          category: 'food_dining'
        }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockReceipts,
            error: null
          })
        })
      });

      const { result } = renderHook(() => useReceipts());

      await waitFor(() => {
        expect(result.current.receipts).toEqual(mockReceipts);
      });
    });
  });

  describe('createReceipt', () => {
    it('should create a new receipt successfully', async () => {
      const newReceipt = {
        name: 'New Receipt',
        total_amount: 25.99,
        receipt_date: '2024-01-20',
        category: 'food_dining',
        merchant_name: 'Test Store'
      };

      const createdReceipt = {
        id: 'new-receipt-id',
        ...newReceipt,
        user_id: mockUser.id
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [createdReceipt],
            error: null
          })
        })
      });

      const { result } = renderHook(() => useReceipts());

      let createdResult;
      await act(async () => {
        createdResult = await result.current.createReceipt(newReceipt);
      });

      expect(createdResult).toEqual(createdReceipt);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('receipts');
    });

    it('should handle creation errors', async () => {
      const newReceipt = {
        name: 'New Receipt',
        total_amount: 25.99,
        receipt_date: '2024-01-20'
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Creation failed' }
          })
        })
      });

      const { result } = renderHook(() => useReceipts());

      await expect(async () => {
        await act(async () => {
          await result.current.createReceipt(newReceipt);
        });
      }).rejects.toThrow('Creation failed');
    });

    it('should validate required fields', async () => {
      const invalidReceipt = {
        name: '', // Empty name
        total_amount: 0 // Invalid amount
      };

      const { result } = renderHook(() => useReceipts());

      await expect(async () => {
        await act(async () => {
          await result.current.createReceipt(invalidReceipt);
        });
      }).rejects.toThrow();
    });
  });

  describe('updateReceipt', () => {
    it('should update an existing receipt successfully', async () => {
      const receiptId = 'existing-receipt-id';
      const updateData = {
        name: 'Updated Receipt',
        total_amount: 30.00,
        category: 'transportation'
      };

      const updatedReceipt = {
        id: receiptId,
        ...updateData,
        user_id: mockUser.id,
        updated_at: new Date().toISOString()
      };

      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [updatedReceipt],
              error: null
            })
          })
        })
      });

      const { result } = renderHook(() => useReceipts());

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateReceipt(receiptId, updateData);
      });

      expect(updateResult).toEqual(updatedReceipt);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('receipts');
    });

    it('should handle update errors', async () => {
      const receiptId = 'non-existent-id';
      const updateData = { name: 'Updated Receipt' };

      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Receipt not found' }
            })
          })
        })
      });

      const { result } = renderHook(() => useReceipts());

      await expect(async () => {
        await act(async () => {
          await result.current.updateReceipt(receiptId, updateData);
        });
      }).rejects.toThrow('Receipt not found');
    });
  });

  describe('deleteReceipt', () => {
    it('should delete a receipt successfully', async () => {
      const receiptId = 'receipt-to-delete';

      mockSupabaseClient.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null
          })
        })
      });

      const { result } = renderHook(() => useReceipts());

      await act(async () => {
        await result.current.deleteReceipt(receiptId);
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('receipts');
    });

    it('should handle deletion errors', async () => {
      const receiptId = 'non-existent-id';

      mockSupabaseClient.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: 'Deletion failed' }
          })
        })
      });

      const { result } = renderHook(() => useReceipts());

      await expect(async () => {
        await act(async () => {
          await result.current.deleteReceipt(receiptId);
        });
      }).rejects.toThrow('Deletion failed');
    });
  });

  describe('getReceipt', () => {
    it('should fetch a single receipt by ID', async () => {
      const receiptId = 'test-receipt-id';
      const receipt = {
        id: receiptId,
        name: 'Test Receipt',
        total_amount: 15.50,
        category: 'food_dining'
      };

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: receipt,
              error: null
            })
          })
        })
      });

      const { result } = renderHook(() => useReceipts());

      let fetchedReceipt;
      await act(async () => {
        fetchedReceipt = await result.current.getReceipt(receiptId);
      });

      expect(fetchedReceipt).toEqual(receipt);
    });

    it('should handle receipt not found', async () => {
      const receiptId = 'non-existent-id';

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'No rows returned' }
            })
          })
        })
      });

      const { result } = renderHook(() => useReceipts());

      await expect(async () => {
        await act(async () => {
          await result.current.getReceipt(receiptId);
        });
      }).rejects.toThrow('No rows returned');
    });
  });

  describe('uploadReceiptImage', () => {
    it('should upload image successfully', async () => {
      const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      const mockUrl = 'https://example.com/receipt.jpg';

      mockSupabaseClient.storage = {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: mockUrl }
          })
        })
      };

      const { result } = renderHook(() => useReceipts());

      let uploadedUrl;
      await act(async () => {
        uploadedUrl = await result.current.uploadReceiptImage(file);
      });

      expect(uploadedUrl).toBe(mockUrl);
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('receipts');
    });

    it('should handle upload errors', async () => {
      const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });

      mockSupabaseClient.storage = {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ 
            error: { message: 'Upload failed' }
          })
        })
      };

      const { result } = renderHook(() => useReceipts());

      await expect(async () => {
        await act(async () => {
          await result.current.uploadReceiptImage(file);
        });
      }).rejects.toThrow('Upload failed');
    });

    it('should validate file type', async () => {
      const invalidFile = new File(['test'], 'document.pdf', { type: 'application/pdf' });

      const { result } = renderHook(() => useReceipts());

      await expect(async () => {
        await act(async () => {
          await result.current.uploadReceiptImage(invalidFile);
        });
      }).rejects.toThrow();
    });
  });

  describe('analyzeReceipt', () => {
    it('should start analysis and track progress', async () => {
      const receiptId = 'receipt-to-analyze';

      // Mock fetch for the analysis API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const { result } = renderHook(() => useReceipts());

      await act(async () => {
        await result.current.analyzeReceipt(receiptId);
      });

      expect(result.current.analyzing.has(receiptId)).toBe(false); // Should be removed after completion
      expect(global.fetch).toHaveBeenCalledWith('/api/receipts/analyze', expect.any(Object));
    });

    it('should handle analysis errors', async () => {
      const receiptId = 'receipt-to-analyze';

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Analysis failed' })
      });

      const { result } = renderHook(() => useReceipts());

      await expect(async () => {
        await act(async () => {
          await result.current.analyzeReceipt(receiptId);
        });
      }).rejects.toThrow('Analysis failed');
    });
  });

  describe('getExpenseStats', () => {
    it('should calculate expense statistics correctly', () => {
      const mockReceipts = [
        {
          id: '1',
          total_amount: 50.00,
          tax_amount: 4.00,
          is_business_expense: true,
          is_reimbursable: false,
          receipt_date: '2024-01-15',
          category: 'food_dining'
        },
        {
          id: '2',
          total_amount: 30.00,
          tax_amount: 2.40,
          is_business_expense: false,
          is_reimbursable: true,
          receipt_date: '2024-01-20',
          category: 'transportation'
        }
      ];

      // Mock the internal receipts state
      const { result } = renderHook(() => useReceipts());
      
      // Simulate having receipts in state
      act(() => {
        (result.current as any).setReceipts(mockReceipts);
      });

      const stats = result.current.getExpenseStats();

      expect(stats.receiptCount).toBe(2);
      expect(stats.totalAmount).toBe(80.00);
      expect(stats.totalTax).toBe(6.40);
      expect(stats.businessExpenses).toBe(50.00);
      expect(stats.personalExpenses).toBe(30.00);
      expect(stats.reimbursableAmount).toBe(30.00);
      expect(stats.categoryCounts['food_dining']).toBe(1);
      expect(stats.categoryCounts['transportation']).toBe(1);
    });

    it('should handle empty receipts', () => {
      const { result } = renderHook(() => useReceipts());

      const stats = result.current.getExpenseStats();

      expect(stats.receiptCount).toBe(0);
      expect(stats.totalAmount).toBe(0);
      expect(stats.totalTax).toBe(0);
      expect(stats.businessExpenses).toBe(0);
      expect(stats.personalExpenses).toBe(0);
      expect(stats.reimbursableAmount).toBe(0);
      expect(Object.keys(stats.categoryCounts)).toHaveLength(0);
    });
  });

  describe('getAnalysisStatus', () => {
    it('should return correct analysis status', () => {
      const { result } = renderHook(() => useReceipts());

      // Add receipt to analyzing set
      act(() => {
        (result.current as any).setAnalyzing(new Set(['receipt-1']));
      });

      expect(result.current.getAnalysisStatus('receipt-1')).toBe('analyzing');
      expect(result.current.getAnalysisStatus('receipt-2')).toBe('idle');
    });
  });

  describe('Loading States', () => {
    it('should manage loading state during fetch operations', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(promise)
        })
      });

      const { result } = renderHook(() => useReceipts());

      // Loading should start as false, become true, then false again
      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.fetchReceipts();
      });

      // Resolve the promise
      await act(async () => {
        resolvePromise!({ data: [], error: null });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useReceipts());

      await expect(async () => {
        await act(async () => {
          await result.current.analyzeReceipt('receipt-id');
        });
      }).rejects.toThrow('Network error');
    });

    it('should handle missing user gracefully', () => {
      // Mock useAuth to return no user
      vi.mocked(require('@/hooks/useAuth').useAuth).mockReturnValue({ user: null });

      const { result } = renderHook(() => useReceipts());

      // Should not crash and should return default values
      expect(result.current.receipts).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });
});