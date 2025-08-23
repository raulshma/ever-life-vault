/**
 * Enhanced Analytics Route
 * Comprehensive analytics page with basic analytics, advanced analytics, 
 * export/import functionality, and AI-powered insights
 */

import React from 'react';
import { PageHeader } from '@/components/PageHeader';
import { ExpenseAnalyticsDashboard } from '@/components/ExpenseAnalyticsDashboard';
import { EnhancedAnalyticsDashboard } from '@/components/EnhancedAnalyticsDashboard';
import { BulkImportExport } from '@/components/BulkImportExport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReceipts } from '@/hooks/useReceipts';
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Brain,
  Zap,
  Target,
  Activity,
  Shield,
  Clock,
  RefreshCw
} from 'lucide-react';

export default function EnhancedAnalyticsRoute() {
  const { receipts, getExpenseStats } = useReceipts();
  const { advancedMetrics, spendingInsights, alerts, refreshAnalytics } = useAdvancedAnalytics(receipts);
  const stats = getExpenseStats;

  const handleExportCSV = () => {
    // Prepare CSV data
    const csvHeaders = [
      'Date',
      'Name',
      'Merchant',
      'Category',
      'Amount',
      'Currency',
      'Tax Amount',
      'Payment Method',
      'Business Expense',
      'Tax Deductible',
      'Reimbursable',
      'Analysis Status',
      'Notes'
    ].join(',');

    const csvData = receipts.map(receipt => [
      receipt.receipt_date,
      `"${receipt.name.replace(/"/g, '""')}"`,
      `"${receipt.merchant_name || ''}"`,
      receipt.category,
      receipt.total_amount,
      receipt.currency,
      receipt.tax_amount || '',
      receipt.payment_method || '',
      receipt.is_business_expense ? 'Yes' : 'No',
      receipt.is_tax_deductible ? 'Yes' : 'No',
      receipt.is_reimbursable ? 'Yes' : 'No',
      receipt.analysis_status,
      `"${(receipt.notes || '').replace(/"/g, '""')}"`
    ].join(',')).join('\n');

    const csvContent = csvHeaders + '\n' + csvData;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `receipts-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      summary: stats,
      advanced_metrics: advancedMetrics,
      spending_insights: spendingInsights,
      receipts: receipts.map(receipt => ({
        ...receipt,
        // Remove sensitive internal data if needed
        user_id: undefined,
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json;charset=utf-8;' 
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `enhanced-analytics-export-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateTaxReport = () => {
    const taxDeductibleReceipts = receipts.filter(r => r.is_tax_deductible);
    const businessReceipts = receipts.filter(r => r.is_business_expense);
    
    const reportData = {
      reportDate: new Date().toISOString(),
      reportPeriod: {
        from: receipts.length > 0 ? receipts.reduce((min, r) => r.receipt_date < min ? r.receipt_date : min, receipts[0].receipt_date) : '',
        to: receipts.length > 0 ? receipts.reduce((max, r) => r.receipt_date > max ? r.receipt_date : max, receipts[0].receipt_date) : ''
      },
      summary: {
        totalTaxDeductible: taxDeductibleReceipts.reduce((sum, r) => sum + r.total_amount, 0),
        totalBusinessExpenses: businessReceipts.reduce((sum, r) => sum + r.total_amount, 0),
        estimatedTaxSavings: taxDeductibleReceipts.reduce((sum, r) => sum + r.total_amount, 0) * 0.25, // Estimate 25% tax rate
        receiptCount: {
          taxDeductible: taxDeductibleReceipts.length,
          business: businessReceipts.length
        }
      },
      advanced_insights: {
        metrics: advancedMetrics,
        spending_patterns: spendingInsights,
        alerts: alerts.filter(a => a.actionable)
      },
      categorizedExpenses: Object.entries(stats.categoryCounts).map(([category, count]) => {
        const categoryReceipts = receipts.filter(r => r.category === category);
        const categoryAmount = categoryReceipts.reduce((sum, r) => sum + r.total_amount, 0);
        const categoryTaxDeductible = categoryReceipts.filter(r => r.is_tax_deductible).reduce((sum, r) => sum + r.total_amount, 0);
        
        return {
          category,
          count,
          totalAmount: categoryAmount,
          taxDeductibleAmount: categoryTaxDeductible
        };
      }),
      receipts: taxDeductibleReceipts.map(receipt => ({
        date: receipt.receipt_date,
        merchant: receipt.merchant_name,
        description: receipt.name,
        category: receipt.category,
        amount: receipt.total_amount,
        currency: receipt.currency,
        isBusiness: receipt.is_business_expense,
        notes: receipt.notes
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
      type: 'application/json;charset=utf-8;' 
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `enhanced-tax-report-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getHealthScore = () => {
    if (receipts.length === 0) return { score: 0, label: 'No Data', color: 'gray' };
    
    const analysisCompleted = receipts.filter(r => r.analysis_status === 'completed').length;
    const hasCategories = receipts.filter(r => r.category && r.category !== 'other').length;
    const businessClassified = receipts.filter(r => r.is_business_expense !== undefined).length;
    
    const score = Math.round((
      (analysisCompleted / receipts.length * 0.4) +
      (hasCategories / receipts.length * 0.3) +
      (businessClassified / receipts.length * 0.3)
    ) * 100);

    if (score >= 90) return { score, label: 'Excellent', color: 'green' };
    if (score >= 75) return { score, label: 'Good', color: 'blue' };
    if (score >= 60) return { score, label: 'Fair', color: 'yellow' };
    return { score, label: 'Needs Attention', color: 'red' };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'spendingVelocity': return <Activity className="w-4 h-4" />;
      case 'categoryDiversity': return <Target className="w-4 h-4" />;
      case 'merchantLoyalty': return <Shield className="w-4 h-4" />;
      case 'predictabilityScore': return <Clock className="w-4 h-4" />;
      case 'financialHealth': return <CheckCircle className="w-4 h-4" />;
      case 'budgetAdherence': return <TrendingUp className="w-4 h-4" />;
      default: return <BarChart3 className="w-4 h-4" />;
    }
  };

  const getMetricColor = (value: number, metric: string) => {
    // Different metrics have different "good" ranges
    const ranges = {
      categoryDiversity: { good: 0.7, ok: 0.5 },
      merchantLoyalty: { good: 0.6, ok: 0.4 },
      predictabilityScore: { good: 0.7, ok: 0.5 },
      financialHealth: { good: 0.8, ok: 0.6 },
      budgetAdherence: { good: 0.8, ok: 0.6 }
    };
    
    const range = ranges[metric as keyof typeof ranges];
    if (!range) return 'text-blue-600';
    
    if (value >= range.good) return 'text-green-600';
    if (value >= range.ok) return 'text-yellow-600';
    return 'text-red-600';
  };

  const healthScore = getHealthScore();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader 
        title="Expense Analytics" 
        description="Comprehensive insights and AI-powered analytics for your receipts and expenses"
      />

      {/* Quick Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.slice(0, 2).map((alert, index) => (
            <Alert key={alert.id} variant={alert.severity === 'high' ? 'destructive' : 'default'}>
              <Zap className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                {alert.title}
                <Badge variant={alert.severity === 'high' ? 'destructive' : 'default'} className="text-xs">
                  {alert.severity}
                </Badge>
              </AlertTitle>
              <AlertDescription className="text-sm">
                {alert.description}
                {alert.actionable && (
                  <div className="mt-2">
                    <p className="font-medium">Recommended actions:</p>
                    <ul className="list-disc list-inside text-xs mt-1">
                      {alert.recommendations.slice(0, 2).map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Advanced
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          {/* Enhanced Quick Actions & Health Score */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {healthScore.color === 'green' && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {healthScore.color === 'blue' && <TrendingUp className="w-5 h-5 text-blue-500" />}
                  {healthScore.color === 'yellow' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                  {healthScore.color === 'red' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                  Data Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${
                    healthScore.color === 'green' ? 'text-green-500' :
                    healthScore.color === 'blue' ? 'text-blue-500' :
                    healthScore.color === 'yellow' ? 'text-yellow-500' :
                    'text-red-500'
                  }`}>
                    {healthScore.score}%
                  </div>
                  <p className="text-sm text-gray-600">{healthScore.label}</p>
                  <div className="mt-2 text-xs text-gray-500">
                    {receipts.filter(r => r.analysis_status === 'completed').length}/{receipts.length} analyzed
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Quick Actions</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={refreshAnalytics}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleExportCSV} className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Export CSV
                  </Button>
                  <Button variant="outline" onClick={handleExportJSON} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export JSON
                  </Button>
                  <Button variant="outline" onClick={generateTaxReport} className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Tax Report
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Enhanced analytics with AI-powered insights, predictive modeling, and comprehensive reporting.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Advanced Metrics Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Advanced Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(advancedMetrics).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      {getMetricIcon(key)}
                    </div>
                    <div className={`text-lg font-bold ${getMetricColor(value, key)}`}>
                      {key === 'spendingVelocity' ? value.toFixed(1) : (value * 100).toFixed(0) + '%'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main Analytics Dashboard */}
          <ExpenseAnalyticsDashboard />

          {/* Insights & Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Insights & Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-semibold">Data Quality</h4>
                  <ul className="space-y-2 text-sm">
                    {receipts.filter(r => r.analysis_status === 'failed').length > 0 && (
                      <li className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        {receipts.filter(r => r.analysis_status === 'failed').length} receipts failed analysis
                      </li>
                    )}
                    {receipts.filter(r => r.analysis_status === 'pending').length > 0 && (
                      <li className="flex items-center gap-2 text-yellow-600">
                        <AlertTriangle className="w-4 h-4" />
                        {receipts.filter(r => r.analysis_status === 'pending').length} receipts pending analysis
                      </li>
                    )}
                    {receipts.filter(r => !r.category || r.category === 'other').length > 0 && (
                      <li className="flex items-center gap-2 text-blue-600">
                        <TrendingUp className="w-4 h-4" />
                        {receipts.filter(r => !r.category || r.category === 'other').length} receipts need categorization
                      </li>
                    )}
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Spending Insights</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      {stats.businessExpenses > 0 ? 
                        `${((stats.businessExpenses / stats.totalAmount) * 100).toFixed(1)}% business expenses` :
                        'No business expenses recorded'
                      }
                    </li>
                    <li className="flex items-center gap-2 text-blue-600">
                      <TrendingUp className="w-4 h-4" />
                      Average receipt: {stats.receiptCount > 0 ? formatCurrency(spendingInsights.averageTransactionSize) : '$0.00'}
                    </li>
                    <li className="flex items-center gap-2 text-purple-600">
                      <CheckCircle className="w-4 h-4" />
                      Most frequent: {spendingInsights.mostFrequentCategory.replace(/_/g, ' ')}
                    </li>
                    {spendingInsights.spendingStreaks.current > 0 && (
                      <li className="flex items-center gap-2 text-orange-600">
                        <Activity className="w-4 h-4" />
                        Current spending streak: {spendingInsights.spendingStreaks.current} days
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          {/* Enhanced Analytics Dashboard */}
          <EnhancedAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <BulkImportExport />
        </TabsContent>

        <TabsContent value="import" className="space-y-6">
          <BulkImportExport />
        </TabsContent>
      </Tabs>
    </div>
  );
}