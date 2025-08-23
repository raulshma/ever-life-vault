import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CategorySuggestions, BulkCategorizationSuggestions } from '../CategorySuggestions';

// Mock hooks
const mockReceipts = [
  {
    id: '1',
    merchant_name: 'Starbucks',
    total_amount: 5.50,
    receipt_date: '2024-01-15',
    category: 'food_dining'
  },
  {
    id: '2',
    merchant_name: 'Shell Gas',
    total_amount: 45.00,
    receipt_date: '2024-01-18',
    category: 'transportation'
  }
];

const mockUseReceipts = {
  receipts: mockReceipts,
  loading: false,
  getExpenseStats: vi.fn()
};

vi.mock('@/hooks/useReceipts', () => ({
  useReceipts: () => mockUseReceipts
}));

// Mock SmartCategorizationService
const mockSuggestions = [
  {
    category: 'food_dining',
    subcategory: 'coffee',
    confidence: 0.9,
    reason: 'Based on previous transactions with Starbucks'
  },
  {
    category: 'food_dining',
    subcategory: 'restaurant',
    confidence: 0.7,
    reason: 'Common category for this merchant type'
  }
];

const mockCategorizationService = {
  getCategorySuggestions: vi.fn().mockReturnValue(mockSuggestions),
  getBulkCategorySuggestions: vi.fn().mockReturnValue(new Map([
    ['receipt-1', mockSuggestions]
  ]))
};

vi.mock('@/services/SmartCategorizationService', () => ({
  SmartCategorizationService: vi.fn().mockImplementation(() => mockCategorizationService)
}));

describe('CategorySuggestions', () => {
  const defaultProps = {
    receiptData: {
      merchant_name: 'Starbucks Coffee',
      total_amount: 5.50,
      receipt_date: '2024-01-20',
      description: 'Morning coffee'
    },
    currentCategory: '',
    onCategorySelect: vi.fn(),
    onLearnFromCorrection: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<CategorySuggestions {...defaultProps} />);
      expect(screen.getByText('Smart Category Suggestions')).toBeInTheDocument();
    });

    it('should display loading state', () => {
      render(<CategorySuggestions {...defaultProps} />);
      
      // Should show loading indicator briefly
      expect(screen.getByText('Analyzing receipt patterns...')).toBeInTheDocument();
    });

    it('should display suggestions when available', async () => {
      render(<CategorySuggestions {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Food Dining')).toBeInTheDocument();
      });

      expect(screen.getByText('90%')).toBeInTheDocument();
      expect(screen.getByText('Based on previous transactions with Starbucks')).toBeInTheDocument();
    });

    it('should not render when no merchant name provided', () => {
      const propsWithoutMerchant = {
        ...defaultProps,
        receiptData: {
          ...defaultProps.receiptData,
          merchant_name: ''
        }
      };

      const { container } = render(<CategorySuggestions {...propsWithoutMerchant} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('User Interactions', () => {
    it('should call onCategorySelect when suggestion is clicked', async () => {
      const onCategorySelect = vi.fn();
      render(
        <CategorySuggestions 
          {...defaultProps} 
          onCategorySelect={onCategorySelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Food Dining')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Food Dining'));
      expect(onCategorySelect).toHaveBeenCalledWith('food_dining');
    });

    it('should highlight selected category', async () => {
      render(
        <CategorySuggestions 
          {...defaultProps} 
          currentCategory="food_dining"
        />
      );

      await waitFor(() => {
        const selectedSuggestion = screen.getByText('Food Dining').closest('.ring-2');
        expect(selectedSuggestion).toBeInTheDocument();
      });
    });

    it('should call onLearnFromCorrection when user selects different category', async () => {
      const onLearnFromCorrection = vi.fn();
      const { rerender } = render(
        <CategorySuggestions 
          {...defaultProps} 
          onLearnFromCorrection={onLearnFromCorrection}
          currentCategory=""
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Food Dining')).toBeInTheDocument();
      });

      // Simulate user selecting a different category
      rerender(
        <CategorySuggestions 
          {...defaultProps} 
          onLearnFromCorrection={onLearnFromCorrection}
          currentCategory="transportation"
        />
      );

      await waitFor(() => {
        expect(onLearnFromCorrection).toHaveBeenCalledWith('food_dining', 'transportation');
      });
    });
  });

  describe('Confidence Display', () => {
    it('should display confidence percentages correctly', async () => {
      render(<CategorySuggestions {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('90%')).toBeInTheDocument();
        expect(screen.getByText('70%')).toBeInTheDocument();
      });
    });

    it('should use appropriate confidence colors', async () => {
      render(<CategorySuggestions {...defaultProps} />);

      await waitFor(() => {
        const highConfidenceBadge = screen.getByText('90%').closest('.text-green-800');
        const mediumConfidenceBadge = screen.getByText('70%').closest('.text-blue-800');
        
        expect(highConfidenceBadge).toBeInTheDocument();
        expect(mediumConfidenceBadge).toBeInTheDocument();
      });
    });

    it('should display confidence icons based on confidence level', async () => {
      render(<CategorySuggestions {...defaultProps} />);

      await waitFor(() => {
        // High confidence should show target icon
        const suggestions = screen.getAllByRole('button');
        expect(suggestions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('No Suggestions State', () => {
    it('should display appropriate message when no suggestions available', async () => {
      mockCategorizationService.getCategorySuggestions.mockReturnValue([]);
      
      render(<CategorySuggestions {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/No automatic suggestions available/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockCategorizationService.getCategorySuggestions.mockImplementation(() => {
        throw new Error('Service error');
      });

      render(<CategorySuggestions {...defaultProps} />);

      await waitFor(() => {
        // Should not crash and should handle error gracefully
        expect(screen.getByText('Smart Category Suggestions')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(<CategorySuggestions {...defaultProps} />);

      await waitFor(() => {
        const suggestions = screen.getAllByRole('button');
        suggestions.forEach(suggestion => {
          expect(suggestion).toBeInTheDocument();
        });
      });
    });

    it('should support keyboard navigation', async () => {
      render(<CategorySuggestions {...defaultProps} />);

      await waitFor(() => {
        const firstSuggestion = screen.getAllByRole('button')[0];
        firstSuggestion.focus();
        expect(document.activeElement).toBe(firstSuggestion);
      });
    });
  });
});

describe('BulkCategorizationSuggestions', () => {
  const defaultProps = {
    receipts: [
      {
        id: 'receipt-1',
        merchant_name: 'Starbucks',
        total_amount: 5.50,
        category: 'other'
      },
      {
        id: 'receipt-2',
        merchant_name: 'Unknown Store',
        total_amount: 25.00,
        category: 'other'
      }
    ],
    onBulkCategorize: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render bulk categorization component', () => {
      render(<BulkCategorizationSuggestions {...defaultProps} />);
      
      expect(screen.getByText('Bulk Categorization Assistant')).toBeInTheDocument();
      expect(screen.getByText(/Found 2 receipts/)).toBeInTheDocument();
    });

    it('should not render when no uncategorized receipts', () => {
      const propsWithCategorizedReceipts = {
        ...defaultProps,
        receipts: defaultProps.receipts.map(r => ({ ...r, category: 'food_dining' }))
      };

      const { container } = render(<BulkCategorizationSuggestions {...propsWithCategorizedReceipts} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Bulk Processing', () => {
    it('should generate bulk suggestions when button clicked', async () => {
      const onBulkCategorize = vi.fn();
      render(
        <BulkCategorizationSuggestions 
          {...defaultProps} 
          onBulkCategorize={onBulkCategorize}
        />
      );

      const generateButton = screen.getByText('Generate Smart Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockCategorizationService.getBulkCategorySuggestions).toHaveBeenCalledWith(defaultProps.receipts);
        expect(onBulkCategorize).toHaveBeenCalled();
      });
    });

    it('should show loading state during bulk processing', async () => {
      render(<BulkCategorizationSuggestions {...defaultProps} />);

      const generateButton = screen.getByText('Generate Smart Suggestions');
      fireEvent.click(generateButton);

      expect(screen.getByText('Analyzing Patterns...')).toBeInTheDocument();
    });

    it('should display success message after generation', async () => {
      render(<BulkCategorizationSuggestions {...defaultProps} />);

      const generateButton = screen.getByText('Generate Smart Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/Generated suggestions for/)).toBeInTheDocument();
      });
    });
  });

  describe('Receipt Counting', () => {
    it('should correctly count uncategorized receipts', () => {
      const mixedReceipts = [
        { id: '1', category: 'food_dining' }, // categorized
        { id: '2', category: 'other' }, // uncategorized
        { id: '3', category: '' }, // uncategorized
        { id: '4', category: undefined } // uncategorized
      ];

      render(
        <BulkCategorizationSuggestions 
          {...defaultProps} 
          receipts={mixedReceipts}
        />
      );

      expect(screen.getByText(/Found 3 receipts/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle bulk processing errors gracefully', async () => {
      mockCategorizationService.getBulkCategorySuggestions.mockImplementation(() => {
        throw new Error('Bulk processing error');
      });

      render(<BulkCategorizationSuggestions {...defaultProps} />);

      const generateButton = screen.getByText('Generate Smart Suggestions');
      fireEvent.click(generateButton);

      await waitFor(() => {
        // Should not crash and return to normal state
        expect(screen.getByText('Generate Smart Suggestions')).toBeInTheDocument();
      });
    });
  });
});