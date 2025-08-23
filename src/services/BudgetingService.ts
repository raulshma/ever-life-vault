/**
 * Automated Budgeting Service
 * Handles budget creation, tracking, alerts, and automated reporting
 */

export interface Budget {
  id: string;
  user_id: string;
  name: string;
  category: string;
  period_type: 'monthly' | 'quarterly' | 'yearly';
  budget_amount: number;
  current_spent: number;
  start_date: string;
  end_date: string;
  alert_threshold: number; // Percentage (0-100)
  is_active: boolean;
  auto_rollover: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetAlert {
  id: string;
  budget_id: string;
  alert_type: 'threshold' | 'overspend' | 'approaching_limit';
  message: string;
  percentage_used: number;
  triggered_at: string;
  is_read: boolean;
}

export interface ExpenseReport {
  id: string;
  user_id: string;
  report_type: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  period_start: string;
  period_end: string;
  total_expenses: number;
  total_business_expenses: number;
  total_personal_expenses: number;
  total_tax_deductible: number;
  total_reimbursable: number;
  category_breakdown: { [category: string]: number };
  merchant_breakdown: { [merchant: string]: number };
  payment_method_breakdown: { [method: string]: number };
  generated_at: string;
  auto_generated: boolean;
  recipients?: string[];
}

export interface BudgetRecommendation {
  category: string;
  suggested_amount: number;
  reasoning: string;
  confidence: number;
  historical_average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export class BudgetingService {
  private receipts: any[];
  private budgets: Budget[];

  constructor(receipts: any[] = [], budgets: Budget[] = []) {
    this.receipts = receipts;
    this.budgets = budgets;
  }

  /**
   * Generate smart budget recommendations based on historical spending
   */
  public generateBudgetRecommendations(timeframeMonths: number = 6): BudgetRecommendation[] {
    const recommendations: BudgetRecommendation[] = [];
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - timeframeMonths);

    // Analyze spending by category
    const categorySpending = this.analyzeCategorySpending(cutoffDate);
    
    Object.entries(categorySpending).forEach(([category, data]) => {
      if (data.receipts.length >= 3) { // Need at least 3 data points
        const monthlyAmounts = this.getMonthlySpending(data.receipts);
        const average = monthlyAmounts.reduce((sum, amount) => sum + amount, 0) / monthlyAmounts.length;
        const trend = this.calculateTrend(monthlyAmounts);
        const variance = this.calculateVariance(monthlyAmounts, average);
        
        // Add buffer based on variance and trend
        let buffer = 1.1; // Base 10% buffer
        if (variance > average * 0.3) buffer = 1.2; // High variance = 20% buffer
        if (trend === 'increasing') buffer += 0.1; // Additional 10% for increasing trend
        
        const suggestedAmount = Math.round(average * buffer);
        
        recommendations.push({
          category,
          suggested_amount: suggestedAmount,
          reasoning: this.generateRecommendationReasoning(category, average, trend, variance),
          confidence: this.calculateConfidence(data.receipts.length, variance, average),
          historical_average: average,
          trend
        });
      }
    });

    return recommendations.sort((a, b) => b.suggested_amount - a.suggested_amount);
  }

  /**
   * Create automated expense reports
   */
  public generateExpenseReport(
    periodStart: string,
    periodEnd: string,
    reportType: ExpenseReport['report_type'] = 'monthly'
  ): ExpenseReport {
    const periodReceipts = this.receipts.filter(receipt => 
      receipt.receipt_date >= periodStart && receipt.receipt_date <= periodEnd
    );

    const totalExpenses = periodReceipts.reduce((sum, r) => sum + r.total_amount, 0);
    const businessExpenses = periodReceipts.filter(r => r.is_business_expense);
    const personalExpenses = periodReceipts.filter(r => !r.is_business_expense);
    const taxDeductibleExpenses = periodReceipts.filter(r => r.is_tax_deductible);
    const reimbursableExpenses = periodReceipts.filter(r => r.is_reimbursable);

    // Category breakdown
    const categoryBreakdown: { [category: string]: number } = {};
    periodReceipts.forEach(receipt => {
      const category = receipt.category || 'other';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + receipt.total_amount;
    });

    // Merchant breakdown
    const merchantBreakdown: { [merchant: string]: number } = {};
    periodReceipts.forEach(receipt => {
      if (receipt.merchant_name) {
        merchantBreakdown[receipt.merchant_name] = 
          (merchantBreakdown[receipt.merchant_name] || 0) + receipt.total_amount;
      }
    });

    // Payment method breakdown
    const paymentMethodBreakdown: { [method: string]: number } = {};
    periodReceipts.forEach(receipt => {
      const method = receipt.payment_method || 'unknown';
      paymentMethodBreakdown[method] = (paymentMethodBreakdown[method] || 0) + receipt.total_amount;
    });

    return {
      id: this.generateId(),
      user_id: 'current_user', // Will be replaced with actual user ID
      report_type: reportType,
      period_start: periodStart,
      period_end: periodEnd,
      total_expenses: totalExpenses,
      total_business_expenses: businessExpenses.reduce((sum, r) => sum + r.total_amount, 0),
      total_personal_expenses: personalExpenses.reduce((sum, r) => sum + r.total_amount, 0),
      total_tax_deductible: taxDeductibleExpenses.reduce((sum, r) => sum + r.total_amount, 0),
      total_reimbursable: reimbursableExpenses.reduce((sum, r) => sum + r.total_amount, 0),
      category_breakdown: categoryBreakdown,
      merchant_breakdown: merchantBreakdown,
      payment_method_breakdown: paymentMethodBreakdown,
      generated_at: new Date().toISOString(),
      auto_generated: true
    };
  }

  /**
   * Check budget alerts and generate notifications
   */
  public checkBudgetAlerts(): BudgetAlert[] {
    const alerts: BudgetAlert[] = [];
    const currentDate = new Date();

    this.budgets.forEach(budget => {
      if (!budget.is_active || currentDate > new Date(budget.end_date)) return;

      const currentSpent = this.calculateCurrentSpending(budget);
      const percentageUsed = (currentSpent / budget.budget_amount) * 100;

      // Threshold alert
      if (percentageUsed >= budget.alert_threshold && percentageUsed < 100) {
        alerts.push({
          id: this.generateId(),
          budget_id: budget.id,
          alert_type: 'threshold',
          message: `Budget "${budget.name}" is ${Math.round(percentageUsed)}% used (${budget.alert_threshold}% threshold reached)`,
          percentage_used: percentageUsed,
          triggered_at: new Date().toISOString(),
          is_read: false
        });
      }

      // Overspend alert
      if (percentageUsed >= 100) {
        alerts.push({
          id: this.generateId(),
          budget_id: budget.id,
          alert_type: 'overspend',
          message: `Budget "${budget.name}" has been exceeded by $${(currentSpent - budget.budget_amount).toFixed(2)}`,
          percentage_used: percentageUsed,
          triggered_at: new Date().toISOString(),
          is_read: false
        });
      }

      // Approaching limit alert (90% used)
      if (percentageUsed >= 90 && percentageUsed < budget.alert_threshold) {
        alerts.push({
          id: this.generateId(),
          budget_id: budget.id,
          alert_type: 'approaching_limit',
          message: `Budget "${budget.name}" is approaching the limit (${Math.round(percentageUsed)}% used)`,
          percentage_used: percentageUsed,
          triggered_at: new Date().toISOString(),
          is_read: false
        });
      }
    });

    return alerts;
  }

  /**
   * Generate automated reports based on schedule
   */
  public generateScheduledReports(): ExpenseReport[] {
    const reports: ExpenseReport[] = [];
    const now = new Date();

    // Weekly report (every Sunday)
    if (now.getDay() === 0) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(now);
      weekEnd.setHours(23, 59, 59, 999);

      reports.push(this.generateExpenseReport(
        weekStart.toISOString().split('T')[0],
        weekEnd.toISOString().split('T')[0],
        'weekly'
      ));
    }

    // Monthly report (first day of the month)
    if (now.getDate() === 1) {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      reports.push(this.generateExpenseReport(
        lastMonth.toISOString().split('T')[0],
        lastMonthEnd.toISOString().split('T')[0],
        'monthly'
      ));
    }

    // Quarterly report (first day of quarter)
    const quarter = Math.floor(now.getMonth() / 3);
    const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
    if (now.getTime() === quarterStart.getTime()) {
      const prevQuarterStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
      const prevQuarterEnd = new Date(now.getFullYear(), quarter * 3, 0);

      reports.push(this.generateExpenseReport(
        prevQuarterStart.toISOString().split('T')[0],
        prevQuarterEnd.toISOString().split('T')[0],
        'quarterly'
      ));
    }

    return reports;
  }

  /**
   * Calculate budget performance metrics
   */
  public getBudgetPerformance(budgetId: string): {
    budget: Budget;
    currentSpent: number;
    remainingAmount: number;
    percentageUsed: number;
    daysRemaining: number;
    dailyAverageSpent: number;
    projectedTotal: number;
    onTrack: boolean;
  } | null {
    const budget = this.budgets.find(b => b.id === budgetId);
    if (!budget) return null;

    const currentSpent = this.calculateCurrentSpending(budget);
    const remainingAmount = Math.max(0, budget.budget_amount - currentSpent);
    const percentageUsed = (currentSpent / budget.budget_amount) * 100;

    const startDate = new Date(budget.start_date);
    const endDate = new Date(budget.end_date);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);

    const dailyAverageSpent = daysElapsed > 0 ? currentSpent / daysElapsed : 0;
    const projectedTotal = dailyAverageSpent * totalDays;
    const onTrack = projectedTotal <= budget.budget_amount;

    return {
      budget,
      currentSpent,
      remainingAmount,
      percentageUsed,
      daysRemaining,
      dailyAverageSpent,
      projectedTotal,
      onTrack
    };
  }

  /**
   * Get spending insights and recommendations
   */
  public getSpendingInsights(): {
    topCategories: Array<{ category: string; amount: number; percentage: number }>;
    topMerchants: Array<{ merchant: string; amount: number; count: number }>;
    spendingTrends: Array<{ month: string; amount: number; change: number }>;
    recommendations: string[];
  } {
    const totalSpending = this.receipts.reduce((sum, r) => sum + r.total_amount, 0);
    
    // Top categories
    const categorySpending = this.analyzeCategorySpending();
    const topCategories = Object.entries(categorySpending)
      .map(([category, data]) => ({
        category,
        amount: data.total,
        percentage: (data.total / totalSpending) * 100
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Top merchants
    const merchantSpending: { [merchant: string]: { amount: number; count: number } } = {};
    this.receipts.forEach(receipt => {
      if (receipt.merchant_name) {
        if (!merchantSpending[receipt.merchant_name]) {
          merchantSpending[receipt.merchant_name] = { amount: 0, count: 0 };
        }
        merchantSpending[receipt.merchant_name].amount += receipt.total_amount;
        merchantSpending[receipt.merchant_name].count += 1;
      }
    });

    const topMerchants = Object.entries(merchantSpending)
      .map(([merchant, data]) => ({
        merchant,
        amount: data.amount,
        count: data.count
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Spending trends (last 6 months)
    const monthlySpending = this.getMonthlySpendingTrends();
    const spendingTrends = monthlySpending.map((amount, index) => {
      const previousAmount = index > 0 ? monthlySpending[index - 1] : amount;
      const change = index > 0 ? ((amount - previousAmount) / previousAmount) * 100 : 0;
      
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));
      
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        amount,
        change
      };
    });

    // Generate recommendations
    const recommendations = this.generateSpendingRecommendations(topCategories, spendingTrends);

    return {
      topCategories,
      topMerchants,
      spendingTrends,
      recommendations
    };
  }

  // Private helper methods
  private analyzeCategorySpending(cutoffDate?: Date) {
    const categoryData: { [category: string]: { total: number; receipts: any[] } } = {};
    
    this.receipts.forEach(receipt => {
      if (cutoffDate && new Date(receipt.receipt_date) < cutoffDate) return;
      
      const category = receipt.category || 'other';
      if (!categoryData[category]) {
        categoryData[category] = { total: 0, receipts: [] };
      }
      categoryData[category].total += receipt.total_amount;
      categoryData[category].receipts.push(receipt);
    });

    return categoryData;
  }

  private getMonthlySpending(receipts: any[]): number[] {
    const monthlyAmounts: { [month: string]: number } = {};
    
    receipts.forEach(receipt => {
      const month = receipt.receipt_date.substring(0, 7); // YYYY-MM
      monthlyAmounts[month] = (monthlyAmounts[month] || 0) + receipt.total_amount;
    });

    return Object.values(monthlyAmounts);
  }

  private calculateTrend(amounts: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (amounts.length < 2) return 'stable';
    
    const firstHalf = amounts.slice(0, Math.floor(amounts.length / 2));
    const secondHalf = amounts.slice(Math.floor(amounts.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, a) => sum + a, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, a) => sum + a, 0) / secondHalf.length;
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  private calculateVariance(amounts: number[], average: number): number {
    const squaredDiffs = amounts.map(amount => Math.pow(amount - average, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, diff) => sum + diff, 0) / amounts.length);
  }

  private generateRecommendationReasoning(
    category: string, 
    average: number, 
    trend: string, 
    variance: number
  ): string {
    let reasoning = `Based on your average monthly spending of $${average.toFixed(2)} in ${category}`;
    
    if (trend === 'increasing') {
      reasoning += ', with an increasing trend observed';
    } else if (trend === 'decreasing') {
      reasoning += ', with a decreasing trend observed';
    }
    
    if (variance > average * 0.3) {
      reasoning += '. Added extra buffer due to high spending variability';
    }
    
    return reasoning + '.';
  }

  private calculateConfidence(dataPoints: number, variance: number, average: number): number {
    let confidence = 0.5; // Base confidence
    
    // More data points = higher confidence
    confidence += Math.min(0.3, dataPoints * 0.05);
    
    // Lower variance = higher confidence
    const varianceRatio = variance / average;
    confidence += Math.max(-0.3, -varianceRatio * 0.5);
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private calculateCurrentSpending(budget: Budget): number {
    const budgetReceipts = this.receipts.filter(receipt => {
      const receiptDate = new Date(receipt.receipt_date);
      const startDate = new Date(budget.start_date);
      const endDate = new Date(budget.end_date);
      
      return receiptDate >= startDate && 
             receiptDate <= endDate && 
             receipt.category === budget.category;
    });

    return budgetReceipts.reduce((sum, receipt) => sum + receipt.total_amount, 0);
  }

  private getMonthlySpendingTrends(): number[] {
    const monthlyTotals: number[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthTotal = this.receipts
        .filter(receipt => {
          const receiptDate = new Date(receipt.receipt_date);
          return receiptDate >= monthStart && receiptDate <= monthEnd;
        })
        .reduce((sum, receipt) => sum + receipt.total_amount, 0);
      
      monthlyTotals.push(monthTotal);
    }
    
    return monthlyTotals;
  }

  private generateSpendingRecommendations(
    topCategories: Array<{ category: string; amount: number; percentage: number }>,
    trends: Array<{ month: string; amount: number; change: number }>
  ): string[] {
    const recommendations: string[] = [];
    
    // High spending category recommendations
    const topCategory = topCategories[0];
    if (topCategory && topCategory.percentage > 30) {
      recommendations.push(
        `Consider setting a budget for ${topCategory.category} - it represents ${topCategory.percentage.toFixed(1)}% of your total spending`
      );
    }
    
    // Trend-based recommendations
    const recentTrend = trends[trends.length - 1];
    if (recentTrend && recentTrend.change > 20) {
      recommendations.push(
        `Your spending increased by ${recentTrend.change.toFixed(1)}% last month - review your recent expenses`
      );
    }
    
    // General recommendations
    if (topCategories.length >= 3) {
      const top3Percentage = topCategories.slice(0, 3).reduce((sum, cat) => sum + cat.percentage, 0);
      if (top3Percentage > 70) {
        recommendations.push(
          'Your spending is concentrated in 3 categories - consider diversifying your budget allocation'
        );
      }
    }
    
    return recommendations;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}