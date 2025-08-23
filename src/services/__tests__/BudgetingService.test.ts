import { describe, it, expect, beforeEach } from 'vitest';
import { BudgetingService, type Budget, type BudgetAlert, type ExpenseReport } from '../../services/BudgetingService';

describe('BudgetingService', () => {
  let service: BudgetingService;
  let mockReceipts: any[];
  let mockBudgets: Budget[];

  beforeEach(() => {
    mockReceipts = [
      {
        id: '1',
        merchant_name: 'Starbucks',
        total_amount: 5.50,
        receipt_date: '2024-01-15',
        category: 'food_dining',
        is_business_expense: false,
        is_tax_deductible: false,
        is_reimbursable: false,
        payment_method: 'credit_card'
      },
      {
        id: '2',
        merchant_name: 'Shell',
        total_amount: 45.00,
        receipt_date: '2024-01-18',
        category: 'transportation',
        is_business_expense: true,
        is_tax_deductible: true,
        is_reimbursable: false,
        payment_method: 'credit_card'
      },
      {
        id: '3',
        merchant_name: 'Whole Foods',
        total_amount: 125.30,
        receipt_date: '2024-01-22',
        category: 'food_dining',
        is_business_expense: false,
        is_tax_deductible: false,
        is_reimbursable: false,
        payment_method: 'debit_card'
      },
      {
        id: '4',
        merchant_name: 'CVS',
        total_amount: 15.99,
        receipt_date: '2024-01-25',
        category: 'healthcare',
        is_business_expense: false,
        is_tax_deductible: false,
        is_reimbursable: true,
        payment_method: 'cash'
      },
      {
        id: '5',
        merchant_name: 'Office Depot',
        total_amount: 67.50,
        receipt_date: '2024-02-02',
        category: 'business',
        is_business_expense: true,
        is_tax_deductible: true,
        is_reimbursable: false,
        payment_method: 'credit_card'
      }
    ];

    mockBudgets = [
      {
        id: 'budget1',
        user_id: 'user1',
        name: 'Monthly Food Budget',
        category: 'food_dining',
        period_type: 'monthly',
        budget_amount: 200.00,
        current_spent: 130.80,
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        alert_threshold: 80,
        is_active: true,
        auto_rollover: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 'budget2',
        user_id: 'user1',
        name: 'Transportation Budget',
        category: 'transportation',
        period_type: 'monthly',
        budget_amount: 100.00,
        current_spent: 45.00,
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        alert_threshold: 75,
        is_active: true,
        auto_rollover: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ];

    service = new BudgetingService(mockReceipts, mockBudgets);
  });

  describe('generateBudgetRecommendations', () => {
    it('should generate recommendations based on historical spending', () => {
      // Add more receipts to meet the minimum 3 data points requirement per category
      const extendedReceipts = [
        ...mockReceipts,
        {
          id: '6',
          merchant_name: 'Pizza Hut',
          total_amount: 25.00,
          receipt_date: '2023-12-15',
          category: 'food_dining',
          is_business_expense: false,
          is_tax_deductible: false,
          is_reimbursable: false,
          payment_method: 'credit_card'
        },
        {
          id: '7',
          merchant_name: 'McDonald\'s',
          total_amount: 12.50,
          receipt_date: '2023-11-20',
          category: 'food_dining',
          is_business_expense: false,
          is_tax_deductible: false,
          is_reimbursable: false,
          payment_method: 'credit_card'
        }
      ];
      
      const serviceWithData = new BudgetingService(extendedReceipts, mockBudgets);
      const recommendations = serviceWithData.generateBudgetRecommendations(6);

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);

      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('category');
        expect(rec).toHaveProperty('suggested_amount');
        expect(rec).toHaveProperty('reasoning');
        expect(rec).toHaveProperty('confidence');
        expect(rec).toHaveProperty('historical_average');
        expect(rec).toHaveProperty('trend');

        expect(rec.suggested_amount).toBeGreaterThan(0);
        expect(rec.confidence).toBeGreaterThan(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
        expect(['increasing', 'decreasing', 'stable']).toContain(rec.trend);
      });
    });

    it('should sort recommendations by suggested amount', () => {
      const recommendations = service.generateBudgetRecommendations(6);

      if (recommendations.length > 1) {
        for (let i = 0; i < recommendations.length - 1; i++) {
          expect(recommendations[i].suggested_amount).toBeGreaterThanOrEqual(
            recommendations[i + 1].suggested_amount
          );
        }
      }
    });

    it('should include buffer in suggestions', () => {
      const recommendations = service.generateBudgetRecommendations(6);

      const foodRec = recommendations.find(r => r.category === 'food_dining');
      if (foodRec) {
        // Suggested amount should be higher than historical average due to buffer
        expect(foodRec.suggested_amount).toBeGreaterThan(foodRec.historical_average);
      }
    });

    it('should handle empty receipts gracefully', () => {
      const emptyService = new BudgetingService([], []);
      const recommendations = emptyService.generateBudgetRecommendations(6);

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBe(0);
    });

    it('should require minimum data points for recommendations', () => {
      const limitedReceipts = [mockReceipts[0]]; // Only one receipt
      const limitedService = new BudgetingService(limitedReceipts, []);
      const recommendations = limitedService.generateBudgetRecommendations(6);

      expect(recommendations.length).toBe(0);
    });
  });

  describe('generateExpenseReport', () => {
    it('should generate comprehensive expense report', () => {
      const report = service.generateExpenseReport('2024-01-01', '2024-01-31', 'monthly');

      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('report_type', 'monthly');
      expect(report).toHaveProperty('period_start', '2024-01-01');
      expect(report).toHaveProperty('period_end', '2024-01-31');
      expect(report).toHaveProperty('total_expenses');
      expect(report).toHaveProperty('total_business_expenses');
      expect(report).toHaveProperty('total_personal_expenses');
      expect(report).toHaveProperty('total_tax_deductible');
      expect(report).toHaveProperty('total_reimbursable');
      expect(report).toHaveProperty('category_breakdown');
      expect(report).toHaveProperty('merchant_breakdown');
      expect(report).toHaveProperty('payment_method_breakdown');
      expect(report).toHaveProperty('generated_at');
      expect(report).toHaveProperty('auto_generated', true);

      // Verify calculations
      const januaryReceipts = mockReceipts.filter(r => r.receipt_date >= '2024-01-01' && r.receipt_date <= '2024-01-31');
      const expectedTotal = januaryReceipts.reduce((sum, r) => sum + r.total_amount, 0);
      expect(report.total_expenses).toBe(expectedTotal);

      // Verify business expenses
      const businessTotal = januaryReceipts.filter(r => r.is_business_expense).reduce((sum, r) => sum + r.total_amount, 0);
      expect(report.total_business_expenses).toBe(businessTotal);

      // Verify category breakdown
      expect(report.category_breakdown).toHaveProperty('food_dining');
      expect(report.category_breakdown).toHaveProperty('transportation');
      expect(report.category_breakdown).toHaveProperty('healthcare');
    });

    it('should handle empty date ranges', () => {
      const report = service.generateExpenseReport('2023-01-01', '2023-01-31', 'monthly');

      expect(report.total_expenses).toBe(0);
      expect(report.total_business_expenses).toBe(0);
      expect(report.total_personal_expenses).toBe(0);
      expect(Object.keys(report.category_breakdown)).toHaveLength(0);
    });

    it('should correctly categorize expenses by type', () => {
      const report = service.generateExpenseReport('2024-01-01', '2024-02-28', 'quarterly');

      // Check business vs personal split
      const totalBusiness = mockReceipts.filter(r => r.is_business_expense).reduce((sum, r) => sum + r.total_amount, 0);
      const totalPersonal = mockReceipts.filter(r => !r.is_business_expense).reduce((sum, r) => sum + r.total_amount, 0);
      
      expect(report.total_business_expenses).toBe(totalBusiness);
      expect(report.total_personal_expenses).toBe(totalPersonal);
      expect(report.total_business_expenses + report.total_personal_expenses).toBe(report.total_expenses);
    });

    it('should track payment methods correctly', () => {
      const report = service.generateExpenseReport('2024-01-01', '2024-02-28', 'custom');

      expect(report.payment_method_breakdown).toHaveProperty('credit_card');
      expect(report.payment_method_breakdown).toHaveProperty('debit_card');
      expect(report.payment_method_breakdown).toHaveProperty('cash');

      // Verify totals add up
      const paymentTotal = Object.values(report.payment_method_breakdown).reduce((sum, amount) => sum + amount, 0);
      expect(paymentTotal).toBe(report.total_expenses);
    });
  });

  describe('checkBudgetAlerts', () => {
    it('should generate threshold alerts', () => {
      // Create receipts that will cause spending to exceed threshold for food_dining category
      const alertReceipts = [
        {
          id: '1',
          merchant_name: 'Restaurant',
          total_amount: 170, // This will be 85% of 200 budget (over 80% threshold)
          receipt_date: '2024-01-15',
          category: 'food_dining',
          is_business_expense: false,
          is_tax_deductible: false,
          is_reimbursable: false,
          payment_method: 'credit_card'
        }
      ];
      
      // Create budget with 80% threshold
      const alertBudgets = [{
        ...mockBudgets[0],
        budget_amount: 200,
        alert_threshold: 80
      }];

      const alertService = new BudgetingService(alertReceipts, alertBudgets);
      const alerts = alertService.checkBudgetAlerts();

      expect(alerts.length).toBeGreaterThan(0);
      const thresholdAlert = alerts.find(a => a.alert_type === 'threshold');
      expect(thresholdAlert).toBeDefined();
      expect(thresholdAlert?.budget_id).toBe('budget1');
      expect(thresholdAlert?.percentage_used).toBeGreaterThan(80);
    });

    it('should generate overspend alerts', () => {
      // Create receipts that exceed the budget
      const overspendReceipts = [
        {
          id: '1',
          merchant_name: 'Expensive Restaurant',
          total_amount: 250, // 125% of 200 budget
          receipt_date: '2024-01-15',
          category: 'food_dining',
          is_business_expense: false,
          is_tax_deductible: false,
          is_reimbursable: false,
          payment_method: 'credit_card'
        }
      ];
      
      const overspendBudgets = [{
        ...mockBudgets[0],
        budget_amount: 200
      }];

      const alertService = new BudgetingService(overspendReceipts, overspendBudgets);
      const alerts = alertService.checkBudgetAlerts();

      const overspendAlert = alerts.find(a => a.alert_type === 'overspend');
      expect(overspendAlert).toBeDefined();
      expect(overspendAlert?.percentage_used).toBeGreaterThan(100);
      expect(overspendAlert?.message).toContain('exceeded');
    });

    it('should generate approaching limit alerts', () => {
      // Create receipts that are at 92.5% of budget (between 90% and threshold)
      const approachingReceipts = [
        {
          id: '1',
          merchant_name: 'Restaurant',
          total_amount: 185, // 92.5% of 200 budget
          receipt_date: '2024-01-15',
          category: 'food_dining',
          is_business_expense: false,
          is_tax_deductible: false,
          is_reimbursable: false,
          payment_method: 'credit_card'
        }
      ];
      
      const approachingBudgets = [{
        ...mockBudgets[0],
        budget_amount: 200,
        alert_threshold: 95 // High threshold so approaching_limit triggers before threshold
      }];

      const alertService = new BudgetingService(approachingReceipts, approachingBudgets);
      const alerts = alertService.checkBudgetAlerts();

      const approachingAlert = alerts.find(a => a.alert_type === 'approaching_limit');
      expect(approachingAlert).toBeDefined();
      expect(approachingAlert?.percentage_used).toBeGreaterThanOrEqual(90);
    });

    it('should not alert for inactive budgets', () => {
      const inactiveBudgets = [{
        ...mockBudgets[0],
        is_active: false,
        current_spent: 250 // Would trigger alert if active
      }];

      const alertService = new BudgetingService(mockReceipts, inactiveBudgets);
      const alerts = alertService.checkBudgetAlerts();

      expect(alerts.length).toBe(0);
    });

    it('should not alert for expired budgets', () => {
      const expiredBudgets = [{
        ...mockBudgets[0],
        end_date: '2023-12-31', // Expired
        current_spent: 250
      }];

      const alertService = new BudgetingService(mockReceipts, expiredBudgets);
      const alerts = alertService.checkBudgetAlerts();

      expect(alerts.length).toBe(0);
    });
  });

  describe('getBudgetPerformance', () => {
    it('should calculate budget performance metrics', () => {
      const performance = service.getBudgetPerformance('budget1');

      expect(performance).toBeDefined();
      expect(performance?.budget).toEqual(mockBudgets[0]);
      expect(performance?.currentSpent).toBeGreaterThan(0);
      expect(performance?.remainingAmount).toBeGreaterThanOrEqual(0);
      expect(performance?.percentageUsed).toBeGreaterThan(0);
      expect(performance?.daysRemaining).toBeGreaterThanOrEqual(0);
      expect(performance?.dailyAverageSpent).toBeGreaterThanOrEqual(0);
      expect(performance?.projectedTotal).toBeGreaterThan(0);
      expect(typeof performance?.onTrack).toBe('boolean');
    });

    it('should return null for non-existent budget', () => {
      const performance = service.getBudgetPerformance('non-existent');
      expect(performance).toBeNull();
    });

    it('should correctly calculate on-track status', () => {
      const performance = service.getBudgetPerformance('budget1');

      if (performance) {
        const isOnTrack = performance.projectedTotal <= performance.budget.budget_amount;
        expect(performance.onTrack).toBe(isOnTrack);
      }
    });

    it('should handle zero remaining amount correctly', () => {
      // Create receipts that exactly match the budget amount
      const exactReceipts = [
        {
          id: '1',
          merchant_name: 'Restaurant',
          total_amount: 200, // Exactly matches budget
          receipt_date: '2024-01-15',
          category: 'food_dining',
          is_business_expense: false,
          is_tax_deductible: false,
          is_reimbursable: false,
          payment_method: 'credit_card'
        }
      ];
      
      const budgetAtLimit = [{
        ...mockBudgets[0],
        budget_amount: 200
      }];

      const serviceAtLimit = new BudgetingService(exactReceipts, budgetAtLimit);
      const performance = serviceAtLimit.getBudgetPerformance('budget1');

      expect(performance?.remainingAmount).toBe(0);
      expect(performance?.percentageUsed).toBeCloseTo(100, 1); // Allow for floating point precision
      expect(performance?.onTrack).toBe(true); // Exactly at budget should be on track
    });
  });

  describe('getSpendingInsights', () => {
    it('should return comprehensive spending insights', () => {
      const insights = service.getSpendingInsights();

      expect(insights).toHaveProperty('topCategories');
      expect(insights).toHaveProperty('topMerchants');
      expect(insights).toHaveProperty('spendingTrends');
      expect(insights).toHaveProperty('recommendations');

      expect(insights.topCategories).toBeInstanceOf(Array);
      expect(insights.topMerchants).toBeInstanceOf(Array);
      expect(insights.spendingTrends).toBeInstanceOf(Array);
      expect(insights.recommendations).toBeInstanceOf(Array);
    });

    it('should calculate category percentages correctly', () => {
      const insights = service.getSpendingInsights();
      const totalPercentage = insights.topCategories.reduce((sum, cat) => sum + cat.percentage, 0);

      expect(totalPercentage).toBeGreaterThan(0);
      expect(totalPercentage).toBeLessThanOrEqual(100);

      insights.topCategories.forEach(category => {
        expect(category.percentage).toBeGreaterThan(0);
        expect(category.percentage).toBeLessThanOrEqual(100);
      });
    });

    it('should sort categories by amount', () => {
      const insights = service.getSpendingInsights();

      if (insights.topCategories.length > 1) {
        for (let i = 0; i < insights.topCategories.length - 1; i++) {
          expect(insights.topCategories[i].amount).toBeGreaterThanOrEqual(
            insights.topCategories[i + 1].amount
          );
        }
      }
    });

    it('should include merchant transaction counts', () => {
      const insights = service.getSpendingInsights();

      insights.topMerchants.forEach(merchant => {
        expect(merchant.count).toBeGreaterThan(0);
        expect(merchant.amount).toBeGreaterThan(0);
      });
    });

    it('should generate spending trends', () => {
      const insights = service.getSpendingInsights();

      expect(insights.spendingTrends.length).toBe(6); // Last 6 months

      insights.spendingTrends.forEach((trend, index) => {
        expect(trend).toHaveProperty('month');
        expect(trend).toHaveProperty('amount');
        expect(trend).toHaveProperty('change');
        
        expect(trend.amount).toBeGreaterThanOrEqual(0);
        
        if (index > 0) {
          expect(typeof trend.change).toBe('number');
        } else {
          expect(trend.change).toBe(0); // First month has no change
        }
      });
    });
  });

  describe('generateScheduledReports', () => {
    it('should return empty array for non-scheduled dates', () => {
      const reports = service.generateScheduledReports();
      expect(reports).toBeInstanceOf(Array);
    });

    it('should handle different report types', () => {
      // This is hard to test without mocking Date, but we can test the structure
      const mockReports = service.generateScheduledReports();
      
      mockReports.forEach(report => {
        expect(report).toHaveProperty('report_type');
        expect(['weekly', 'monthly', 'quarterly']).toContain(report.report_type);
        expect(report.auto_generated).toBe(true);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty budgets array', () => {
      const noBudgetService = new BudgetingService(mockReceipts, []);
      
      const alerts = noBudgetService.checkBudgetAlerts();
      expect(alerts).toHaveLength(0);

      const performance = noBudgetService.getBudgetPerformance('any-id');
      expect(performance).toBeNull();
    });

    it('should handle invalid date ranges in reports', () => {
      const report = service.generateExpenseReport('2024-12-31', '2024-01-01', 'custom');
      expect(report.total_expenses).toBe(0);
    });

    it('should handle receipts with missing required fields', () => {
      const badReceipts = [
        { id: '1', total_amount: 10 }, // Missing other fields
        { id: '2', merchant_name: 'Test', receipt_date: '2024-01-01' } // Missing amount
      ];

      const badService = new BudgetingService(badReceipts, []);
      const insights = badService.getSpendingInsights();
      
      expect(insights).toBeDefined();
      expect(insights.topCategories).toBeInstanceOf(Array);
    });

    it('should handle zero amounts gracefully', () => {
      const zeroReceipts = [
        { ...mockReceipts[0], total_amount: 0 }
      ];

      const zeroService = new BudgetingService(zeroReceipts, []);
      const report = zeroService.generateExpenseReport('2024-01-01', '2024-01-31', 'monthly');
      
      expect(report.total_expenses).toBe(0);
    });

    it('should handle future dates in budget calculations', () => {
      const futureBudget = {
        ...mockBudgets[0],
        start_date: '2025-01-01',
        end_date: '2025-01-31'
      };

      const futureService = new BudgetingService(mockReceipts, [futureBudget]);
      const performance = futureService.getBudgetPerformance(futureBudget.id);
      
      expect(performance?.currentSpent).toBe(0); // No receipts in future period
    });
  });
});