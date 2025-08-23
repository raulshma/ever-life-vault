/**
 * Advanced Analytics Hook
 * Provides advanced analytics functionality and caching for receipt data
 */

import { useMemo, useState, useCallback } from 'react';
import { Receipt } from './useReceipts';
import { AdvancedAnalyticsService } from '@/services/AdvancedAnalyticsService';

export interface AnalyticsCache {
  timestamp: number;
  data: any;
}

export interface AdvancedMetrics {
  spendingVelocity: number;
  categoryDiversity: number;
  merchantLoyalty: number;
  predictabilityScore: number;
  financialHealth: number;
  budgetAdherence: number;
}

export interface SpendingAlert {
  id: string;
  type: 'budget_exceeded' | 'unusual_spending' | 'category_spike' | 'merchant_anomaly';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  amount: number;
  threshold: number;
  date: string;
  category?: string;
  merchant?: string;
  actionable: boolean;
  recommendations: string[];
}

export function useAdvancedAnalytics(receipts: Receipt[]) {
  const [cache, setCache] = useState<Map<string, AnalyticsCache>>(new Map());
  const [alerts, setAlerts] = useState<SpendingAlert[]>([]);

  // Initialize analytics service
  const analyticsService = useMemo(() => new AdvancedAnalyticsService(receipts), [receipts]);

  // Cache management
  const getCachedData = useCallback((key: string, freshnessTreshold: number = 300000) => { // 5 minutes
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < freshnessTreshold) {
      return cached.data;
    }
    return null;
  }, [cache]);

  const setCachedData = useCallback((key: string, data: any) => {
    const newCache = new Map(cache);
    newCache.set(key, { timestamp: Date.now(), data });
    setCache(newCache);
  }, [cache]);

  // Advanced Metrics Calculation
  const advancedMetrics = useMemo((): AdvancedMetrics => {
    const cacheKey = 'advanced_metrics';
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    if (receipts.length === 0) {
      return {
        spendingVelocity: 0,
        categoryDiversity: 0,
        merchantLoyalty: 0,
        predictabilityScore: 0,
        financialHealth: 0,
        budgetAdherence: 0
      };
    }

    // Calculate spending velocity (transactions per week)
    const sortedReceipts = [...receipts].sort((a, b) => 
      new Date(a.receipt_date).getTime() - new Date(b.receipt_date).getTime()
    );
    const firstDate = new Date(sortedReceipts[0]?.receipt_date || Date.now());
    const lastDate = new Date(sortedReceipts[sortedReceipts.length - 1]?.receipt_date || Date.now());
    const weeksBetween = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const spendingVelocity = receipts.length / weeksBetween;

    // Calculate category diversity (Shannon diversity index)
    const categoryFreq = new Map<string, number>();
    receipts.forEach(r => {
      categoryFreq.set(r.category, (categoryFreq.get(r.category) || 0) + 1);
    });
    
    let categoryDiversity = 0;
    if (categoryFreq.size > 1) {
      const total = receipts.length;
      categoryFreq.forEach(count => {
        const proportion = count / total;
        categoryDiversity -= proportion * Math.log2(proportion);
      });
      categoryDiversity = categoryDiversity / Math.log2(categoryFreq.size); // Normalized
    }

    // Calculate merchant loyalty (repeat merchant ratio)
    const merchantFreq = new Map<string, number>();
    receipts.forEach(r => {
      if (r.merchant_name) {
        merchantFreq.set(r.merchant_name, (merchantFreq.get(r.merchant_name) || 0) + 1);
      }
    });
    
    const loyalMerchants = Array.from(merchantFreq.values()).filter(count => count > 2).length;
    const merchantLoyalty = merchantFreq.size > 0 ? loyalMerchants / merchantFreq.size : 0;

    // Calculate predictability score (based on regular patterns)
    const predictabilityScore = calculatePredictabilityScore(receipts);

    // Calculate financial health score
    const financialHealth = calculateFinancialHealthScore(receipts);

    // Calculate budget adherence (if budgets exist)
    const budgetAdherence = calculateBudgetAdherence(receipts);

    const metrics = {
      spendingVelocity: Math.round(spendingVelocity * 100) / 100,
      categoryDiversity: Math.round(categoryDiversity * 100) / 100,
      merchantLoyalty: Math.round(merchantLoyalty * 100) / 100,
      predictabilityScore: Math.round(predictabilityScore * 100) / 100,
      financialHealth: Math.round(financialHealth * 100) / 100,
      budgetAdherence: Math.round(budgetAdherence * 100) / 100
    };

    setCachedData(cacheKey, metrics);
    return metrics;
  }, [receipts, getCachedData, setCachedData]);

  // Real-time spending alerts
  const generateSpendingAlerts = useCallback((): SpendingAlert[] => {
    const alerts: SpendingAlert[] = [];
    
    if (receipts.length === 0) return alerts;

    // Check for unusual spending patterns
    const recentReceipts = receipts.filter(r => 
      new Date(r.receipt_date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    const recentTotal = recentReceipts.reduce((sum, r) => sum + r.total_amount, 0);
    const weeklyAverage = receipts.length > 0 ? receipts.reduce((sum, r) => sum + r.total_amount, 0) / 
      Math.max(1, (Date.now() - new Date(receipts[0].receipt_date).getTime()) / (7 * 24 * 60 * 60 * 1000)) : 0;

    if (recentTotal > weeklyAverage * 1.5) {
      alerts.push({
        id: 'high_weekly_spending',
        type: 'unusual_spending',
        severity: 'high',
        title: 'High Weekly Spending Detected',
        description: `This week's spending (${formatCurrency(recentTotal)}) is 50% above your average`,
        amount: recentTotal,
        threshold: weeklyAverage * 1.5,
        date: new Date().toISOString(),
        actionable: true,
        recommendations: [
          'Review recent transactions for unnecessary purchases',
          'Set daily spending limits for the rest of the week',
          'Postpone non-essential purchases'
        ]
      });
    }

    // Check for category spikes
    const categorySpending = new Map<string, number>();
    recentReceipts.forEach(r => {
      categorySpending.set(r.category, (categorySpending.get(r.category) || 0) + r.total_amount);
    });

    categorySpending.forEach((amount, category) => {
      const categoryHistorical = receipts
        .filter(r => r.category === category && 
          new Date(r.receipt_date) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .reduce((sum, r) => sum + r.total_amount, 0);
      
      const avgWeeklyCategory = categoryHistorical / Math.max(1, receipts.length / 7);
      
      if (amount > avgWeeklyCategory * 2) {
        alerts.push({
          id: `category_spike_${category}`,
          type: 'category_spike',
          severity: 'medium',
          title: `${category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Spending Spike`,
          description: `Category spending is double the usual amount this week`,
          amount,
          threshold: avgWeeklyCategory * 2,
          date: new Date().toISOString(),
          category,
          actionable: true,
          recommendations: [
            `Review ${category} purchases for this week`,
            'Consider if this increase is planned or necessary',
            'Set alerts for future overspending in this category'
          ]
        });
      }
    });

    return alerts.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }, [receipts]);

  // Spending insights with trends
  const spendingInsights = useMemo(() => {
    const cacheKey = 'spending_insights';
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    const insights = {
      monthlyTrend: calculateMonthlyTrend(receipts),
      topSpendingDays: getTopSpendingDays(receipts),
      averageTransactionSize: receipts.length > 0 ? 
        receipts.reduce((sum, r) => sum + r.total_amount, 0) / receipts.length : 0,
      largestTransaction: receipts.length > 0 ? 
        Math.max(...receipts.map(r => r.total_amount)) : 0,
      mostFrequentCategory: getMostFrequentCategory(receipts),
      spendingStreaks: calculateSpendingStreaks(receipts)
    };

    setCachedData(cacheKey, insights);
    return insights;
  }, [receipts, getCachedData, setCachedData]);

  // Refresh analytics data
  const refreshAnalytics = useCallback(() => {
    setCache(new Map());
    setAlerts(generateSpendingAlerts());
  }, [generateSpendingAlerts]);

  return {
    analyticsService,
    advancedMetrics,
    spendingInsights,
    alerts: generateSpendingAlerts(),
    refreshAnalytics,
    getCachedData,
    setCachedData
  };
}

// Helper functions
function calculatePredictabilityScore(receipts: Receipt[]): number {
  if (receipts.length < 10) return 0;

  // Calculate coefficient of variation for amounts
  const amounts = receipts.map(r => r.total_amount);
  const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;

  // Calculate regularity of spending (lower CV = more predictable)
  const predictability = Math.max(0, 1 - (coefficientOfVariation / 2));
  
  return predictability;
}

function calculateFinancialHealthScore(receipts: Receipt[]): number {
  if (receipts.length === 0) return 0;

  let score = 1.0;

  // Penalty for high spending variation
  const amounts = receipts.map(r => r.total_amount);
  const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;
  
  if (coefficientOfVariation > 1) score *= 0.8;

  // Bonus for categorized expenses
  const categorizedCount = receipts.filter(r => r.category && r.category !== 'other').length;
  const categorizationRate = categorizedCount / receipts.length;
  score *= (0.7 + 0.3 * categorizationRate);

  // Bonus for business expense tracking
  const businessCount = receipts.filter(r => r.is_business_expense !== undefined).length;
  const businessTrackingRate = businessCount / receipts.length;
  score *= (0.8 + 0.2 * businessTrackingRate);

  return Math.min(1, Math.max(0, score));
}

function calculateBudgetAdherence(receipts: Receipt[]): number {
  // This would need budget data - for now return a placeholder
  // In a real implementation, this would compare actual spending to budget limits
  return 0.75; // 75% adherence as placeholder
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function calculateMonthlyTrend(receipts: Receipt[]): number {
  if (receipts.length < 2) return 0;

  const monthlyData = new Map<string, number>();
  receipts.forEach(r => {
    const month = r.receipt_date.substring(0, 7);
    monthlyData.set(month, (monthlyData.get(month) || 0) + r.total_amount);
  });

  const months = Array.from(monthlyData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  if (months.length < 2) return 0;

  const firstMonth = months[0][1];
  const lastMonth = months[months.length - 1][1];
  
  return firstMonth > 0 ? ((lastMonth - firstMonth) / firstMonth) * 100 : 0;
}

function getTopSpendingDays(receipts: Receipt[]): string[] {
  const daySpending = new Map<string, number>();
  
  receipts.forEach(r => {
    const day = new Date(r.receipt_date).toLocaleDateString('en-US', { weekday: 'long' });
    daySpending.set(day, (daySpending.get(day) || 0) + r.total_amount);
  });

  return Array.from(daySpending.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => day);
}

function getMostFrequentCategory(receipts: Receipt[]): string {
  const categoryCount = new Map<string, number>();
  
  receipts.forEach(r => {
    categoryCount.set(r.category, (categoryCount.get(r.category) || 0) + 1);
  });

  if (categoryCount.size === 0) return 'None';

  return Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])[0][0];
}

function calculateSpendingStreaks(receipts: Receipt[]): { current: number; longest: number } {
  if (receipts.length === 0) return { current: 0, longest: 0 };

  const sortedReceipts = [...receipts].sort((a, b) => 
    new Date(b.receipt_date).getTime() - new Date(a.receipt_date).getTime()
  );

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let lastDate: Date | null = null;

  sortedReceipts.forEach(receipt => {
    const receiptDate = new Date(receipt.receipt_date);
    
    if (lastDate) {
      const dayDiff = (lastDate.getTime() - receiptDate.getTime()) / (24 * 60 * 60 * 1000);
      
      if (dayDiff <= 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
      currentStreak = 1;
    }
    
    lastDate = receiptDate;
  });

  longestStreak = Math.max(longestStreak, tempStreak);
  
  // Check if current streak is still active (within last 2 days)
  if (lastDate && (Date.now() - lastDate.getTime()) / (24 * 60 * 60 * 1000) <= 2) {
    currentStreak = tempStreak;
  } else {
    currentStreak = 0;
  }

  return { current: currentStreak, longest: longestStreak };
}