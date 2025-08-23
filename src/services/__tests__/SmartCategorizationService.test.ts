import { describe, it, expect, beforeEach } from 'vitest';
import { SmartCategorizationService, type CategorySuggestion } from '../../services/SmartCategorizationService';

describe('SmartCategorizationService', () => {
  let service: SmartCategorizationService;
  let mockReceipts: any[];

  beforeEach(() => {
    mockReceipts = [
      {
        id: '1',
        merchant_name: 'Starbucks Coffee',
        total_amount: 5.50,
        receipt_date: '2024-01-15',
        category: 'food_dining',
        description: 'Coffee and pastry'
      },
      {
        id: '2',
        merchant_name: 'Starbucks',
        total_amount: 4.25,
        receipt_date: '2024-01-20',
        category: 'food_dining',
        description: 'Morning coffee'
      },
      {
        id: '3',
        merchant_name: 'Shell Gas Station',
        total_amount: 45.00,
        receipt_date: '2024-01-18',
        category: 'transportation',
        description: 'Fuel'
      },
      {
        id: '4',
        merchant_name: 'Whole Foods Market',
        total_amount: 125.30,
        receipt_date: '2024-01-22',
        category: 'food_dining',
        description: 'Weekly groceries'
      },
      {
        id: '5',
        merchant_name: 'CVS Pharmacy',
        total_amount: 15.99,
        receipt_date: '2024-01-25',
        category: 'healthcare',
        description: 'Prescription pickup'
      }
    ];
    service = new SmartCategorizationService(mockReceipts);
  });

  describe('getCategorySuggestions', () => {
    it('should return merchant-based suggestions for known merchants', () => {
      const suggestions = service.getCategorySuggestions({
        merchant_name: 'Starbucks',
        total_amount: 5.00,
        receipt_date: '2024-01-30',
        description: 'Coffee'
      });

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].category).toBe('food_dining');
      expect(suggestions[0].confidence).toBeGreaterThan(0.5);
      expect(suggestions[0].reason).toContain('previous transactions');
    });

    it('should return keyword-based suggestions for unknown merchants', () => {
      const suggestions = service.getCategorySuggestions({
        merchant_name: 'Gas Station XYZ',
        total_amount: 50.00,
        receipt_date: '2024-01-30',
        description: 'Fuel purchase'
      });

      expect(suggestions.length).toBeGreaterThan(0);
      const transportationSuggestion = suggestions.find(s => s.category === 'transportation');
      expect(transportationSuggestion).toBeDefined();
      expect(transportationSuggestion?.reason).toContain('keywords');
    });

    it('should return amount-based suggestions', () => {
      const suggestions = service.getCategorySuggestions({
        merchant_name: 'Unknown Store',
        total_amount: 125.00, // Similar to Whole Foods amount
        receipt_date: '2024-01-30',
        description: 'Shopping'
      });

      expect(suggestions.length).toBeGreaterThan(0);
      const foodSuggestion = suggestions.find(s => s.category === 'food_dining');
      expect(foodSuggestion).toBeDefined();
      expect(foodSuggestion?.reason).toContain('typical for');
    });

    it('should handle empty merchant name gracefully', () => {
      const suggestions = service.getCategorySuggestions({
        merchant_name: '',
        total_amount: 25.00,
        receipt_date: '2024-01-30',
        description: 'Purchase'
      });

      expect(suggestions).toBeInstanceOf(Array);
    });

    it('should return suggestions sorted by confidence', () => {
      const suggestions = service.getCategorySuggestions({
        merchant_name: 'Starbucks Coffee Shop',
        total_amount: 5.50,
        receipt_date: '2024-01-30',
        description: 'Coffee and food'
      });

      if (suggestions.length > 1) {
        for (let i = 0; i < suggestions.length - 1; i++) {
          expect(suggestions[i].confidence).toBeGreaterThanOrEqual(suggestions[i + 1].confidence);
        }
      }
    });

    it('should limit suggestions to maximum 5', () => {
      const suggestions = service.getCategorySuggestions({
        merchant_name: 'Test Store',
        total_amount: 100.00,
        receipt_date: '2024-01-30',
        description: 'Various items restaurant food gas pharmacy'
      });

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('learnFromCorrection', () => {
    it('should update merchant patterns when user corrects category', () => {
      const newReceipt = {
        id: '6',
        merchant_name: 'New Coffee Shop',
        total_amount: 6.00,
        receipt_date: '2024-01-30'
      };

      // Learn from correction
      service.learnFromCorrection(newReceipt, 'other', 'food_dining');

      // Test that the service learned from the correction
      const suggestions = service.getCategorySuggestions({
        merchant_name: 'New Coffee Shop',
        total_amount: 5.50,
        receipt_date: '2024-02-01'
      });

      // Should now suggest food_dining for this merchant
      expect(suggestions.some(s => s.category === 'food_dining')).toBe(true);
    });

    it('should not update patterns when correction matches suggestion', () => {
      const receipt = mockReceipts[0]; // Starbucks -> food_dining
      
      // No learning should occur when suggestion matches actual
      service.learnFromCorrection(receipt, 'food_dining', 'food_dining');
      
      // Behavior should remain the same
      const suggestions = service.getCategorySuggestions({
        merchant_name: 'Starbucks',
        total_amount: 5.00,
        receipt_date: '2024-01-30'
      });

      expect(suggestions[0].category).toBe('food_dining');
    });
  });

  describe('getBulkCategorySuggestions', () => {
    it('should return suggestions for multiple uncategorized receipts', () => {
      const uncategorizedReceipts = [
        {
          id: '7',
          merchant_name: 'Starbucks',
          total_amount: 5.00,
          receipt_date: '2024-01-30',
          category: 'other'
        },
        {
          id: '8',
          merchant_name: 'Shell',
          total_amount: 40.00,
          receipt_date: '2024-01-30',
          category: 'other'
        }
      ];

      const bulkSuggestions = service.getBulkCategorySuggestions(uncategorizedReceipts);

      expect(bulkSuggestions.size).toBe(2);
      expect(bulkSuggestions.has('7')).toBe(true);
      expect(bulkSuggestions.has('8')).toBe(true);

      const starbucksSuggestions = bulkSuggestions.get('7');
      expect(starbucksSuggestions).toBeDefined();
      expect(starbucksSuggestions![0].category).toBe('food_dining');
    });

    it('should skip already categorized receipts', () => {
      const mixedReceipts = [
        {
          id: '9',
          merchant_name: 'Starbucks',
          total_amount: 5.00,
          receipt_date: '2024-01-30',
          category: 'food_dining' // Already categorized
        },
        {
          id: '10',
          merchant_name: 'Shell',
          total_amount: 40.00,
          receipt_date: '2024-01-30',
          category: 'other' // Needs categorization
        }
      ];

      const bulkSuggestions = service.getBulkCategorySuggestions(mixedReceipts);

      expect(bulkSuggestions.size).toBe(1);
      expect(bulkSuggestions.has('10')).toBe(true);
      expect(bulkSuggestions.has('9')).toBe(false);
    });
  });

  describe('getCategorizationStats', () => {
    it('should return comprehensive statistics', () => {
      const stats = service.getCategorizationStats();

      expect(stats).toHaveProperty('totalPatterns');
      expect(stats).toHaveProperty('merchantPatterns');
      expect(stats).toHaveProperty('spendingPatterns');
      expect(stats).toHaveProperty('userCorrections');
      expect(stats).toHaveProperty('topMerchants');
      expect(stats).toHaveProperty('categoryCoverage');

      expect(stats.totalPatterns).toBeGreaterThan(0);
      expect(stats.topMerchants).toBeInstanceOf(Array);
      expect(stats.categoryCoverage).toBeInstanceOf(Object);
    });

    it('should track merchant frequency correctly', () => {
      const stats = service.getCategorizationStats();
      
      const starbucksPattern = stats.topMerchants.find(m => m.merchant.includes('starbucks'));
      expect(starbucksPattern).toBeDefined();
      expect(starbucksPattern?.frequency).toBe(2); // Two Starbucks entries
      expect(starbucksPattern?.category).toBe('food_dining');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty receipts array', () => {
      const emptyService = new SmartCategorizationService([]);
      
      const suggestions = emptyService.getCategorySuggestions({
        merchant_name: 'Test Merchant',
        total_amount: 10.00,
        receipt_date: '2024-01-30'
      });

      expect(suggestions).toBeInstanceOf(Array);
    });

    it('should handle invalid receipt data', () => {
      const suggestions = service.getCategorySuggestions({
        merchant_name: null as any,
        total_amount: -5.00,
        receipt_date: 'invalid-date'
      });

      expect(suggestions).toBeInstanceOf(Array);
    });

    it('should handle very large amounts', () => {
      const suggestions = service.getCategorySuggestions({
        merchant_name: 'Expensive Store',
        total_amount: 10000.00,
        receipt_date: '2024-01-30'
      });

      expect(suggestions).toBeInstanceOf(Array);
    });

    it('should handle special characters in merchant names', () => {
      const suggestions = service.getCategorySuggestions({
        merchant_name: 'José\'s Café & Restaurant (Downtown)',
        total_amount: 25.00,
        receipt_date: '2024-01-30'
      });

      expect(suggestions).toBeInstanceOf(Array);
    });
  });

  describe('Confidence Scoring', () => {
    it('should assign higher confidence to frequent merchants', () => {
      // Starbucks appears twice in mock data
      const suggestions = service.getCategorySuggestions({
        merchant_name: 'Starbucks',
        total_amount: 5.00,
        receipt_date: '2024-01-30'
      });

      expect(suggestions[0].confidence).toBeGreaterThan(0.6);
    });

    it('should assign lower confidence to keyword matches', () => {
      const suggestions = service.getCategorySuggestions({
        merchant_name: 'Random Coffee Place',
        total_amount: 5.00,
        receipt_date: '2024-01-30'
      });

      const coffeeMatch = suggestions.find(s => s.reason.includes('keywords'));
      if (coffeeMatch) {
        expect(coffeeMatch.confidence).toBeLessThan(0.9);
      }
    });

    it('should provide reasonable confidence ranges', () => {
      const suggestions = service.getCategorySuggestions({
        merchant_name: 'Starbucks',
        total_amount: 5.00,
        receipt_date: '2024-01-30'
      });

      suggestions.forEach(suggestion => {
        expect(suggestion.confidence).toBeGreaterThan(0);
        expect(suggestion.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Temporal Patterns', () => {
    it('should consider day of week patterns', () => {
      // Create receipts with specific day patterns
      const weekendReceipts = [
        {
          id: '11',
          merchant_name: 'Restaurant',
          total_amount: 50.00,
          receipt_date: '2024-01-20', // Saturday
          category: 'food_dining'
        },
        {
          id: '12',
          merchant_name: 'Restaurant',
          total_amount: 55.00,
          receipt_date: '2024-01-21', // Sunday
          category: 'food_dining'
        }
      ];

      const temporalService = new SmartCategorizationService([...mockReceipts, ...weekendReceipts]);
      
      // Test weekend suggestion
      const suggestions = temporalService.getCategorySuggestions({
        merchant_name: 'Unknown Restaurant',
        total_amount: 52.00,
        receipt_date: '2024-01-27' // Saturday
      });

      const temporalSuggestion = suggestions.find(s => s.reason.includes('common on'));
      expect(temporalSuggestion).toBeDefined();
    });
  });
});