'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useReceipts } from '@/hooks/useReceipts';
import { BudgetingService, type ExpenseReport } from '@/services/BudgetingService';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Mail,
  Clock,
  Target,
  DollarSign,
  CreditCard,
  Store,
  Tag,
  Sparkles,
  Eye,
  RefreshCw
} from 'lucide-react';

interface AutomatedReportsProps {
  className?: string;
}

export function AutomatedReports({ className }: AutomatedReportsProps) {
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ExpenseReport | null>(null);
  const [budgetingService, setBudgetingService] = useState<BudgetingService | null>(null);
  const [insights, setInsights] = useState<any>(null);
  const [customReportConfig, setCustomReportConfig] = useState({
    type: 'monthly' as ExpenseReport['report_type'],
    start_date: '',
    end_date: '',
    auto_schedule: false,
    recipients: [] as string[]
  });

  const { receipts } = useReceipts();
  const { toast } = useToast();

  // Initialize service and load data
  useEffect(() => {
    if (receipts.length > 0) {
      const service = new BudgetingService(receipts, []);
      setBudgetingService(service);
      
      // Generate default reports
      generateDefaultReports(service);
      
      // Load spending insights
      const spendingInsights = service.getSpendingInsights();
      setInsights(spendingInsights);
    }
  }, [receipts]);

  const generateDefaultReports = (service: BudgetingService) => {
    const now = new Date();
    const defaultReports: ExpenseReport[] = [];

    // Current month report
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    defaultReports.push(service.generateExpenseReport(
      monthStart.toISOString().split('T')[0],
      monthEnd.toISOString().split('T')[0],
      'monthly'
    ));

    // Previous month report
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    defaultReports.push(service.generateExpenseReport(
      prevMonthStart.toISOString().split('T')[0],
      prevMonthEnd.toISOString().split('T')[0],
      'monthly'
    ));

    // Current quarter report
    const quarter = Math.floor(now.getMonth() / 3);
    const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
    const quarterEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0);
    defaultReports.push(service.generateExpenseReport(
      quarterStart.toISOString().split('T')[0],
      quarterEnd.toISOString().split('T')[0],
      'quarterly'
    ));

    // Year to date report
    const yearStart = new Date(now.getFullYear(), 0, 1);
    defaultReports.push(service.generateExpenseReport(
      yearStart.toISOString().split('T')[0],
      now.toISOString().split('T')[0],
      'yearly'
    ));

    setReports(defaultReports);
    if (defaultReports.length > 0) {
      setSelectedReport(defaultReports[0]);
    }
  };

  const generateCustomReport = () => {
    if (!budgetingService || !customReportConfig.start_date || !customReportConfig.end_date) {
      toast({
        title: "Invalid Configuration",
        description: "Please select start and end dates",
        variant: "destructive"
      });
      return;
    }

    const report = budgetingService.generateExpenseReport(
      customReportConfig.start_date,
      customReportConfig.end_date,
      customReportConfig.type
    );

    setReports(prev => [report, ...prev]);
    setSelectedReport(report);

    toast({
      title: "Report Generated",
      description: `Custom ${customReportConfig.type} report has been created`,
    });
  };

  const exportReport = (report: ExpenseReport, format: 'csv' | 'json' | 'pdf') => {
    let content: string;
    let mimeType: string;
    let filename: string;

    switch (format) {
      case 'csv':
        content = generateCSVContent(report);
        mimeType = 'text/csv;charset=utf-8;';
        filename = `expense-report-${report.period_start}-to-${report.period_end}.csv`;
        break;
      case 'json':
        content = JSON.stringify(report, null, 2);
        mimeType = 'application/json;charset=utf-8;';
        filename = `expense-report-${report.period_start}-to-${report.period_end}.json`;
        break;
      case 'pdf':
        // For now, export as JSON (PDF generation would require additional libraries)
        content = JSON.stringify(report, null, 2);
        mimeType = 'application/json;charset=utf-8;';
        filename = `expense-report-${report.period_start}-to-${report.period_end}.json`;
        break;
      default:
        return;
    }

    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Report Exported",
      description: `Report exported as ${format.toUpperCase()}`,
    });
  };

  const generateCSVContent = (report: ExpenseReport): string => {
    const headers = [
      'Report Type',
      'Period Start',
      'Period End',
      'Total Expenses',
      'Business Expenses',
      'Personal Expenses',
      'Tax Deductible',
      'Reimbursable',
      'Generated At'
    ];

    const data = [
      report.report_type,
      report.period_start,
      report.period_end,
      report.total_expenses.toFixed(2),
      report.total_business_expenses.toFixed(2),
      report.total_personal_expenses.toFixed(2),
      report.total_tax_deductible.toFixed(2),
      report.total_reimbursable.toFixed(2),
      report.generated_at
    ];

    let csvContent = headers.join(',') + '\n' + data.join(',') + '\n\n';
    
    // Add category breakdown
    csvContent += 'Category Breakdown\n';
    csvContent += 'Category,Amount\n';
    Object.entries(report.category_breakdown).forEach(([category, amount]) => {
      csvContent += `${category},${amount.toFixed(2)}\n`;
    });

    return csvContent;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getReportPeriodLabel = (report: ExpenseReport) => {
    const start = new Date(report.period_start);
    const end = new Date(report.period_end);
    
    if (report.report_type === 'monthly') {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (report.report_type === 'quarterly') {
      const quarter = Math.floor(start.getMonth() / 3) + 1;
      return `Q${quarter} ${start.getFullYear()}`;
    } else if (report.report_type === 'yearly') {
      return start.getFullYear().toString();
    } else {
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Automated Reports</h2>
          <p className="text-gray-600">Generate and schedule expense reports</p>
        </div>
        <Button onClick={() => budgetingService && generateDefaultReports(budgetingService)}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Reports
        </Button>
      </div>

      <Tabs defaultValue="reports" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Reports List */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Generate Custom Report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Report Type</Label>
                    <Select 
                      value={customReportConfig.type} 
                      onValueChange={(value: any) => setCustomReportConfig(prev => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="custom">Custom Period</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={customReportConfig.start_date}
                        onChange={(e) => setCustomReportConfig(prev => ({ ...prev, start_date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={customReportConfig.end_date}
                        onChange={(e) => setCustomReportConfig(prev => ({ ...prev, end_date: e.target.value }))}
                      />
                    </div>
                  </div>

                  <Button onClick={generateCustomReport} className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <h3 className="font-semibold">Available Reports</h3>
                {reports.map((report, index) => (
                  <Card 
                    key={index}
                    className={`cursor-pointer transition-colors ${
                      selectedReport?.id === report.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedReport(report)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{getReportPeriodLabel(report)}</div>
                          <div className="text-sm text-gray-500 capitalize">{report.report_type}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(report.total_expenses)}</div>
                          <Badge variant="outline" className="text-xs">
                            {report.auto_generated ? 'Auto' : 'Manual'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Report Details */}
            <div className="lg:col-span-2">
              {selectedReport ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{getReportPeriodLabel(selectedReport)} Report</CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => exportReport(selectedReport, 'csv')}>
                          <Download className="w-4 h-4 mr-1" />
                          CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportReport(selectedReport, 'json')}>
                          <Download className="w-4 h-4 mr-1" />
                          JSON
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <DollarSign className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                          <div className="text-2xl font-bold">{formatCurrency(selectedReport.total_expenses)}</div>
                          <div className="text-sm text-gray-600">Total Expenses</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Target className="w-6 h-6 mx-auto mb-2 text-green-500" />
                          <div className="text-2xl font-bold">{formatCurrency(selectedReport.total_business_expenses)}</div>
                          <div className="text-sm text-gray-600">Business</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Tag className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                          <div className="text-2xl font-bold">{formatCurrency(selectedReport.total_tax_deductible)}</div>
                          <div className="text-sm text-gray-600">Tax Deductible</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <RefreshCw className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                          <div className="text-2xl font-bold">{formatCurrency(selectedReport.total_reimbursable)}</div>
                          <div className="text-sm text-gray-600">Reimbursable</div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Category Breakdown */}
                    <div>
                      <h4 className="font-semibold mb-3">Category Breakdown</h4>
                      <div className="space-y-2">
                        {Object.entries(selectedReport.category_breakdown)
                          .sort(([,a], [,b]) => b - a)
                          .map(([category, amount]) => {
                            const percentage = (amount / selectedReport.total_expenses) * 100;
                            return (
                              <div key={category} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="capitalize">{category.replace('_', ' ')}</div>
                                  <Badge variant="outline" className="text-xs">
                                    {percentage.toFixed(1)}%
                                  </Badge>
                                </div>
                                <div className="font-medium">{formatCurrency(amount)}</div>
                              </div>
                            );
                        })}
                      </div>
                    </div>

                    {/* Top Merchants */}
                    {Object.keys(selectedReport.merchant_breakdown).length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Top Merchants</h4>
                        <div className="space-y-2">
                          {Object.entries(selectedReport.merchant_breakdown)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 5)
                            .map(([merchant, amount]) => (
                              <div key={merchant} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Store className="w-4 h-4 text-gray-400" />
                                  <span>{merchant}</span>
                                </div>
                                <div className="font-medium">{formatCurrency(amount)}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Payment Methods */}
                    {Object.keys(selectedReport.payment_method_breakdown).length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Payment Methods</h4>
                        <div className="space-y-2">
                          {Object.entries(selectedReport.payment_method_breakdown)
                            .sort(([,a], [,b]) => b - a)
                            .map(([method, amount]) => (
                              <div key={method} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="w-4 h-4 text-gray-400" />
                                  <span className="capitalize">{method.replace('_', ' ')}</span>
                                </div>
                                <div className="font-medium">{formatCurrency(amount)}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Report Selected</h3>
                    <p className="text-gray-500">Select a report from the list to view details</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          {insights ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Spending Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-500" />
                    Spending Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights.recommendations.map((rec: string, index: number) => (
                    <div key={index} className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Top Categories */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Spending Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.topCategories.map((category: any, index: number) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium capitalize">{category.category.replace('_', ' ')}</div>
                          <div className="text-sm text-gray-500">{category.percentage.toFixed(1)}% of total</div>
                        </div>
                        <div className="text-lg font-semibold">{formatCurrency(category.amount)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Spending Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Spending Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.spendingTrends.map((trend: any, index: number) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{trend.month}</span>
                          {trend.change > 0 ? (
                            <TrendingUp className="w-4 h-4 text-red-500" />
                          ) : trend.change < 0 ? (
                            <TrendingDown className="w-4 h-4 text-green-500" />
                          ) : (
                            <BarChart3 className="w-4 h-4 text-gray-500" />
                          )}
                          <span className={`text-sm ${
                            trend.change > 0 ? 'text-red-600' : trend.change < 0 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            {trend.change > 0 ? '+' : ''}{trend.change.toFixed(1)}%
                          </span>
                        </div>
                        <div className="font-medium">{formatCurrency(trend.amount)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Merchants */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Merchants</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.topMerchants.map((merchant: any, index: number) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{merchant.merchant}</div>
                          <div className="text-sm text-gray-500">{merchant.count} transactions</div>
                        </div>
                        <div className="text-lg font-semibold">{formatCurrency(merchant.amount)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Insights Available</h3>
                <p className="text-gray-500">Add some receipts to generate spending insights</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Automated Report Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Weekly Reports</h4>
                        <Badge variant="outline">Sundays</Badge>
                      </div>
                      <p className="text-sm text-gray-600">Automatically generated every Sunday</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Monthly Reports</h4>
                        <Badge variant="outline">1st of Month</Badge>
                      </div>
                      <p className="text-sm text-gray-600">Generated on the first day of each month</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Quarterly Reports</h4>
                        <Badge variant="outline">Quarterly</Badge>
                      </div>
                      <p className="text-sm text-gray-600">Generated at the start of each quarter</p>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="text-center text-gray-500">
                  <Mail className="w-8 h-8 mx-auto mb-2" />
                  <p>Email notifications for scheduled reports coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}