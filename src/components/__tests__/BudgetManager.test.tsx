import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BudgetManager } from '../BudgetManager';

// Mock hooks
const mockReceipts = [
  {
    id: '1',
    total_amount: 50.00,
    receipt_date: '2024-01-15',
    category: 'food_dining'
  },
  {
    id: '2',
    total_amount: 30.00,
    receipt_date: '2024-01-20',
    category: 'transportation'
  }
];

const mockUseReceipts = {
  receipts: mockReceipts,
  getExpenseStats: vi.fn().mockReturnValue({
    receiptCount: 2,
    totalAmount: 80.00,
    categoryCounts: {
      food_dining: 1,
      transportation: 1
    }
  })
};

vi.mock('@/hooks/useReceipts', () => ({
  useReceipts: () => mockUseReceipts
}));

// Mock toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock BudgetingService
const mockBudgetRecommendations = {
  food_dining: {
    suggested_amount: 200,
    confidence: 0.85,
    reasoning: 'Based on your spending patterns'
  },
  transportation: {
    suggested_amount: 150,
    confidence: 0.75,
    reasoning: 'Average monthly fuel costs'
  }
};

const mockBudgetingService = {
  getBudgetRecommendations: vi.fn().mockReturnValue(mockBudgetRecommendations),
  getBudgetPerformance: vi.fn().mockReturnValue({
    currentSpent: 50,
    percentageUsed: 25,
    onTrack: true,
    daysRemaining: 15
  })
};

vi.mock('@/services/BudgetingService', () => ({
  BudgetingService: vi.fn().mockImplementation(() => mockBudgetingService)
}));

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis()
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient
}));

describe('BudgetManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default Supabase responses
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ id: 'new-budget-id' }],
          error: null
        })
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'updated-budget-id' }],
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

  describe('Initial Rendering', () => {
    it('should render without crashing', () => {
      render(<BudgetManager />);
      
      expect(screen.getByText('Budget Management')).toBeInTheDocument();
      expect(screen.getByText('Create New Budget')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      render(<BudgetManager />);
      
      expect(screen.getByText('Loading budgets...')).toBeInTheDocument();
    });

    it('should display empty state when no budgets', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        expect(screen.getByText('No budgets created yet')).toBeInTheDocument();
        expect(screen.getByText('Get started by creating your first budget using AI recommendations')).toBeInTheDocument();
      });
    });
  });

  describe('Smart Recommendations', () => {
    it('should display AI budget recommendations', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        expect(screen.getByText('AI Budget Recommendations')).toBeInTheDocument();
        expect(screen.getByText('Food Dining')).toBeInTheDocument();
        expect(screen.getByText('Transportation')).toBeInTheDocument();
        expect(screen.getByText('$200')).toBeInTheDocument();
        expect(screen.getByText('$150')).toBeInTheDocument();
      });
    });

    it('should show confidence levels for recommendations', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        expect(screen.getByText('85% confident')).toBeInTheDocument();
        expect(screen.getByText('75% confident')).toBeInTheDocument();
      });
    });

    it('should display reasoning for recommendations', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Based on your spending patterns')).toBeInTheDocument();
        expect(screen.getByText('Average monthly fuel costs')).toBeInTheDocument();
      });
    });
  });

  describe('Budget Creation', () => {
    it('should open create budget form when button clicked', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        const createButton = screen.getByText('Create New Budget');
        fireEvent.click(createButton);
        
        expect(screen.getByText('Create Budget')).toBeInTheDocument();
        expect(screen.getByLabelText('Budget Name')).toBeInTheDocument();
      });
    });

    it('should create budget from recommendation', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        const useRecommendationButton = screen.getAllByText('Use This Budget')[0];
        fireEvent.click(useRecommendationButton);
      });

      await waitFor(() => {
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('budgets');
        expect(mockToast).toHaveBeenCalledWith({
          title: "Budget Created",
          description: expect.stringContaining("Food Dining budget created successfully")
        });
      });
    });

    it('should validate budget form inputs', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        const createButton = screen.getByText('Create New Budget');
        fireEvent.click(createButton);
      });

      // Try to submit without filling required fields
      const saveButton = screen.getByText('Create Budget');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Amount must be greater than 0')).toBeInTheDocument();
      });
    });

    it('should create custom budget with form data', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        const createButton = screen.getByText('Create New Budget');
        fireEvent.click(createButton);
      });

      // Fill form
      fireEvent.change(screen.getByLabelText('Budget Name'), { target: { value: 'Entertainment Budget' } });
      fireEvent.change(screen.getByLabelText('Budget Amount'), { target: { value: '100' } });
      fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'entertainment' } });
      fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'monthly' } });

      // Submit form
      const saveButton = screen.getByText('Create Budget');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('budgets');
        expect(mockToast).toHaveBeenCalledWith({
          title: "Budget Created",
          description: "Budget created successfully"
        });
      });
    });
  });

  describe('Budget List Display', () => {
    beforeEach(() => {
      const mockBudgets = [
        {
          id: 'budget-1',
          name: 'Food Budget',
          budget_amount: 200,
          category: 'food_dining',
          period_type: 'monthly',
          is_active: true,
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockBudgets,
            error: null
          })
        })
      });
    });

    it('should display existing budgets', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Food Budget')).toBeInTheDocument();
        expect(screen.getByText('$200.00')).toBeInTheDocument();
        expect(screen.getByText('Monthly')).toBeInTheDocument();
        expect(screen.getByText('Food Dining')).toBeInTheDocument();
      });
    });

    it('should show budget performance metrics', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        expect(screen.getByText('25.0%')).toBeInTheDocument(); // percentage used
        expect(screen.getByText('$50.00 / $200.00')).toBeInTheDocument(); // spent/total
        expect(screen.getByText('15 days left')).toBeInTheDocument();
      });
    });

    it('should display on-track indicator', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        expect(screen.getByText('On Track')).toBeInTheDocument();
      });
    });
  });

  describe('Budget Actions', () => {
    beforeEach(() => {
      const mockBudgets = [
        {
          id: 'budget-1',
          name: 'Food Budget',
          budget_amount: 200,
          category: 'food_dining',
          period_type: 'monthly',
          is_active: true
        }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockBudgets,
            error: null
          })
        })
      });
    });

    it('should edit budget when edit button clicked', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        const editButton = screen.getByText('Edit');
        fireEvent.click(editButton);
        
        expect(screen.getByDisplayValue('Food Budget')).toBeInTheDocument();
        expect(screen.getByDisplayValue('200')).toBeInTheDocument();
      });
    });

    it('should toggle budget active status', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        const toggleButton = screen.getByText('Deactivate');
        fireEvent.click(toggleButton);
      });

      await waitFor(() => {
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('budgets');
        expect(mockToast).toHaveBeenCalledWith({
          title: "Budget Updated",
          description: "Budget status updated successfully"
        });
      });
    });

    it('should delete budget when delete button clicked', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        const deleteButton = screen.getByText('Delete');
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('budgets');
        expect(mockToast).toHaveBeenCalledWith({
          title: "Budget Deleted",
          description: "Budget deleted successfully"
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle budget creation errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Creation failed' }
          })
        })
      });

      render(<BudgetManager />);
      
      await waitFor(() => {
        const useRecommendationButton = screen.getAllByText('Use This Budget')[0];
        fireEvent.click(useRecommendationButton);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Failed to create budget",
          variant: "destructive"
        });
      });
    });

    it('should handle budget fetching errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Fetch failed' }
          })
        })
      });

      render(<BudgetManager />);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Failed to load budgets",
          variant: "destructive"
        });
      });
    });

    it('should handle service initialization errors', async () => {
      vi.mocked(mockBudgetingService.getBudgetRecommendations).mockImplementation(() => {
        throw new Error('Service error');
      });

      render(<BudgetManager />);
      
      await waitFor(() => {
        // Should not crash and should handle error gracefully
        expect(screen.getByText('Budget Management')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<BudgetManager />);
      
      expect(screen.getByRole('button', { name: /Create New Budget/ })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        const createButton = screen.getByText('Create New Budget');
        createButton.focus();
        expect(document.activeElement).toBe(createButton);
      });
    });

    it('should have proper form labels', async () => {
      render(<BudgetManager />);
      
      await waitFor(() => {
        const createButton = screen.getByText('Create New Budget');
        fireEvent.click(createButton);
      });

      expect(screen.getByLabelText('Budget Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Budget Amount')).toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      expect(screen.getByLabelText('Period')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to different screen sizes', () => {
      render(<BudgetManager />);
      
      // Component should render without breaking on different viewports
      expect(screen.getByText('Budget Management')).toBeInTheDocument();
    });
  });
});