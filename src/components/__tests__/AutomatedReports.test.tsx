import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutomatedReports } from '../AutomatedReports';

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
const mockGeneratedReport = {
  title: 'Monthly Expense Report - January 2024',
  summary: {
    totalExpenses: 80.00,
    totalReceipts: 2,
    averageExpense: 40.00,
    categoryBreakdown: {
      food_dining: 50.00,
      transportation: 30.00
    }
  },
  insights: [
    'Food & Dining represents 62.5% of your expenses',
    'Transportation costs were within normal range'
  ],
  trends: [
    { month: 'Jan', amount: 80 }
  ],
  topMerchants: [
    { name: 'Restaurant A', amount: 50.00, count: 1 }
  ]
};

const mockBudgetingService = {
  generateAutomatedReport: vi.fn().mockReturnValue(mockGeneratedReport)
};

vi.mock('@/services/BudgetingService', () => ({
  BudgetingService: vi.fn().mockImplementation(() => mockBudgetingService)
}));

// Mock file save functionality
const mockSaveAs = vi.fn();
vi.mock('file-saver', () => ({
  saveAs: mockSaveAs
}));

describe('AutomatedReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should render without crashing', () => {
      render(<AutomatedReports />);
      
      expect(screen.getByText('Automated Reports')).toBeInTheDocument();
      expect(screen.getByText('Generate comprehensive expense reports automatically')).toBeInTheDocument();
    });

    it('should display report generation options', () => {
      render(<AutomatedReports />);
      
      expect(screen.getByText('Quick Reports')).toBeInTheDocument();
      expect(screen.getByText('Monthly Summary')).toBeInTheDocument();
      expect(screen.getByText('Category Analysis')).toBeInTheDocument();
      expect(screen.getByText('Merchant Report')).toBeInTheDocument();
    });

    it('should show custom report builder', () => {
      render(<AutomatedReports />);
      
      expect(screen.getByText('Custom Report Builder')).toBeInTheDocument();
      expect(screen.getByLabelText('Report Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Date Range')).toBeInTheDocument();
    });
  });

  describe('Quick Report Generation', () => {
    it('should generate monthly summary report', async () => {
      render(<AutomatedReports />);
      
      const monthlyButton = screen.getByText('Generate Monthly');
      fireEvent.click(monthlyButton);

      await waitFor(() => {
        expect(mockBudgetingService.generateAutomatedReport).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'monthly',
            format: 'detailed'
          })
        );
        expect(screen.getByText('Monthly Expense Report - January 2024')).toBeInTheDocument();
      });
    });

    it('should generate category analysis report', async () => {
      render(<AutomatedReports />);
      
      const categoryButton = screen.getByText('Analyze Categories');
      fireEvent.click(categoryButton);

      await waitFor(() => {
        expect(mockBudgetingService.generateAutomatedReport).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'category',
            format: 'detailed'
          })
        );
      });
    });

    it('should generate merchant report', async () => {
      render(<AutomatedReports />);
      
      const merchantButton = screen.getByText('Top Merchants');
      fireEvent.click(merchantButton);

      await waitFor(() => {
        expect(mockBudgetingService.generateAutomatedReport).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'merchant',
            format: 'detailed'
          })
        );
      });
    });
  });

  describe('Custom Report Builder', () => {
    it('should build custom report with selected options', async () => {
      render(<AutomatedReports />);
      
      // Select report options
      fireEvent.change(screen.getByLabelText('Report Type'), { target: { value: 'custom' } });
      fireEvent.change(screen.getByLabelText('Date Range'), { target: { value: 'last_quarter' } });
      
      // Generate report
      const generateButton = screen.getByText('Generate Custom Report');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockBudgetingService.generateAutomatedReport).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'custom',
            dateRange: 'last_quarter',
            format: 'detailed'
          })
        );
      });
    });

    it('should validate custom report form', async () => {
      render(<AutomatedReports />);
      
      // Try to generate without selecting required fields
      const generateButton = screen.getByText('Generate Custom Report');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText('Please select a report type')).toBeInTheDocument();
      });
    });

    it('should include categories filter when specified', async () => {
      render(<AutomatedReports />);
      
      // Select specific categories
      const categoryCheckbox = screen.getByLabelText('Food & Dining');
      fireEvent.click(categoryCheckbox);
      
      // Generate report
      const generateButton = screen.getByText('Generate Custom Report');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockBudgetingService.generateAutomatedReport).toHaveBeenCalledWith(
          expect.objectContaining({
            categories: ['food_dining']
          })
        );
      });
    });
  });

  describe('Report Display', () => {
    beforeEach(async () => {
      render(<AutomatedReports />);
      
      const monthlyButton = screen.getByText('Generate Monthly');
      fireEvent.click(monthlyButton);

      await waitFor(() => {
        expect(screen.getByText('Monthly Expense Report - January 2024')).toBeInTheDocument();
      });
    });

    it('should display report title and summary', () => {
      expect(screen.getByText('Monthly Expense Report - January 2024')).toBeInTheDocument();
      expect(screen.getByText('Total Expenses: $80.00')).toBeInTheDocument();
      expect(screen.getByText('Total Receipts: 2')).toBeInTheDocument();
      expect(screen.getByText('Average Expense: $40.00')).toBeInTheDocument();
    });

    it('should show category breakdown', () => {
      expect(screen.getByText('Category Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Food & Dining: $50.00')).toBeInTheDocument();
      expect(screen.getByText('Transportation: $30.00')).toBeInTheDocument();
    });

    it('should display insights', () => {
      expect(screen.getByText('Key Insights')).toBeInTheDocument();
      expect(screen.getByText('Food & Dining represents 62.5% of your expenses')).toBeInTheDocument();
      expect(screen.getByText('Transportation costs were within normal range')).toBeInTheDocument();
    });

    it('should show top merchants', () => {
      expect(screen.getByText('Top Merchants')).toBeInTheDocument();
      expect(screen.getByText('Restaurant A')).toBeInTheDocument();
      expect(screen.getByText('$50.00')).toBeInTheDocument();
    });
  });

  describe('Report Export', () => {
    beforeEach(async () => {
      render(<AutomatedReports />);
      
      const monthlyButton = screen.getByText('Generate Monthly');
      fireEvent.click(monthlyButton);

      await waitFor(() => {
        expect(screen.getByText('Monthly Expense Report - January 2024')).toBeInTheDocument();
      });
    });

    it('should export report as PDF', async () => {
      const exportButton = screen.getByText('Export PDF');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockSaveAs).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith({
          title: "Export Complete",
          description: "Report exported as PDF successfully"
        });
      });
    });

    it('should export report as Excel', async () => {
      const exportButton = screen.getByText('Export Excel');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockSaveAs).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith({
          title: "Export Complete",
          description: "Report exported as Excel successfully"
        });
      });
    });

    it('should export report as CSV', async () => {
      const exportButton = screen.getByText('Export CSV');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockSaveAs).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith({
          title: "Export Complete",
          description: "Report exported as CSV successfully"
        });
      });
    });
  });

  describe('Scheduled Reports', () => {
    it('should display scheduled reports section', () => {
      render(<AutomatedReports />);
      
      expect(screen.getByText('Scheduled Reports')).toBeInTheDocument();
      expect(screen.getByText('Set up automatic report generation')).toBeInTheDocument();
    });

    it('should create new scheduled report', async () => {
      render(<AutomatedReports />);
      
      const scheduleButton = screen.getByText('Schedule Report');
      fireEvent.click(scheduleButton);

      expect(screen.getByText('Schedule New Report')).toBeInTheDocument();
      expect(screen.getByLabelText('Report Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Frequency')).toBeInTheDocument();
    });

    it('should validate scheduled report form', async () => {
      render(<AutomatedReports />);
      
      const scheduleButton = screen.getByText('Schedule Report');
      fireEvent.click(scheduleButton);

      // Try to save without filling required fields
      const saveButton = screen.getByText('Schedule Report', { selector: 'button' });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Report name is required')).toBeInTheDocument();
      });
    });

    it('should save scheduled report configuration', async () => {
      render(<AutomatedReports />);
      
      const scheduleButton = screen.getByText('Schedule Report');
      fireEvent.click(scheduleButton);

      // Fill form
      fireEvent.change(screen.getByLabelText('Report Name'), { target: { value: 'Weekly Summary' } });
      fireEvent.change(screen.getByLabelText('Frequency'), { target: { value: 'weekly' } });
      
      // Save
      const saveButton = screen.getByText('Schedule Report', { selector: 'button' });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Report Scheduled",
          description: "Automated report scheduled successfully"
        });
      });
    });
  });

  describe('Report History', () => {
    it('should display report history', () => {
      render(<AutomatedReports />);
      
      expect(screen.getByText('Report History')).toBeInTheDocument();
      expect(screen.getByText('View previously generated reports')).toBeInTheDocument();
    });

    it('should show empty state when no history', () => {
      render(<AutomatedReports />);
      
      expect(screen.getByText('No reports generated yet')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle report generation errors', async () => {
      mockBudgetingService.generateAutomatedReport.mockImplementation(() => {
        throw new Error('Generation failed');
      });

      render(<AutomatedReports />);
      
      const monthlyButton = screen.getByText('Generate Monthly');
      fireEvent.click(monthlyButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Failed to generate report",
          variant: "destructive"
        });
      });
    });

    it('should handle export errors', async () => {
      mockSaveAs.mockImplementation(() => {
        throw new Error('Export failed');
      });

      render(<AutomatedReports />);
      
      // Generate report first
      const monthlyButton = screen.getByText('Generate Monthly');
      fireEvent.click(monthlyButton);

      await waitFor(() => {
        expect(screen.getByText('Monthly Expense Report - January 2024')).toBeInTheDocument();
      });

      // Try to export
      const exportButton = screen.getByText('Export PDF');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Export Error",
          description: "Failed to export report",
          variant: "destructive"
        });
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state during report generation', async () => {
      // Mock delayed response
      mockBudgetingService.generateAutomatedReport.mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve(mockGeneratedReport), 100));
      });

      render(<AutomatedReports />);
      
      const monthlyButton = screen.getByText('Generate Monthly');
      fireEvent.click(monthlyButton);

      expect(screen.getByText('Generating report...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Monthly Expense Report - January 2024')).toBeInTheDocument();
      });
    });

    it('should show loading state during export', async () => {
      // Generate report first
      render(<AutomatedReports />);
      
      const monthlyButton = screen.getByText('Generate Monthly');
      fireEvent.click(monthlyButton);

      await waitFor(() => {
        expect(screen.getByText('Monthly Expense Report - January 2024')).toBeInTheDocument();
      });

      // Mock delayed export
      mockSaveAs.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 100));
      });

      const exportButton = screen.getByText('Export PDF');
      fireEvent.click(exportButton);

      expect(screen.getByText('Exporting...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<AutomatedReports />);
      
      expect(screen.getByRole('button', { name: /Generate Monthly/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Generate Custom Report/ })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<AutomatedReports />);
      
      const monthlyButton = screen.getByText('Generate Monthly');
      monthlyButton.focus();
      expect(document.activeElement).toBe(monthlyButton);
    });

    it('should have proper form labels', () => {
      render(<AutomatedReports />);
      
      expect(screen.getByLabelText('Report Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Date Range')).toBeInTheDocument();
    });
  });
});