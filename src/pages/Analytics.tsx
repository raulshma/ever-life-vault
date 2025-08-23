import React from 'react';
import { PageHeader } from '@/components/PageHeader';
import { ExpenseAnalyticsDashboard } from '@/components/ExpenseAnalyticsDashboard';
import { BulkImportExport } from '@/components/BulkImportExport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReceipts } from '@/hooks/useReceipts';
import { 
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart3
} from 'lucide-react';

export default function Analytics() {
  const { receipts, getExpenseStats } = useReceipts();
  const stats = getExpenseStats();

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
    link.setAttribute('download', `receipts-export-${new Date().toISOString().split('T')[0]}.json`);
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
        from: receipts.length > 0 ? Math.min(...receipts.map(r => r.receipt_date)) : '',
        to: receipts.length > 0 ? Math.max(...receipts.map(r => r.receipt_date)) : ''
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
    link.setAttribute('download', `tax-report-${new Date().toISOString().split('T')[0]}.json`);
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

  const healthScore = getHealthScore();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader 
        title="Expense Analytics" 
        description="Comprehensive insights and reporting for your receipts and expenses"
      />

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
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
          {/* Quick Actions & Health Score */}
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
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
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
                  Export your data for tax preparation, accounting software, or backup purposes.
                </p>
              </CardContent>
            </Card>
          </div>

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
                      Average receipt: {stats.receiptCount > 0 ? `$${(stats.totalAmount / stats.receiptCount).toFixed(2)}` : '$0.00'}
                    </li>
                    <li className="flex items-center gap-2 text-purple-600">
                      <CheckCircle className="w-4 h-4" />
                      {Object.keys(stats.categoryCounts).length} unique categories used
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
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