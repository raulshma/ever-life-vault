/**
 * Enhanced Analytics Dashboard
 * Provides advanced analytics features including predictive insights,
 * anomaly detection, spending forecasts, and AI-powered recommendations.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useReceipts } from '@/hooks/useReceipts';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  AdvancedAnalyticsService, 
  type SpendingForecast,
  type SpendingAnomaly,
  type CategoryInsight,
  type MerchantAnalysis,
  type BudgetRecommendation,
  type TaxOptimization,
  type SeasonalPattern,
  type PredictiveInsight
} from '@/services/AdvancedAnalyticsService';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Calendar,
  DollarSign,
  PieChart,
  BarChart3,
  Lightbulb,
  Zap,
  Shield,
  Award,
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  Info,
  RefreshCw
} from 'lucide-react';

interface EnhancedAnalyticsDashboardProps {
  className?: string;
}

export function EnhancedAnalyticsDashboard({ className }: EnhancedAnalyticsDashboardProps) {
  const { receipts } = useReceipts();
  const isMobile = useIsMobile();
  const [refreshing, setRefreshing] = useState(false);

  // Initialize analytics service
  const analyticsService = useMemo(() => new AdvancedAnalyticsService(receipts), [receipts]);

  // Generate analytics data
  const analyticsData = useMemo(() => {
    if (receipts.length === 0) return null;

    return {
      forecasts: analyticsService.generateSpendingForecast(),
      anomalies: analyticsService.detectSpendingAnomalies(),
      categoryInsights: analyticsService.getCategoryInsights(),
      merchantAnalysis: analyticsService.analyzeMerchantLoyalty(),
      budgetRecommendations: analyticsService.generateBudgetRecommendations(),
      taxOptimization: analyticsService.analyzeTaxOptimization(),
      seasonalPatterns: analyticsService.identifySeasonalPatterns(),
      predictiveInsights: analyticsService.generatePredictiveInsights()
    };
  }, [analyticsService, receipts]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'spending_spike': return <TrendingUp className="w-4 h-4" />;
      case 'category_shift': return <PieChart className="w-4 h-4" />;
      case 'merchant_loyalty': return <Award className="w-4 h-4" />;
      case 'tax_opportunity': return <Target className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getInsightColor = (impact: string): "default" | "destructive" => {
    switch (impact) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getLoyaltyIcon = (tier: string) => {
    switch (tier) {
      case 'platinum': return <Award className="w-4 h-4 text-purple-500" />;
      case 'gold': return <Award className="w-4 h-4 text-yellow-500" />;
      case 'silver': return <Award className="w-4 h-4 text-gray-400" />;
      default: return <Award className="w-4 h-4 text-amber-600" />;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  if (!analyticsData) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
            <p className="text-muted-foreground">Add some receipts to see advanced analytics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Advanced Analytics
          </h2>
          <p className="text-muted-foreground">AI-powered insights and predictions for your spending</p>
        </div>
        
        <Button 
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size={isMobile ? "sm" : "default"}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Predictive Insights */}
      {analyticsData.predictiveInsights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Predictive Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analyticsData.predictiveInsights.map((insight, index) => (
              <Alert key={index} variant={getInsightColor(insight.impact)}>
                <div className="flex items-start gap-3">
                  {getInsightIcon(insight.type)}
                  <div className="flex-1 min-w-0">
                    <AlertTitle className="text-sm font-medium">
                      {insight.description}
                    </AlertTitle>
                    <AlertDescription className="text-xs mt-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {Math.round(insight.confidence * 100)}% confidence
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {insight.timeline}
                        </Badge>
                        {insight.action_required && (
                          <Badge variant="destructive" className="text-xs">
                            Action Required
                          </Badge>
                        )}
                      </div>
                      <ul className="list-disc list-inside space-y-1">
                        {insight.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-xs">{rec}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="forecasts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6">
          <TabsTrigger value="forecasts" className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span className="hidden sm:inline">Forecasts</span>
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span className="hidden sm:inline">Anomalies</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            <span className="hidden sm:inline">Insights</span>
          </TabsTrigger>
          <TabsTrigger value="merchants" className="flex items-center gap-1">
            <Award className="w-3 h-3" />
            <span className="hidden sm:inline">Merchants</span>
          </TabsTrigger>
          <TabsTrigger value="budget" className="flex items-center gap-1">
            <Target className="w-3 h-3" />
            <span className="hidden sm:inline">Budget</span>
          </TabsTrigger>
          <TabsTrigger value="tax" className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span className="hidden sm:inline">Tax</span>
          </TabsTrigger>
        </TabsList>

        {/* Spending Forecasts */}
        <TabsContent value="forecasts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                6-Month Spending Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsData.forecasts.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analyticsData.forecasts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      tickFormatter={(value) => new Date(value + '-01').toLocaleDateString('en-US', { month: 'short' })}
                    />
                    <YAxis tickFormatter={formatCurrency} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      labelFormatter={(label) => new Date(label + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    />
                    <Area
                      type="monotone"
                      dataKey="predicted_amount"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                      name="Predicted Spending"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  Need at least 3 months of data for forecasting
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seasonal Patterns */}
          {analyticsData.seasonalPatterns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Seasonal Spending Patterns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={analyticsData.seasonalPatterns}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="month_name" />
                    <PolarRadiusAxis angle={90} domain={[0, 'dataMax']} tickFormatter={formatCurrency} />
                    <Radar
                      name="Average Spending"
                      dataKey="average_spending"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                    />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Average Spending']} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Spending Anomalies */}
        <TabsContent value="anomalies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Spending Anomalies ({analyticsData.anomalies.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsData.anomalies.length > 0 ? (
                <div className="space-y-3">
                  {analyticsData.anomalies.slice(0, 10).map((anomaly, index) => (
                    <Card key={anomaly.receipt_id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{anomaly.receipt_name}</span>
                            <Badge 
                              variant={anomaly.severity === 'high' ? 'destructive' : 
                                     anomaly.severity === 'medium' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {anomaly.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {new Date(anomaly.date).toLocaleDateString()} • {anomaly.reason}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            Expected: {formatCurrency(anomaly.expected_range.min)} - {formatCurrency(anomaly.expected_range.max)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-lg">{formatCurrency(anomaly.amount)}</div>
                          <div className="text-xs text-muted-foreground">
                            {anomaly.anomaly_score.toFixed(1)}σ
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-semibold mb-2">No Anomalies Detected</h3>
                  <p>Your spending patterns look normal</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Category Insights */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analyticsData.categoryInsights.map((insight, index) => (
              <Card key={insight.category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{insight.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    <div className="flex items-center gap-1">
                      {insight.trend === 'up' ? (
                        <TrendingUp className="w-4 h-4 text-red-500" />
                      ) : insight.trend === 'down' ? (
                        <TrendingDown className="w-4 h-4 text-green-500" />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                      <Badge 
                        variant={insight.trend === 'up' ? 'destructive' : 
                               insight.trend === 'down' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {insight.change_percentage > 0 ? '+' : ''}{insight.change_percentage.toFixed(1)}%
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Current Period</p>
                      <p className="font-semibold">{formatCurrency(insight.current_period_amount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Previous Period</p>
                      <p className="font-semibold">{formatCurrency(insight.previous_period_amount)}</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Optimization Potential</span>
                      <span>{insight.optimization_potential.toFixed(1)}%</span>
                    </div>
                    <Progress value={insight.optimization_potential} className="h-2" />
                  </div>

                  <p className="text-xs text-muted-foreground">{insight.recommendation}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Merchant Analysis */}
        <TabsContent value="merchants" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analyticsData.merchantAnalysis.slice(0, 8).map((merchant, index) => (
              <Card key={merchant.merchant_name}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getLoyaltyIcon(merchant.loyalty_tier)}
                      <div>
                        <h3 className="font-medium text-sm">{merchant.merchant_name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">{merchant.loyalty_tier} tier</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(merchant.total_spent)}</p>
                      <p className="text-xs text-muted-foreground">{merchant.visit_count} visits</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Avg Transaction</p>
                      <p className="font-medium">{formatCurrency(merchant.average_transaction)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Visit</p>
                      <p className="font-medium">{new Date(merchant.last_visit).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Badge 
                      variant={merchant.spending_trend === 'increasing' ? 'destructive' : 
                             merchant.spending_trend === 'decreasing' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {merchant.spending_trend}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {merchant.frequency_score.toFixed(1)} visits/month
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Budget Recommendations */}
        <TabsContent value="budget" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analyticsData.budgetRecommendations.map((rec, index) => (
              <Card key={rec.category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{rec.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    <Badge 
                      variant={rec.difficulty === 'easy' ? 'default' : 
                             rec.difficulty === 'moderate' ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {rec.difficulty}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Current</p>
                      <p className="font-semibold">{formatCurrency(rec.current_spending)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Recommended</p>
                      <p className="font-semibold text-green-600">{formatCurrency(rec.recommended_budget)}</p>
                    </div>
                  </div>

                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-green-800">
                      Potential Savings: {formatCurrency(rec.savings_potential)}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Strategies:</h4>
                    <ul className="space-y-1">
                      {rec.strategies.map((strategy, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span>•</span>
                          <span>{strategy}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tax Optimization */}
        <TabsContent value="tax" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                Tax Optimization Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Current Deductions</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(analyticsData.taxOptimization.current_deductions)}
                    </p>
                  </div>
                </Card>
                
                <Card className="p-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Potential Additional</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(analyticsData.taxOptimization.potential_additional_deductions)}
                    </p>
                  </div>
                </Card>
                
                <Card className="p-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Estimated Savings</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatCurrency(analyticsData.taxOptimization.estimated_savings)}
                    </p>
                  </div>
                </Card>
              </div>

              {analyticsData.taxOptimization.missed_opportunities.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Missed Opportunities</h3>
                  <div className="space-y-2">
                    {analyticsData.taxOptimization.missed_opportunities.slice(0, 5).map((opportunity, index) => (
                      <div key={opportunity.receipt_id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{opportunity.reason}</p>
                          <p className="text-xs text-muted-foreground">Receipt ID: {opportunity.receipt_id}</p>
                        </div>
                        <p className="font-semibold">{formatCurrency(opportunity.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
                <ul className="space-y-2">
                  {analyticsData.taxOptimization.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}