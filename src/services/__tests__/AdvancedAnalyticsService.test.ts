/**
 * Unit tests for AdvancedAnalyticsService
 * Tests forecasting, anomaly detection, insights generation, and analytics calculations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdvancedAnalyticsService } from '@/services/AdvancedAnalyticsService';
import { Receipt } from '@/hooks/useReceipts';

describe('AdvancedAnalyticsService', () => {
  let service: AdvancedAnalyticsService;
  let mockReceipts: Receipt[];

  beforeEach(() => {
    // Create comprehensive mock receipts data
    mockReceipts = [
      {
        id: '1',
        name: 'Coffee Purchase',
        merchant_name: 'Starbucks',
        total_amount: 5.50,
        receipt_date: '2024-01-15',
        category: 'food_dining',
        is_business_expense: false,
        is_tax_deductible: false
      },
      {
        id: '2',
        name: 'Grocery Shopping',
        merchant_name: 'Walmart',
        total_amount: 89.99,
        receipt_date: '2024-01-20',
        category: 'food_dining',
        is_business_expense: false,
        is_tax_deductible: false
      },
      {
        id: '3',
        name: 'Gas Fill-up',
        merchant_name: 'Shell',
        total_amount: 45.00,
        receipt_date: '2024-02-01',
        category: 'transportation',
        is_business_expense: true,
        is_tax_deductible: true
      },
      {
        id: '4',
        name: 'Office Supplies',
        merchant_name: 'Staples',
        total_amount: 125.50,
        receipt_date: '2024-02-05',
        category: 'business',
        is_business_expense: true,
        is_tax_deductible: true
      },
      {
        id: '5',
        name: 'Unusual Large Purchase',
        merchant_name: 'Electronics Store',
        total_amount: 2500.00,
        receipt_date: '2024-02-10',
        category: 'electronics',
        is_business_expense: false,
        is_tax_deductible: false
      },
      {
        id: '6',
        name: 'Another Coffee',
        merchant_name: 'Starbucks',
        total_amount: 6.25,
        receipt_date: '2024-02-15',
        category: 'food_dining',
        is_business_expense: false,
        is_tax_deductible: false
      }
    ] as Receipt[];

    service = new AdvancedAnalyticsService(mockReceipts);
  });

  describe('Spending Forecast Generation', () => {
    it('should generate forecasts when sufficient data exists', () => {
      const forecasts = service.generateSpendingForecast();
      
      expect(forecasts).toBeInstanceOf(Array);
      expect(forecasts.length).toBeGreaterThan(0);
      expect(forecasts.length).toBeLessThanOrEqual(6); // 6 months max
    });

    it('should return empty array with insufficient data', () => {
      const serviceWithFewReceipts = new AdvancedAnalyticsService(mockReceipts.slice(0, 2));
      const forecasts = serviceWithFewReceipts.generateSpendingForecast();
      
      expect(forecasts).toEqual([]);
    });

    it('should include confidence levels in forecasts', () => {
      const forecasts = service.generateSpendingForecast();
      
      if (forecasts.length > 0) {
        forecasts.forEach(forecast => {
          expect(forecast.confidence_level).toBeGreaterThan(0);
          expect(forecast.confidence_level).toBeLessThanOrEqual(1);
          expect(forecast.predicted_amount).toBeGreaterThanOrEqual(0);
          expect(forecast.trend).toMatch(/^(increasing|decreasing|stable)$/);
        });
      }
    });

    it('should decrease confidence over time', () => {
      const forecasts = service.generateSpendingForecast();
      
      if (forecasts.length > 1) {
        for (let i = 1; i < forecasts.length; i++) {
          expect(forecasts[i].confidence_level).toBeLessThanOrEqual(forecasts[i - 1].confidence_level);
        }
      }
    });

    it('should generate valid future dates', () => {
      const forecasts = service.generateSpendingForecast();
      const now = new Date();
      
      forecasts.forEach(forecast => {
        const forecastDate = new Date(forecast.month + '-01');
        expect(forecastDate.getTime()).toBeGreaterThan(now.getTime());
      });
    });
  });

  describe('Spending Anomaly Detection', () => {
    it('should detect anomalies in spending patterns', () => {
      const anomalies = service.detectSpendingAnomalies();
      
      expect(anomalies).toBeInstanceOf(Array);
      // The $2500 electronics purchase should be detected as an anomaly
      expect(anomalies.length).toBeGreaterThan(0);
    });

    it('should identify high-value anomalies', () => {
      const anomalies = service.detectSpendingAnomalies();
      
      const largeAnomaly = anomalies.find(a => a.amount === 2500.00);
      expect(largeAnomaly).toBeDefined();
      if (largeAnomaly) {
        expect(largeAnomaly.severity).toBe('high');
        expect(largeAnomaly.anomaly_score).toBeGreaterThan(2);
      }
    });

    it('should provide meaningful anomaly descriptions', () => {
      const anomalies = service.detectSpendingAnomalies();
      
      anomalies.forEach(anomaly => {
        expect(anomaly.reason).toBeDefined();
        expect(anomaly.reason.length).toBeGreaterThan(0);
        expect(anomaly.expected_range.min).toBeLessThan(anomaly.expected_range.max);
      });
    });

    it('should sort anomalies by severity', () => {
      const anomalies = service.detectSpendingAnomalies();
      
      if (anomalies.length > 1) {
        for (let i = 1; i < anomalies.length; i++) {
          expect(anomalies[i].anomaly_score).toBeLessThanOrEqual(anomalies[i - 1].anomaly_score);
        }
      }
    });

    it('should not detect anomalies in categories with insufficient data', () => {
      const singleReceiptService = new AdvancedAnalyticsService([mockReceipts[0]]);
      const anomalies = singleReceiptService.detectSpendingAnomalies();
      
      expect(anomalies).toHaveLength(0);
    });
  });

  describe('Category Insights Generation', () => {
    it('should generate insights for all categories', () => {
      const insights = service.getCategoryInsights();
      
      expect(insights).toBeInstanceOf(Array);
      expect(insights.length).toBeGreaterThan(0);
      
      insights.forEach(insight => {
        expect(insight.category).toBeDefined();
        expect(insight.current_period_amount).toBeGreaterThanOrEqual(0);
        expect(insight.previous_period_amount).toBeGreaterThanOrEqual(0);
        expect(insight.trend).toMatch(/^(up|down|stable)$/);
        expect(insight.recommendation).toBeDefined();
      });
    });

    it('should calculate percentage changes correctly', () => {
      const insights = service.getCategoryInsights();
      
      insights.forEach(insight => {
        if (insight.previous_period_amount > 0) {
          const expectedChange = ((insight.current_period_amount - insight.previous_period_amount) / insight.previous_period_amount) * 100;
          expect(Math.abs(insight.change_percentage - expectedChange)).toBeLessThan(0.01);
        }
      });
    });

    it('should sort insights by change magnitude', () => {
      const insights = service.getCategoryInsights();
      
      if (insights.length > 1) {
        for (let i = 1; i < insights.length; i++) {
          expect(Math.abs(insights[i].change_percentage)).toBeLessThanOrEqual(Math.abs(insights[i - 1].change_percentage));
        }
      }
    });

    it('should provide optimization potential', () => {
      const insights = service.getCategoryInsights();
      
      insights.forEach(insight => {
        expect(insight.optimization_potential).toBeGreaterThanOrEqual(0);
        expect(insight.optimization_potential).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Merchant Loyalty Analysis', () => {
    it('should analyze merchant loyalty patterns', () => {
      const analysis = service.analyzeMerchantLoyalty();
      
      expect(analysis).toBeInstanceOf(Array);
      expect(analysis.length).toBeGreaterThan(0);
    });

    it('should calculate merchant metrics correctly', () => {
      const analysis = service.analyzeMerchantLoyalty();
      
      analysis.forEach(merchant => {
        expect(merchant.merchant_name).toBeDefined();
        expect(merchant.total_spent).toBeGreaterThan(0);
        expect(merchant.visit_count).toBeGreaterThan(0);
        expect(merchant.average_transaction).toBe(merchant.total_spent / merchant.visit_count);
        expect(merchant.loyalty_tier).toMatch(/^(bronze|silver|gold|platinum)$/);
        expect(merchant.spending_trend).toMatch(/^(increasing|decreasing|stable)$/);
      });
    });

    it('should identify frequent merchants', () => {
      const analysis = service.analyzeMerchantLoyalty();
      
      const starbucks = analysis.find(m => m.merchant_name === 'Starbucks');
      expect(starbucks).toBeDefined();
      if (starbucks) {
        expect(starbucks.visit_count).toBeGreaterThanOrEqual(2);
        expect(starbucks.total_spent).toBeGreaterThan(10);
      }
    });

    it('should sort merchants by total spending', () => {
      const analysis = service.analyzeMerchantLoyalty();
      
      if (analysis.length > 1) {
        for (let i = 1; i < analysis.length; i++) {
          expect(analysis[i].total_spent).toBeLessThanOrEqual(analysis[i - 1].total_spent);
        }
      }
    });

    it('should assign appropriate loyalty tiers', () => {
      const analysis = service.analyzeMerchantLoyalty();
      
      const highSpender = analysis.find(m => m.total_spent > 1000 && m.visit_count > 10);
      if (highSpender) {
        expect(highSpender.loyalty_tier).toBe('platinum');
      }
    });
  });

  describe('Budget Recommendations', () => {
    it('should generate budget recommendations', () => {
      const recommendations = service.generateBudgetRecommendations();
      
      expect(recommendations).toBeInstanceOf(Array);
      
      recommendations.forEach(rec => {
        expect(rec.category).toBeDefined();
        expect(rec.current_spending).toBeGreaterThan(0);
        expect(rec.recommended_budget).toBeLessThanOrEqual(rec.current_spending);
        expect(rec.savings_potential).toBeGreaterThanOrEqual(0);
        expect(rec.difficulty).toMatch(/^(easy|moderate|challenging)$/);
        expect(rec.strategies).toBeInstanceOf(Array);
        expect(rec.strategies.length).toBeGreaterThan(0);
      });
    });

    it('should only suggest meaningful savings', () => {
      const recommendations = service.generateBudgetRecommendations();
      
      recommendations.forEach(rec => {
        expect(rec.savings_potential).toBeGreaterThan(50);
      });
    });

    it('should provide appropriate strategies for difficulty levels', () => {
      const recommendations = service.generateBudgetRecommendations();
      
      recommendations.forEach(rec => {
        expect(rec.strategies.length).toBeGreaterThan(0);
        expect(rec.strategies.every(s => typeof s === 'string')).toBe(true);
      });
    });
  });

  describe('Tax Optimization Analysis', () => {
    it('should analyze tax optimization opportunities', () => {
      const optimization = service.analyzeTaxOptimization();
      
      expect(optimization.current_deductions).toBeGreaterThanOrEqual(0);
      expect(optimization.potential_additional_deductions).toBeGreaterThanOrEqual(0);
      expect(optimization.missed_opportunities).toBeInstanceOf(Array);
      expect(optimization.recommendations).toBeInstanceOf(Array);
      expect(optimization.estimated_savings).toBeGreaterThanOrEqual(0);
    });

    it('should calculate current deductions correctly', () => {
      const optimization = service.analyzeTaxOptimization();
      
      const expectedDeductions = mockReceipts
        .filter(r => r.is_tax_deductible)
        .reduce((sum, r) => sum + r.total_amount, 0);
      
      expect(optimization.current_deductions).toBe(expectedDeductions);
    });

    it('should identify missed opportunities', () => {
      const optimization = service.analyzeTaxOptimization();
      
      optimization.missed_opportunities.forEach(opportunity => {
        expect(opportunity.receipt_id).toBeDefined();
        expect(opportunity.amount).toBeGreaterThan(0);
        expect(opportunity.reason).toBeDefined();
      });
    });

    it('should provide tax recommendations', () => {
      const optimization = service.analyzeTaxOptimization();
      
      expect(optimization.recommendations.length).toBeGreaterThan(0);
      optimization.recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(0);
      });
    });

    it('should estimate tax savings correctly', () => {
      const optimization = service.analyzeTaxOptimization();
      
      const expectedSavings = optimization.potential_additional_deductions * 0.25;
      expect(optimization.estimated_savings).toBe(expectedSavings);
    });
  });

  describe('Seasonal Pattern Identification', () => {
    it('should identify seasonal spending patterns', () => {
      const patterns = service.identifySeasonalPatterns();
      
      expect(patterns).toBeInstanceOf(Array);
      expect(patterns.length).toBeLessThanOrEqual(12); // Max 12 months
      
      patterns.forEach(pattern => {
        expect(pattern.month).toBeGreaterThanOrEqual(0);
        expect(pattern.month).toBeLessThan(12);
        expect(pattern.month_name).toBeDefined();
        expect(pattern.average_spending).toBeGreaterThanOrEqual(0);
        expect(pattern.typical_categories).toBeInstanceOf(Array);
        expect(pattern.spending_index).toBeGreaterThan(0);
      });
    });

    it('should calculate spending indices correctly', () => {
      const patterns = service.identifySeasonalPatterns();
      
      if (patterns.length > 0) {
        const averageIndex = patterns.reduce((sum, p) => sum + p.spending_index, 0) / patterns.length;
        // The average index should be close to 1.0
        expect(Math.abs(averageIndex - 1.0)).toBeLessThan(0.5);
      }
    });

    it('should include month names', () => {
      const patterns = service.identifySeasonalPatterns();
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      patterns.forEach(pattern => {
        expect(monthNames).toContain(pattern.month_name);
      });
    });
  });

  describe('Predictive Insights Generation', () => {
    it('should generate predictive insights', () => {
      const insights = service.generatePredictiveInsights();
      
      expect(insights).toBeInstanceOf(Array);
      
      insights.forEach(insight => {
        expect(insight.type).toMatch(/^(spending_spike|category_shift|merchant_loyalty|tax_opportunity)$/);
        expect(insight.confidence).toBeGreaterThan(0);
        expect(insight.confidence).toBeLessThanOrEqual(1);
        expect(insight.description).toBeDefined();
        expect(insight.impact).toMatch(/^(low|medium|high)$/);
        expect(insight.action_required).toBeDefined();
        expect(insight.recommendations).toBeInstanceOf(Array);
        expect(insight.timeline).toBeDefined();
      });
    });

    it('should detect spending spikes', () => {
      // Mock receipts with increasing trend
      const trendingReceipts = [
        ...mockReceipts,
        {
          id: '7',
          name: 'Large Purchase 1',
          merchant_name: 'Store A',
          total_amount: 500.00,
          receipt_date: '2024-02-20',
          category: 'shopping',
          is_business_expense: false,
          is_tax_deductible: false
        },
        {
          id: '8',
          name: 'Large Purchase 2',
          merchant_name: 'Store B',
          total_amount: 750.00,
          receipt_date: '2024-02-25',
          category: 'shopping',
          is_business_expense: false,
          is_tax_deductible: false
        }
      ] as Receipt[];

      const trendingService = new AdvancedAnalyticsService(trendingReceipts);
      const insights = trendingService.generatePredictiveInsights();
      
      const spendingSpike = insights.find(i => i.type === 'spending_spike');
      if (spendingSpike) {
        expect(spendingSpike.confidence).toBeGreaterThan(0.5);
        expect(spendingSpike.impact).toMatch(/^(medium|high)$/);
      }
    });

    it('should provide actionable recommendations', () => {
      const insights = service.generatePredictiveInsights();
      
      insights.forEach(insight => {
        expect(insight.recommendations.length).toBeGreaterThan(0);
        insight.recommendations.forEach(rec => {
          expect(typeof rec).toBe('string');
          expect(rec.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty receipts array', () => {
      const emptyService = new AdvancedAnalyticsService([]);
      
      expect(emptyService.generateSpendingForecast()).toEqual([]);
      expect(emptyService.detectSpendingAnomalies()).toEqual([]);
      expect(emptyService.getCategoryInsights()).toEqual([]);
      expect(emptyService.analyzeMerchantLoyalty()).toEqual([]);
      expect(emptyService.generateBudgetRecommendations()).toEqual([]);
      expect(emptyService.identifySeasonalPatterns()).toEqual([]);
      expect(emptyService.generatePredictiveInsights()).toEqual([]);
    });

    it('should handle receipts with missing data', () => {
      const incompleteReceipts = [
        {
          id: '1',
          name: 'Incomplete Receipt',
          total_amount: 10.00,
          receipt_date: '2024-01-15',
          category: 'other'
          // Missing optional fields
        }
      ] as Receipt[];

      const incompleteService = new AdvancedAnalyticsService(incompleteReceipts);
      
      expect(() => incompleteService.generateSpendingForecast()).not.toThrow();
      expect(() => incompleteService.detectSpendingAnomalies()).not.toThrow();
      expect(() => incompleteService.getCategoryInsights()).not.toThrow();
    });

    it('should handle invalid date formats gracefully', () => {
      const invalidDateReceipts = [
        {
          id: '1',
          name: 'Invalid Date Receipt',
          total_amount: 10.00,
          receipt_date: 'invalid-date',
          category: 'other'
        }
      ] as Receipt[];

      const invalidService = new AdvancedAnalyticsService(invalidDateReceipts);
      
      expect(() => invalidService.identifySeasonalPatterns()).not.toThrow();
    });

    it('should handle zero amounts gracefully', () => {
      const zeroAmountReceipts = [
        {
          id: '1',
          name: 'Zero Amount Receipt',
          total_amount: 0,
          receipt_date: '2024-01-15',
          category: 'other'
        }
      ] as Receipt[];

      const zeroService = new AdvancedAnalyticsService(zeroAmountReceipts);
      
      expect(() => zeroService.detectSpendingAnomalies()).not.toThrow();
      expect(() => zeroService.analyzeMerchantLoyalty()).not.toThrow();
    });
  });

  describe('Performance and Efficiency', () => {
    it('should handle large datasets efficiently', () => {
      // Create a large dataset
      const largeDataset: Receipt[] = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push({
          id: `receipt-${i}`,
          name: `Receipt ${i}`,
          merchant_name: `Merchant ${i % 10}`,
          total_amount: Math.random() * 100,
          receipt_date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
          category: ['food_dining', 'transportation', 'shopping', 'business'][i % 4],
          is_business_expense: i % 3 === 0,
          is_tax_deductible: i % 4 === 0
        } as Receipt);
      }

      const largeService = new AdvancedAnalyticsService(largeDataset);
      
      const startTime = performance.now();
      largeService.generateSpendingForecast();
      largeService.detectSpendingAnomalies();
      largeService.getCategoryInsights();
      largeService.analyzeMerchantLoyalty();
      const endTime = performance.now();
      
      // Should complete within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});