import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BudgetDashboard } from '../BudgetDashboard';

// Mock hooks
const mockReceipts = [
  {
    id: '1',
    total_amount: 50.00,
    receipt_date: '2024-01-15',
    category: 'food_dining',
    merchant_name: 'Restaurant A'
  },
  {
    id: '2',
    total_amount: 30.00,
    receipt_date: '2024-01-20',
    category: 'transportation',
    merchant_name: 'Gas Station'
  }
];

const mockExpenseStats = {
  receiptCount: 2,
  totalAmount: 80.00,
  totalTax: 6.40,
  businessExpenses: 50.00,
  personalExpenses: 30.00,
  reimbursableAmount: 30.00,
  categoryCounts: {
    food_dining: 1,
    transportation: 1
  }
};

const mockUseReceipts = {
  receipts: mockReceipts,
  getExpenseStats: vi.fn().mockReturnValue(mockExpenseStats),
  loading: false
};

vi.mock('@/hooks/useReceipts', () => ({
  useReceipts: () => mockUseReceipts
}));

// Mock BudgetingService
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
  },
  {
    id: 'budget-2',
    name: 'Transport Budget',
    budget_amount: 100,
    category: 'transportation',
    period_type: 'monthly',
    is_active: true,
    start_date: '2024-01-01',
    end_date: '2024-01-31'
  }
];

const mockAlerts = [
  {
    id: 'alert-1',
    budget_id: 'budget-1',
    alert_type: 'threshold',
    message: 'Food Budget is 80% spent',
    threshold_percentage: 80,
    created_at: '2024-01-25'
  },
  {
    id: 'alert-2',
    budget_id: 'budget-2',
    alert_type: 'overspend',
    message: 'Transport Budget exceeded by $10',
    threshold_percentage: 100,
    created_at: '2024-01-26'
  }
];

const mockBudgetPerformance = {
  'budget-1': {
    currentSpent: 160,
    percentageUsed: 80,
    onTrack: true,
    daysRemaining: 6,
    projectedSpend: 200
  },
  'budget-2': {
    currentSpent: 110,
    percentageUsed: 110,
    onTrack: false,
    daysRemaining: 6,
    projectedSpend: 130
  }
};

const mockSpendingInsights = {
  spendingTrends: [
    { period: 'Jan Week 1', amount: 40, change: 10 },
    { period: 'Jan Week 2', amount: 35, change: -5 },
    { period: 'Jan Week 3', amount: 45, change: 15 }
  ],
  categoryInsights: {
    food_dining: { trend: 'increasing', recommendation: 'Consider meal planning' },
    transportation: { trend: 'stable', recommendation: 'Monitor fuel costs' }
  }
};

const mockBudgetingService = {
  checkBudgetAlerts: vi.fn().mockReturnValue(mockAlerts),
  getBudgetPerformance: vi.fn().mockImplementation((budgetId) => mockBudgetPerformance[budgetId]),
  getSpendingInsights: vi.fn().mockReturnValue(mockSpendingInsights)
};

vi.mock('@/services/BudgetingService', () => ({
  BudgetingService: vi.fn().mockImplementation(() => mockBudgetingService)
}));

// Mock child components
vi.mock('../BudgetManager', () => ({
  BudgetManager: () => <div data-testid="budget-manager">Budget Manager Component</div>
}));

vi.mock('../AutomatedReports', () => ({
  AutomatedReports: () => <div data-testid="automated-reports">Automated Reports Component</div>
}));

describe('BudgetDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should render without crashing', () => {
      render(<BudgetDashboard />);
      
      expect(screen.getByText('Budget & Reports')).toBeInTheDocument();
      expect(screen.getByText('Manage your budgets and track spending')).toBeInTheDocument();
    });

    it('should display financial health score when calculated', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Financial Health')).toBeInTheDocument();
        // Should display a health score and level
        expect(screen.getByText(/Good|Fair|Poor|Excellent/)).toBeInTheDocument();
      });
    });

    it('should show budget alerts when present', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Budget Alerts (2)')).toBeInTheDocument();
        expect(screen.getByText('Food Budget is 80% spent')).toBeInTheDocument();
        expect(screen.getByText('Transport Budget exceeded by $10')).toBeInTheDocument();
      });
    });
  });

  describe('Overview Cards', () => {
    it('should display total budget amount', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Budget')).toBeInTheDocument();
        expect(screen.getByText('$300.00')).toBeInTheDocument(); // 200 + 100
      });
    });

    it('should display total spent amount', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Spent')).toBeInTheDocument();
        expect(screen.getByText('$270.00')).toBeInTheDocument(); // 160 + 110
      });
    });

    it('should display average utilization', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Avg Utilization')).toBeInTheDocument();
        expect(screen.getByText('95.0%')).toBeInTheDocument(); // (80 + 110) / 2
      });
    });

    it('should display active budgets count', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Active Budgets')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('Budget Overview Section', () => {
    it('should display budget overview for active budgets', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Budget Overview')).toBeInTheDocument();
        expect(screen.getByText('Food Budget')).toBeInTheDocument();
        expect(screen.getByText('Transport Budget')).toBeInTheDocument();
      });
    });

    it('should show budget progress bars', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        const progressBars = screen.getAllByRole('progressbar');
        expect(progressBars).toHaveLength(2); // One for each budget
      });
    });

    it('should display budget performance metrics', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('80.0%')).toBeInTheDocument(); // Food budget utilization
        expect(screen.getByText('110.0%')).toBeInTheDocument(); // Transport budget utilization
        expect(screen.getByText('$160.00 / $200.00')).toBeInTheDocument(); // Food budget spent/total
        expect(screen.getByText('$110.00 / $100.00')).toBeInTheDocument(); // Transport budget spent/total
      });
    });

    it('should show days remaining for each budget', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        const daysRemainingElements = screen.getAllByText('6 days left');
        expect(daysRemainingElements).toHaveLength(2);
      });
    });

    it('should use appropriate colors for utilization levels', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        // Food budget (80%) should be yellow/warning
        const foodUtilization = screen.getByText('80.0%');
        expect(foodUtilization.className).toContain('text-yellow-600');
        
        // Transport budget (110%) should be red/danger
        const transportUtilization = screen.getByText('110.0%');
        expect(transportUtilization.className).toContain('text-red-600');
      });
    });
  });

  describe('Alert Display', () => {
    it('should display different alert types with appropriate styling', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        // Threshold alert (yellow)
        const thresholdAlert = screen.getByText('Food Budget is 80% spent').closest('.border-yellow-200');
        expect(thresholdAlert).toBeInTheDocument();
        
        // Overspend alert (red)
        const overspendAlert = screen.getByText('Transport Budget exceeded by $10').closest('.border-red-200');
        expect(overspendAlert).toBeInTheDocument();
      });
    });

    it('should limit displayed alerts to 3', async () => {
      // Add more mock alerts
      const manyAlerts = [
        ...mockAlerts,
        { id: 'alert-3', alert_type: 'info', message: 'Alert 3' },
        { id: 'alert-4', alert_type: 'info', message: 'Alert 4' },
        { id: 'alert-5', alert_type: 'info', message: 'Alert 5' }
      ];
      
      mockBudgetingService.checkBudgetAlerts.mockReturnValue(manyAlerts);
      
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('+3 more alerts')).toBeInTheDocument();
      });
    });

    it('should not display alerts section when no alerts', async () => {
      mockBudgetingService.checkBudgetAlerts.mockReturnValue([]);
      
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        expect(screen.queryByText('Budget Alerts')).not.toBeInTheDocument();
      });
    });
  });

  describe('Financial Health Calculation', () => {
    it('should calculate health score based on budget adherence', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        // Should show a calculated health score
        expect(screen.getByText('Financial Health')).toBeInTheDocument();
        
        // Score should be visible (range 0-100)
        const scoreElement = screen.getByText(/\d+/);
        const score = parseInt(scoreElement.textContent || '0');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    it('should display appropriate health level', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        // Should show one of the health levels
        const healthLevels = ['Excellent', 'Good', 'Fair', 'Poor'];
        const hasHealthLevel = healthLevels.some(level => screen.queryByText(level));
        expect(hasHealthLevel).toBe(true);
      });
    });

    it('should show appropriate emoji for health level', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        // Should contain health emoji
        const healthEmojis = ['🎯', '👍', '⚠️', '🚨'];
        const container = screen.getByText('Financial Health').closest('div');
        const hasEmoji = healthEmojis.some(emoji => container?.textContent?.includes(emoji));
        expect(hasEmoji).toBe(true);
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should display budget management tab by default', () => {
      render(<BudgetDashboard />);
      
      expect(screen.getByTestId('budget-manager')).toBeInTheDocument();
    });

    it('should switch to automated reports tab', async () => {
      render(<BudgetDashboard />);
      
      const reportsTab = screen.getByText('Automated Reports');
      fireEvent.click(reportsTab);
      
      await waitFor(() => {
        expect(screen.getByTestId('automated-reports')).toBeInTheDocument();
      });
    });

    it('should have proper tab structure', () => {
      render(<BudgetDashboard />);
      
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Budget Management/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Automated Reports/ })).toBeInTheDocument();
    });
  });

  describe('Data Integration', () => {
    it('should use receipt data for calculations', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        // Should call getExpenseStats
        expect(mockUseReceipts.getExpenseStats).toHaveBeenCalled();
      });
    });

    it('should initialize budgeting service with receipts', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        // Should create BudgetingService instance
        expect(mockBudgetingService.checkBudgetAlerts).toHaveBeenCalled();
        expect(mockBudgetingService.getSpendingInsights).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle budgeting service errors gracefully', async () => {
      mockBudgetingService.checkBudgetAlerts.mockImplementation(() => {
        throw new Error('Service error');
      });
      
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        // Should not crash and should still render basic structure
        expect(screen.getByText('Budget & Reports')).toBeInTheDocument();
      });
    });

    it('should handle missing budget performance data', async () => {
      mockBudgetingService.getBudgetPerformance.mockReturnValue(null);
      
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        // Should not crash and should handle missing data
        expect(screen.getByText('Budget & Reports')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt overview cards layout for different screen sizes', () => {
      render(<BudgetDashboard />);
      
      // Should have responsive grid classes
      const overviewSection = screen.getByText('Total Budget').closest('.grid');
      expect(overviewSection).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<BudgetDashboard />);
      
      expect(screen.getByRole('heading', { level: 1, name: /Budget & Reports/ })).toBeInTheDocument();
    });

    it('should have accessible progress bars', async () => {
      render(<BudgetDashboard />);
      
      await waitFor(() => {
        const progressBars = screen.getAllByRole('progressbar');
        progressBars.forEach(progressBar => {
          expect(progressBar).toHaveAttribute('aria-valuenow');
          expect(progressBar).toHaveAttribute('aria-valuemin');
          expect(progressBar).toHaveAttribute('aria-valuemax');
        });
      });
    });

    it('should support keyboard navigation for tabs', () => {
      render(<BudgetDashboard />);
      
      const budgetTab = screen.getByRole('tab', { name: /Budget Management/ });
      const reportsTab = screen.getByRole('tab', { name: /Automated Reports/ });
      
      budgetTab.focus();
      expect(document.activeElement).toBe(budgetTab);
      
      reportsTab.focus();
      expect(document.activeElement).toBe(reportsTab);
    });
  });

  describe('Performance', () => {
    it('should memoize expensive calculations', async () => {
      const { rerender } = render(<BudgetDashboard />);
      
      await waitFor(() => {
        expect(mockBudgetingService.getSpendingInsights).toHaveBeenCalledTimes(1);
      });
      
      // Re-render with same props
      rerender(<BudgetDashboard />);
      
      await waitFor(() => {
        // Should not call expensive operations again
        expect(mockBudgetingService.getSpendingInsights).toHaveBeenCalledTimes(1);
      });
    });
  });
});