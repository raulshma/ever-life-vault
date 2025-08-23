/**
 * Advanced Analytics Service
 * Provides sophisticated analytics capabilities for receipt data including
 * predictive insights, anomaly detection, spending forecasts, and AI-powered recommendations.
 */

import { Receipt } from '@/hooks/useReceipts';

export interface SpendingForecast {
  month: string;
  predicted_amount: number;
  confidence_level: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface SpendingAnomaly {
  receipt_id: string;
  receipt_name: string;
  date: string;
  amount: number;
  expected_range: { min: number; max: number };
  anomaly_score: number;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CategoryInsight {
  category: string;
  current_period_amount: number;
  previous_period_amount: number;
  change_percentage: number;
  trend: 'up' | 'down' | 'stable';
  recommendation: string;
  optimization_potential: number;
}

export interface MerchantAnalysis {
  merchant_name: string;
  total_spent: number;
  visit_count: number;
  average_transaction: number;
  frequency_score: number;
  loyalty_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  last_visit: string;
  spending_trend: 'increasing' | 'decreasing' | 'stable';
}

export interface BudgetRecommendation {
  category: string;
  current_spending: number;
  recommended_budget: number;
  savings_potential: number;
  difficulty: 'easy' | 'moderate' | 'challenging';
  strategies: string[];
}

export interface TaxOptimization {
  current_deductions: number;
  potential_additional_deductions: number;
  missed_opportunities: Array<{
    receipt_id: string;
    amount: number;
    reason: string;
  }>;
  recommendations: string[];
  estimated_savings: number;
}

export interface SeasonalPattern {
  month: number;
  month_name: string;
  average_spending: number;
  typical_categories: string[];
  spending_index: number; // 1.0 = average, >1.0 = above average
}

export interface PredictiveInsight {
  type: 'spending_spike' | 'category_shift' | 'merchant_loyalty' | 'tax_opportunity';
  confidence: number;
  description: string;
  impact: 'low' | 'medium' | 'high';
  action_required: boolean;
  recommendations: string[];
  timeline: string;
}

export class AdvancedAnalyticsService {
  private receipts: Receipt[];

  constructor(receipts: Receipt[]) {
    this.receipts = receipts;
  }

  /**
   * Generate spending forecasts for the next 6 months
   */
  generateSpendingForecast(): SpendingForecast[] {
    const monthlyData = this.getMonthlySpendingData();
    const forecasts: SpendingForecast[] = [];

    if (monthlyData.length < 3) {
      // Not enough data for reliable forecasting
      return [];
    }

    // Simple linear regression for trend analysis
    const amounts = monthlyData.map(m => m.amount);
    const trend = this.calculateTrend(amounts);
    const avgGrowth = this.calculateAverageGrowth(amounts);
    const lastAmount = amounts[amounts.length - 1] || 0;

    // Generate 6 months of forecasts
    for (let i = 1; i <= 6; i++) {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + i);
      
      const predicted = lastAmount * Math.pow(1 + avgGrowth, i);
      const confidence = Math.max(0.3, 0.9 - (i * 0.1)); // Decreasing confidence over time

      forecasts.push({
        month: futureDate.toISOString().substring(0, 7),
        predicted_amount: Math.max(0, predicted),
        confidence_level: confidence,
        trend: trend
      });
    }

    return forecasts;
  }

  /**
   * Detect spending anomalies
   */
  detectSpendingAnomalies(): SpendingAnomaly[] {
    const anomalies: SpendingAnomaly[] = [];
    const categoryStats = this.getCategoryStatistics();

    this.receipts.forEach(receipt => {
      const stats = categoryStats.get(receipt.category);
      if (!stats || stats.count < 5) return; // Need enough data points

      const zScore = Math.abs((receipt.total_amount - stats.mean) / stats.stdDev);
      
      if (zScore > 2) { // More than 2 standard deviations
        let severity: 'low' | 'medium' | 'high' = 'low';
        let reason = '';

        if (zScore > 3) {
          severity = 'high';
          reason = `Extremely unusual amount for ${receipt.category} category`;
        } else if (zScore > 2.5) {
          severity = 'medium';
          reason = `Significantly higher than typical ${receipt.category} spending`;
        } else {
          severity = 'low';
          reason = `Moderately higher than usual ${receipt.category} spending`;
        }

        anomalies.push({
          receipt_id: receipt.id,
          receipt_name: receipt.name,
          date: receipt.receipt_date,
          amount: receipt.total_amount,
          expected_range: {
            min: stats.mean - stats.stdDev,
            max: stats.mean + stats.stdDev
          },
          anomaly_score: zScore,
          reason,
          severity
        });
      }
    });

    return anomalies.sort((a, b) => b.anomaly_score - a.anomaly_score);
  }

  /**
   * Generate category insights with recommendations
   */
  getCategoryInsights(): CategoryInsight[] {
    const insights: CategoryInsight[] = [];
    const categories = new Set(this.receipts.map(r => r.category));

    categories.forEach(category => {
      const categoryReceipts = this.receipts.filter(r => r.category === category);
      
      // Split data into current and previous periods
      const midPoint = new Date();
      midPoint.setMonth(midPoint.getMonth() - 3);
      
      const current = categoryReceipts.filter(r => new Date(r.receipt_date) >= midPoint);
      const previous = categoryReceipts.filter(r => new Date(r.receipt_date) < midPoint);

      const currentAmount = current.reduce((sum, r) => sum + r.total_amount, 0);
      const previousAmount = previous.reduce((sum, r) => sum + r.total_amount, 0);

      if (previousAmount > 0) {
        const changePercent = ((currentAmount - previousAmount) / previousAmount) * 100;
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (Math.abs(changePercent) > 15) {
          trend = changePercent > 0 ? 'up' : 'down';
        }

        insights.push({
          category,
          current_period_amount: currentAmount,
          previous_period_amount: previousAmount,
          change_percentage: changePercent,
          trend,
          recommendation: this.getCategoryRecommendation(category, trend, changePercent),
          optimization_potential: this.calculateOptimizationPotential(categoryReceipts)
        });
      }
    });

    return insights.sort((a, b) => Math.abs(b.change_percentage) - Math.abs(a.change_percentage));
  }

  /**
   * Analyze merchant loyalty and spending patterns
   */
  analyzeMerchantLoyalty(): MerchantAnalysis[] {
    const merchantData = new Map<string, Receipt[]>();
    
    this.receipts.forEach(receipt => {
      if (receipt.merchant_name) {
        const existing = merchantData.get(receipt.merchant_name) || [];
        existing.push(receipt);
        merchantData.set(receipt.merchant_name, existing);
      }
    });

    const analyses: MerchantAnalysis[] = [];

    merchantData.forEach((receipts, merchantName) => {
      const totalSpent = receipts.reduce((sum, r) => sum + r.total_amount, 0);
      const avgTransaction = totalSpent / receipts.length;
      const lastVisit = Math.max(...receipts.map(r => new Date(r.receipt_date).getTime()));
      
      // Calculate frequency score (visits per month)
      const firstVisit = Math.min(...receipts.map(r => new Date(r.receipt_date).getTime()));
      const monthsSpan = Math.max(1, (lastVisit - firstVisit) / (30 * 24 * 60 * 60 * 1000));
      const frequencyScore = receipts.length / monthsSpan;

      // Determine loyalty tier
      let loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze';
      if (totalSpent > 1000 && receipts.length > 10) loyaltyTier = 'platinum';
      else if (totalSpent > 500 && receipts.length > 5) loyaltyTier = 'gold';
      else if (totalSpent > 200 && receipts.length > 3) loyaltyTier = 'silver';

      // Calculate spending trend
      const midPoint = receipts.length / 2;
      const firstHalf = receipts.slice(0, Math.floor(midPoint));
      const secondHalf = receipts.slice(Math.floor(midPoint));
      
      const firstHalfAvg = firstHalf.reduce((sum, r) => sum + r.total_amount, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, r) => sum + r.total_amount, 0) / secondHalf.length;
      
      let spendingTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (secondHalf.length > 0 && firstHalf.length > 0) {
        const trendPercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
        if (Math.abs(trendPercent) > 20) {
          spendingTrend = trendPercent > 0 ? 'increasing' : 'decreasing';
        }
      }

      analyses.push({
        merchant_name: merchantName,
        total_spent: totalSpent,
        visit_count: receipts.length,
        average_transaction: avgTransaction,
        frequency_score: frequencyScore,
        loyalty_tier: loyaltyTier,
        last_visit: new Date(lastVisit).toISOString().split('T')[0],
        spending_trend: spendingTrend
      });
    });

    return analyses.sort((a, b) => b.total_spent - a.total_spent);
  }

  /**
   * Generate budget recommendations
   */
  generateBudgetRecommendations(): BudgetRecommendation[] {
    const categoryInsights = this.getCategoryInsights();
    const recommendations: BudgetRecommendation[] = [];

    categoryInsights.forEach(insight => {
      const currentSpending = insight.current_period_amount;
      const optimizationRate = Math.min(0.3, insight.optimization_potential / 100);
      const recommendedBudget = currentSpending * (1 - optimizationRate);
      const savingsPotential = currentSpending - recommendedBudget;

      let difficulty: 'easy' | 'moderate' | 'challenging' = 'easy';
      if (optimizationRate > 0.2) difficulty = 'challenging';
      else if (optimizationRate > 0.1) difficulty = 'moderate';

      recommendations.push({
        category: insight.category,
        current_spending: currentSpending,
        recommended_budget: recommendedBudget,
        savings_potential: savingsPotential,
        difficulty,
        strategies: this.getBudgetStrategies(insight.category, difficulty)
      });
    });

    return recommendations.filter(r => r.savings_potential > 50); // Only meaningful savings
  }

  /**
   * Analyze tax optimization opportunities
   */
  analyzeTaxOptimization(): TaxOptimization {
    const businessReceipts = this.receipts.filter(r => r.is_business_expense);
    const deductibleReceipts = this.receipts.filter(r => r.is_tax_deductible);
    
    const currentDeductions = deductibleReceipts.reduce((sum, r) => sum + r.total_amount, 0);
    
    // Find potentially missed opportunities
    const missedOpportunities = this.receipts.filter(r => 
      !r.is_tax_deductible && 
      (r.is_business_expense || this.isPotentiallyDeductible(r))
    );

    const potentialAdditional = missedOpportunities.reduce((sum, r) => sum + r.total_amount, 0);
    
    return {
      current_deductions: currentDeductions,
      potential_additional_deductions: potentialAdditional,
      missed_opportunities: missedOpportunities.map(r => ({
        receipt_id: r.id,
        amount: r.total_amount,
        reason: this.getDeductionReason(r)
      })),
      recommendations: this.getTaxRecommendations(businessReceipts.length, deductibleReceipts.length),
      estimated_savings: potentialAdditional * 0.25 // Assume 25% tax rate
    };
  }

  /**
   * Identify seasonal spending patterns
   */
  identifySeasonalPatterns(): SeasonalPattern[] {
    const monthlyData = new Map<number, { amounts: number[], categories: string[] }>();

    this.receipts.forEach(receipt => {
      const month = new Date(receipt.receipt_date).getMonth();
      const existing = monthlyData.get(month) || { amounts: [], categories: [] };
      existing.amounts.push(receipt.total_amount);
      existing.categories.push(receipt.category);
      monthlyData.set(month, existing);
    });

    const patterns: SeasonalPattern[] = [];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const overallAverage = this.receipts.reduce((sum, r) => sum + r.total_amount, 0) / 12;

    for (let month = 0; month < 12; month++) {
      const data = monthlyData.get(month);
      if (data) {
        const avgSpending = data.amounts.reduce((sum, a) => sum + a, 0) / data.amounts.length;
        const topCategories = this.getTopCategories(data.categories);
        
        patterns.push({
          month,
          month_name: monthNames[month],
          average_spending: avgSpending,
          typical_categories: topCategories,
          spending_index: avgSpending / overallAverage
        });
      }
    }

    return patterns;
  }

  /**
   * Generate predictive insights
   */
  generatePredictiveInsights(): PredictiveInsight[] {
    const insights: PredictiveInsight[] = [];

    // Spending spike prediction
    const recentSpending = this.getRecentSpendingTrend();
    if (recentSpending.isIncreasing && recentSpending.growthRate > 0.3) {
      insights.push({
        type: 'spending_spike',
        confidence: 0.75,
        description: `Spending has increased ${(recentSpending.growthRate * 100).toFixed(1)}% recently`,
        impact: recentSpending.growthRate > 0.5 ? 'high' : 'medium',
        action_required: true,
        recommendations: [
          'Review recent purchases for unnecessary expenses',
          'Set spending alerts for categories with highest growth',
          'Consider implementing a daily spending limit'
        ],
        timeline: 'Next 30 days'
      });
    }

    // Category shift detection
    const categoryShifts = this.detectCategoryShifts();
    if (categoryShifts.length > 0) {
      insights.push({
        type: 'category_shift',
        confidence: 0.65,
        description: `Spending patterns have shifted toward ${categoryShifts[0].category}`,
        impact: 'medium',
        action_required: false,
        recommendations: [
          'Monitor this category for budget adjustments',
          'Consider if this shift aligns with your goals'
        ],
        timeline: 'Next 60 days'
      });
    }

    return insights;
  }

  // Helper methods
  private getMonthlySpendingData() {
    const monthlyData = new Map<string, number>();
    
    this.receipts.forEach(receipt => {
      const month = receipt.receipt_date.substring(0, 7);
      monthlyData.set(month, (monthlyData.get(month) || 0) + receipt.total_amount);
    });

    return Array.from(monthlyData.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private calculateTrend(amounts: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (amounts.length < 2) return 'stable';
    
    const firstHalf = amounts.slice(0, Math.floor(amounts.length / 2));
    const secondHalf = amounts.slice(Math.floor(amounts.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, a) => sum + a, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, a) => sum + a, 0) / secondHalf.length;
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (Math.abs(changePercent) < 10) return 'stable';
    return changePercent > 0 ? 'increasing' : 'decreasing';
  }

  private calculateAverageGrowth(amounts: number[]): number {
    if (amounts.length < 2) return 0;
    
    let totalGrowth = 0;
    let validPeriods = 0;
    
    for (let i = 1; i < amounts.length; i++) {
      if (amounts[i - 1] > 0) {
        totalGrowth += (amounts[i] - amounts[i - 1]) / amounts[i - 1];
        validPeriods++;
      }
    }
    
    return validPeriods > 0 ? totalGrowth / validPeriods : 0;
  }

  private getCategoryStatistics() {
    const categoryStats = new Map<string, { mean: number; stdDev: number; count: number }>();
    
    const categories = new Set(this.receipts.map(r => r.category));
    
    categories.forEach(category => {
      const amounts = this.receipts
        .filter(r => r.category === category)
        .map(r => r.total_amount);
      
      if (amounts.length > 0) {
        const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
        const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
        const stdDev = Math.sqrt(variance);
        
        categoryStats.set(category, { mean, stdDev, count: amounts.length });
      }
    });
    
    return categoryStats;
  }

  private getCategoryRecommendation(category: string, trend: 'up' | 'down' | 'stable', changePercent: number): string {
    if (trend === 'up') {
      return `${category} spending increased by ${changePercent.toFixed(1)}%. Consider setting a budget limit.`;
    } else if (trend === 'down') {
      return `${category} spending decreased by ${Math.abs(changePercent).toFixed(1)}%. Good progress!`;
    }
    return `${category} spending is stable. Monitor for any future changes.`;
  }

  private calculateOptimizationPotential(receipts: Receipt[]): number {
    // Simple heuristic: higher frequency and amount variation suggests more optimization potential
    const amounts = receipts.map(r => r.total_amount);
    const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;
    
    return Math.min(30, coefficientOfVariation * 100); // Max 30% optimization potential
  }

  private getBudgetStrategies(category: string, difficulty: 'easy' | 'moderate' | 'challenging'): string[] {
    const strategies = {
      easy: [
        'Track spending daily',
        'Set weekly spending limits',
        'Use cash for discretionary purchases'
      ],
      moderate: [
        'Compare prices before purchasing',
        'Wait 24 hours before non-essential purchases',
        'Find alternative providers or substitutes'
      ],
      challenging: [
        'Eliminate or significantly reduce this category',
        'Find free or low-cost alternatives',
        'Negotiate better rates with providers'
      ]
    };

    return strategies[difficulty];
  }

  private isPotentiallyDeductible(receipt: Receipt): boolean {
    // Simple heuristics for potentially deductible expenses
    const deductibleCategories = ['business', 'healthcare', 'education', 'travel'];
    const deductibleMerchants = ['office', 'medical', 'pharmacy', 'hospital', 'university'];
    
    return deductibleCategories.some(cat => receipt.category.includes(cat)) ||
           deductibleMerchants.some(merchant => 
             receipt.merchant_name?.toLowerCase().includes(merchant) || false
           );
  }

  private getDeductionReason(receipt: Receipt): string {
    if (receipt.is_business_expense) return 'Business expense';
    if (receipt.category.includes('healthcare')) return 'Medical expense';
    if (receipt.category.includes('education')) return 'Educational expense';
    return 'Potentially deductible expense';
  }

  private getTaxRecommendations(businessCount: number, deductibleCount: number): string[] {
    const recommendations = [];
    
    if (businessCount < deductibleCount * 0.5) {
      recommendations.push('Review business expenses - you may be missing deductions');
    }
    
    recommendations.push('Keep detailed records of all business-related expenses');
    recommendations.push('Consider consulting a tax professional for optimization');
    
    return recommendations;
  }

  private getTopCategories(categories: string[]): string[] {
    const counts = new Map<string, number>();
    categories.forEach(cat => counts.set(cat, (counts.get(cat) || 0) + 1));
    
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);
  }

  private getRecentSpendingTrend(): { isIncreasing: boolean; growthRate: number } {
    const recentReceipts = this.receipts
      .filter(r => new Date(r.receipt_date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .sort((a, b) => new Date(a.receipt_date).getTime() - new Date(b.receipt_date).getTime());

    if (recentReceipts.length < 4) return { isIncreasing: false, growthRate: 0 };

    const firstWeek = recentReceipts.slice(0, Math.floor(recentReceipts.length / 4));
    const lastWeek = recentReceipts.slice(-Math.floor(recentReceipts.length / 4));

    const firstWeekTotal = firstWeek.reduce((sum, r) => sum + r.total_amount, 0);
    const lastWeekTotal = lastWeek.reduce((sum, r) => sum + r.total_amount, 0);

    if (firstWeekTotal === 0) return { isIncreasing: false, growthRate: 0 };

    const growthRate = (lastWeekTotal - firstWeekTotal) / firstWeekTotal;
    return { isIncreasing: growthRate > 0.1, growthRate };
  }

  private detectCategoryShifts(): Array<{ category: string; shift: number }> {
    const recentThreshold = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // Last 60 days
    const olderThreshold = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000); // 60-120 days ago

    const recentSpending = new Map<string, number>();
    const olderSpending = new Map<string, number>();

    this.receipts.forEach(receipt => {
      const receiptDate = new Date(receipt.receipt_date);
      if (receiptDate >= recentThreshold) {
        recentSpending.set(receipt.category, (recentSpending.get(receipt.category) || 0) + receipt.total_amount);
      } else if (receiptDate >= olderThreshold) {
        olderSpending.set(receipt.category, (olderSpending.get(receipt.category) || 0) + receipt.total_amount);
      }
    });

    const shifts: Array<{ category: string; shift: number }> = [];
    
    recentSpending.forEach((recentAmount, category) => {
      const olderAmount = olderSpending.get(category) || 0;
      if (olderAmount > 0) {
        const shift = (recentAmount - olderAmount) / olderAmount;
        if (Math.abs(shift) > 0.3) { // 30% change threshold
          shifts.push({ category, shift });
        }
      }
    });

    return shifts.sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));
  }
}