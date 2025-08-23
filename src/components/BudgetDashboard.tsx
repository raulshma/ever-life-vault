'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReceipts } from '@/hooks/useReceipts';
import { BudgetManager } from '@/components/BudgetManager';
import { AutomatedReports } from '@/components/AutomatedReports';
import { BudgetingService, type Budget, type BudgetAlert } from '@/services/BudgetingService';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
  Calendar,
  BarChart3,
  PieChart,
  Clock,
  Bell,
  Settings,
  Zap,
  Shield,
  Activity
} from 'lucide-react';

interface BudgetDashboardProps {
  className?: string;
}

export function BudgetDashboard({ className }: BudgetDashboardProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [budgetingService, setBudgetingService] = useState<BudgetingService | null>(null);
  const [financialHealth, setFinancialHealth] = useState<any>(null);

  const { receipts, getExpenseStats } = useReceipts();
  const stats = getExpenseStats();

  // Initialize budgeting service
  useEffect(() => {
    if (receipts.length > 0) {
      const service = new BudgetingService(receipts, budgets);
      setBudgetingService(service);
      
      // Check for alerts
      const currentAlerts = service.checkBudgetAlerts();
      setAlerts(currentAlerts);
      
      // Calculate financial health
      calculateFinancialHealth(service);
    }
  }, [receipts, budgets]);

  const calculateFinancialHealth = (service: BudgetingService) => {
    const insights = service.getSpendingInsights();
    const totalBudgets = budgets.filter(b => b.is_active).length;
    const overBudgetCount = budgets.filter(b => {
      const performance = service.getBudgetPerformance(b.id);
      return performance && performance.percentageUsed > 100;
    }).length;
    
    const onTrackCount = budgets.filter(b => {
      const performance = service.getBudgetPerformance(b.id);
      return performance && performance.onTrack;
    }).length;

    let healthScore = 70; // Base score
    
    // Adjust based on budget adherence
    if (totalBudgets > 0) {
      const adherenceRate = (totalBudgets - overBudgetCount) / totalBudgets;
      healthScore += adherenceRate * 20;
      
      const onTrackRate = onTrackCount / totalBudgets;
      healthScore += onTrackRate * 10;
    }
    
    // Adjust based on spending trends
    const recentTrend = insights.spendingTrends[insights.spendingTrends.length - 1];
    if (recentTrend) {
      if (recentTrend.change < -10) healthScore += 5; // Decreasing spending is good
      if (recentTrend.change > 20) healthScore -= 10; // High increase is concerning
    }

    let healthLevel = 'Poor';
    let healthColor = 'text-red-600';
    if (healthScore >= 90) {
      healthLevel = 'Excellent';
      healthColor = 'text-green-600';
    } else if (healthScore >= 75) {
      healthLevel = 'Good';
      healthColor = 'text-blue-600';
    } else if (healthScore >= 60) {
      healthLevel = 'Fair';
      healthColor = 'text-yellow-600';
    }

    setFinancialHealth({
      score: Math.round(healthScore),
      level: healthLevel,
      color: healthColor,
      metrics: {
        totalBudgets,
        overBudgetCount,
        onTrackCount,
        adherenceRate: totalBudgets > 0 ? ((totalBudgets - overBudgetCount) / totalBudgets) * 100 : 0
      }
    });
  };

  const getActiveBudgets = () => {
    return budgets.filter(b => b.is_active);
  };

  const getTotalBudgetAmount = () => {
    return getActiveBudgets().reduce((sum, b) => sum + b.budget_amount, 0);
  };

  const getTotalSpent = () => {
    if (!budgetingService) return 0;
    return getActiveBudgets().reduce((sum, b) => {
      const performance = budgetingService.getBudgetPerformance(b.id);
      return sum + (performance?.currentSpent || 0);
    }, 0);
  };

  const getAverageUtilization = () => {
    if (!budgetingService) return 0;
    const activeBudgets = getActiveBudgets();
    if (activeBudgets.length === 0) return 0;
    
    const totalUtilization = activeBudgets.reduce((sum, b) => {
      const performance = budgetingService.getBudgetPerformance(b.id);
      return sum + (performance?.percentageUsed || 0);
    }, 0);
    
    return totalUtilization / activeBudgets.length;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 100) return 'text-red-600';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budget & Reports</h1>
          <p className="text-gray-600">Manage your budgets and track spending</p>
        </div>
        {financialHealth && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`text-2xl font-bold ${financialHealth.color}`}>
                  {financialHealth.score}
                </div>
                <div>
                  <div className="font-medium">Financial Health</div>
                  <div className={`text-sm ${financialHealth.color}`}>
                    {financialHealth.level}
                  </div>
                </div>
                <div className="text-2xl">
                  {financialHealth.level === 'Excellent' && '🎯'}
                  {financialHealth.level === 'Good' && '👍'}
                  {financialHealth.level === 'Fair' && '⚠️'}
                  {financialHealth.level === 'Poor' && '🚨'}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Budget Alerts ({alerts.length})
          </h3>
          {alerts.slice(0, 3).map((alert, index) => (
            <Alert key={index} className={
              alert.alert_type === 'overspend' ? 'border-red-200 bg-red-50' :
              alert.alert_type === 'threshold' ? 'border-yellow-200 bg-yellow-50' :
              'border-blue-200 bg-blue-50'
            }>
              <AlertTriangle className={`w-4 h-4 ${
                alert.alert_type === 'overspend' ? 'text-red-600' :
                alert.alert_type === 'threshold' ? 'text-yellow-600' :
                'text-blue-600'
              }`} />
              <AlertDescription className={
                alert.alert_type === 'overspend' ? 'text-red-800' :
                alert.alert_type === 'threshold' ? 'text-yellow-800' :
                'text-blue-800'
              }>
                {alert.message}
              </AlertDescription>
            </Alert>
          ))}
          {alerts.length > 3 && (
            <p className="text-sm text-gray-600">
              +{alerts.length - 3} more alerts
            </p>
          )}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Budget</p>
                <p className="text-2xl font-bold">{formatCurrency(getTotalBudgetAmount())}</p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold">{formatCurrency(getTotalSpent())}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Utilization</p>
                <p className={`text-2xl font-bold ${getUtilizationColor(getAverageUtilization())}`}>
                  {getAverageUtilization().toFixed(1)}%
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Budgets</p>
                <p className="text-2xl font-bold">{getActiveBudgets().length}</p>
              </div>
              <Activity className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Overview */}
      {getActiveBudgets().length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Budget Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getActiveBudgets().slice(0, 5).map(budget => {
                const performance = budgetingService?.getBudgetPerformance(budget.id);
                if (!performance) return null;

                return (
                  <div key={budget.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{budget.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {budget.period_type}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {budget.category.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Progress 
                            value={Math.min(100, performance.percentageUsed)} 
                            className="h-2"
                          />
                        </div>
                        <div className="text-sm text-gray-600 min-w-0">
                          {performance.daysRemaining} days left
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`font-bold ${getUtilizationColor(performance.percentageUsed)}`}>
                        {performance.percentageUsed.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatCurrency(performance.currentSpent)} / {formatCurrency(budget.budget_amount)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {getActiveBudgets().length > 5 && (
                <div className="text-center text-gray-500 text-sm">
                  +{getActiveBudgets().length - 5} more budgets
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="budgets" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="budgets">Budget Management</TabsTrigger>
          <TabsTrigger value="reports">Automated Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="space-y-4">
          <BudgetManager />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <AutomatedReports />
        </TabsContent>
      </Tabs>
    </div>
  );
}