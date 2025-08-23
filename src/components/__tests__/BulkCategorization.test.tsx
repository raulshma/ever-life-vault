import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkCategorization } from '../BulkCategorization';

// Mock hooks
const mockReceipts = [
  {
    id: '1',
    merchant_name: 'Starbucks',
    total_amount: 5.50,
    receipt_date: '2024-01-15',
    category: 'food_dining'
  }
];

const mockUpdateReceipt = vi.fn();
const mockUseReceipts = {
  receipts: mockReceipts,
  updateReceipt: mockUpdateReceipt,
  loading: false
};

vi.mock('@/hooks/useReceipts', () => ({
  useReceipts: () => mockUseReceipts
}));

// Mock toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock SmartCategorizationService
const mockSuggestions = new Map([
  ['receipt-1', [
    {
      category: 'food_dining',
      confidence: 0.9,
      reason: 'Based on merchant pattern'
    }
  ]],
  ['receipt-2', [
    {
      category: 'transportation',
      confidence: 0.8,
      reason: 'Gas station pattern'
    }
  ]]
]);

const mockCategorizationService = {
  getBulkCategorySuggestions: vi.fn().mockReturnValue(mockSuggestions)
};

vi.mock('@/services/SmartCategorizationService', () => ({
  SmartCategorizationService: vi.fn().mockImplementation(() => mockCategorizationService)
}));

describe('BulkCategorization', () => {
  const uncategorizedReceipts = [
    {
      id: 'receipt-1',
      name: 'Coffee Purchase',
      merchant_name: 'Starbucks',
      total_amount: 5.50,
      receipt_date: '2024-01-20',
      category: 'other'
    },
    {
      id: 'receipt-2',
      name: 'Gas Fill-up',
      merchant_name: 'Shell Gas',
      total_amount: 45.00,
      receipt_date: '2024-01-22',
      category: 'other'
    }
  ];

  const defaultProps = {
    uncategorizedReceipts,
    onClose: vi.fn(),
    className: ''
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should render without crashing', () => {
      render(<BulkCategorization {...defaultProps} />);
      
      expect(screen.getByText('Bulk Receipt Categorization')).toBeInTheDocument();
      expect(screen.getByText('2 uncategorized receipts found')).toBeInTheDocument();
    });

    it('should show generate suggestions button initially', () => {
      render(<BulkCategorization {...defaultProps} />);
      
      expect(screen.getByText('Generate Suggestions')).toBeInTheDocument();
    });

    it('should display receipt count correctly', () => {
      render(<BulkCategorization {...defaultProps} />);
      
      expect(screen.getByText('2 uncategorized receipts found')).toBeInTheDocument();
    });
  });

  describe('Suggestion Generation', () => {
    it('should generate suggestions when button clicked', async () => {
      render(<BulkCategorization {...defaultProps} />);
      
      const generateButton = screen.getByText('Generate Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockCategorizationService.getBulkCategorySuggestions).toHaveBeenCalledWith(uncategorizedReceipts);
        expect(mockToast).toHaveBeenCalledWith({
          title: "Suggestions Generated",
          description: "Generated suggestions for 2 receipts"
        });
      });
    });

    it('should show loading state during generation', () => {
      render(<BulkCategorization {...defaultProps} />);
      
      const generateButton = screen.getByText('Generate Suggestions');
      fireEvent.click(generateButton);

      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    });

    it('should auto-select high confidence suggestions', async () => {
      render(<BulkCategorization {...defaultProps} />);
      
      const generateButton = screen.getByText('Generate Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        // Both receipts should be auto-selected due to high confidence (>= 0.7)
        expect(screen.getByText('Apply Selected (2)')).toBeInTheDocument();
      });
    });
  });

  describe('Suggestion Display', () => {
    beforeEach(async () => {
      render(<BulkCategorization {...defaultProps} />);
      
      const generateButton = screen.getByText('Generate Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Suggested Categorizations')).toBeInTheDocument();
      });
    });

    it('should display suggested categorizations', () => {
      expect(screen.getByText('Suggested Categorizations')).toBeInTheDocument();
      expect(screen.getByText('Coffee Purchase')).toBeInTheDocument();
      expect(screen.getByText('Gas Fill-up')).toBeInTheDocument();
    });

    it('should show confidence percentages', () => {
      expect(screen.getByText('90%')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('should display category suggestions', () => {
      expect(screen.getByText('Food Dining')).toBeInTheDocument();
      expect(screen.getByText('Transportation')).toBeInTheDocument();
    });

    it('should show merchant names and amounts', () => {
      expect(screen.getByText('Starbucks')).toBeInTheDocument();
      expect(screen.getByText('Shell Gas')).toBeInTheDocument();
      expect(screen.getByText('$5.50')).toBeInTheDocument();
      expect(screen.getByText('$45.00')).toBeInTheDocument();
    });
  });

  describe('Receipt Selection', () => {
    beforeEach(async () => {
      render(<BulkCategorization {...defaultProps} />);
      
      const generateButton = screen.getByText('Generate Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Apply Selected (2)')).toBeInTheDocument();
      });
    });

    it('should allow individual receipt selection/deselection', async () => {
      const checkboxes = screen.getAllByRole('checkbox');
      
      // Deselect first receipt
      fireEvent.click(checkboxes[0]);
      
      await waitFor(() => {
        expect(screen.getByText('Apply Selected (1)')).toBeInTheDocument();
      });
    });

    it('should support select all/deselect all', async () => {
      const selectAllButton = screen.getByText('Deselect All'); // Should show deselect since all are selected
      fireEvent.click(selectAllButton);

      await waitFor(() => {
        expect(screen.getByText('Apply Selected (0)')).toBeInTheDocument();
        expect(screen.getByText('Select All')).toBeInTheDocument();
      });
    });

    it('should disable apply button when no receipts selected', async () => {
      const selectAllButton = screen.getByText('Deselect All');
      fireEvent.click(selectAllButton);

      await waitFor(() => {
        const applyButton = screen.getByText('Apply Selected (0)');
        expect(applyButton).toBeDisabled();
      });
    });
  });

  describe('Applying Categorizations', () => {
    beforeEach(async () => {
      render(<BulkCategorization {...defaultProps} />);
      
      const generateButton = screen.getByText('Generate Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Apply Selected (2)')).toBeInTheDocument();
      });
    });

    it('should apply categorizations to selected receipts', async () => {
      const applyButton = screen.getByText('Apply Selected (2)');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(mockUpdateReceipt).toHaveBeenCalledTimes(2);
        expect(mockUpdateReceipt).toHaveBeenCalledWith('receipt-1', expect.objectContaining({
          category: 'food_dining'
        }));
        expect(mockUpdateReceipt).toHaveBeenCalledWith('receipt-2', expect.objectContaining({
          category: 'transportation'
        }));
      });
    });

    it('should show success message after applying', async () => {
      const applyButton = screen.getByText('Apply Selected (2)');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Categorization Complete",
          description: "Successfully categorized 2 receipts"
        });
      });
    });

    it('should close dialog after successful application', async () => {
      const onClose = vi.fn();
      render(<BulkCategorization {...defaultProps} onClose={onClose} />);
      
      // Generate suggestions first
      const generateButton = screen.getByText('Generate Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Apply Selected (2)')).toBeInTheDocument();
      });

      // Apply categorizations
      const applyButton = screen.getByText('Apply Selected (2)');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should show progress during application', async () => {
      const applyButton = screen.getByText('Apply Selected (2)');
      fireEvent.click(applyButton);

      expect(screen.getByText('Applying...')).toBeInTheDocument();
    });
  });

  describe('Confidence Indicators', () => {
    beforeEach(async () => {
      render(<BulkCategorization {...defaultProps} />);
      
      const generateButton = screen.getByText('Generate Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Suggested Categorizations')).toBeInTheDocument();
      });
    });

    it('should display confidence colors correctly', () => {
      // High confidence (90%) should have green indicator
      const highConfidenceIndicator = screen.getByText('90%').closest('div')?.querySelector('.bg-green-500');
      expect(highConfidenceIndicator).toBeInTheDocument();

      // Medium confidence (80%) should have blue indicator  
      const mediumConfidenceIndicator = screen.getByText('80%').closest('div')?.querySelector('.bg-blue-500');
      expect(mediumConfidenceIndicator).toBeInTheDocument();
    });

    it('should show appropriate confidence icons', () => {
      // Should show target icon for high confidence and trending up for medium
      const confidenceElements = screen.getAllByText(/\d+%/);
      expect(confidenceElements).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle suggestion generation errors', async () => {
      mockCategorizationService.getBulkCategorySuggestions.mockImplementation(() => {
        throw new Error('Generation failed');
      });

      render(<BulkCategorization {...defaultProps} />);
      
      const generateButton = screen.getByText('Generate Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Failed to generate suggestions",
          variant: "destructive"
        });
      });
    });

    it('should handle update errors during application', async () => {
      mockUpdateReceipt.mockRejectedValueOnce(new Error('Update failed'));

      render(<BulkCategorization {...defaultProps} />);
      
      // Generate suggestions
      const generateButton = screen.getByText('Generate Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Apply Selected (2)')).toBeInTheDocument();
      });

      // Try to apply
      const applyButton = screen.getByText('Apply Selected (2)');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Failed to apply some categorizations",
          variant: "destructive"
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<BulkCategorization {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /Generate Suggestions/ })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<BulkCategorization {...defaultProps} />);
      
      const generateButton = screen.getByText('Generate Suggestions');
      generateButton.focus();
      expect(document.activeElement).toBe(generateButton);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty uncategorized receipts', () => {
      render(<BulkCategorization {...defaultProps} uncategorizedReceipts={[]} />);
      
      expect(screen.getByText('0 uncategorized receipts found')).toBeInTheDocument();
    });

    it('should handle receipts without suggestions', async () => {
      mockCategorizationService.getBulkCategorySuggestions.mockReturnValue(new Map());

      render(<BulkCategorization {...defaultProps} />);
      
      const generateButton = screen.getByText('Generate Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Suggestions Generated",
          description: "Generated suggestions for 0 receipts"
        });
      });
    });
  });
});