import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt as ReceiptIcon,
  Calendar,
  Store,
  PieChart as PieChartIcon,
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface ExpenseAnalyticsDashboardProps {
  className?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

export function ExpenseAnalyticsDashboard({ className }: ExpenseAnalyticsDashboardProps) {
  const { receipts, categories, getExpenseStats } = useReceipts();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '3m' | '6m' | '1y'>('30d');
  const [viewType, setViewType] = useState<'amount' | 'count'>('amount');

  const stats = getExpenseStats();

  // Filter receipts by time range
  const filteredReceipts = useMemo(() => {
    const now = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '3m':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return receipts.filter(receipt => new Date(receipt.receipt_date) >= startDate);
  }, [receipts, timeRange]);

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    // Monthly trends
    const monthlyData = new Map<string, { amount: number; count: number; business: number; personal: number; }>();
    
    filteredReceipts.forEach(receipt => {
      const month = receipt.receipt_date.substring(0, 7); // YYYY-MM
      const existing = monthlyData.get(month) || { amount: 0, count: 0, business: 0, personal: 0 };
      
      existing.amount += receipt.total_amount;
      existing.count += 1;
      
      if (receipt.is_business_expense) {
        existing.business += receipt.total_amount;
      } else {
        existing.personal += receipt.total_amount;
      }
      
      monthlyData.set(month, existing);
    });

    const monthlyTrends = Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        amount: data.amount,
        count: data.count,
        business: data.business,
        personal: data.personal,
        monthName: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Category breakdown
    const categoryData = new Map<string, { amount: number; count: number; }>();
    
    filteredReceipts.forEach(receipt => {
      const existing = categoryData.get(receipt.category) || { amount: 0, count: 0 };
      existing.amount += receipt.total_amount;
      existing.count += 1;
      categoryData.set(receipt.category, existing);
    });

    const categoryBreakdown = Array.from(categoryData.entries())
      .map(([category, data], index) => ({
        category: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        amount: data.amount,
        count: data.count,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.amount - a.amount);

    // Top merchants
    const merchantData = new Map<string, { amount: number; count: number; }>();
    
    filteredReceipts.forEach(receipt => {
      if (receipt.merchant_name) {
        const existing = merchantData.get(receipt.merchant_name) || { amount: 0, count: 0 };
        existing.amount += receipt.total_amount;
        existing.count += 1;
        merchantData.set(receipt.merchant_name, existing);
      }
    });

    const topMerchants = Array.from(merchantData.entries())
      .map(([merchant, data]) => ({
        merchant,
        amount: data.amount,
        count: data.count
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Daily spending pattern
    const dailyPattern = new Map<number, { amount: number; count: number; }>();
    
    filteredReceipts.forEach(receipt => {
      const dayOfWeek = new Date(receipt.receipt_date).getDay();
      const existing = dailyPattern.get(dayOfWeek) || { amount: 0, count: 0 };
      existing.amount += receipt.total_amount;
      existing.count += 1;
      dailyPattern.set(dayOfWeek, existing);
    });

    const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailySpending = weekDays.map((day, index) => ({
      day,
      amount: dailyPattern.get(index)?.amount || 0,
      count: dailyPattern.get(index)?.count || 0
    }));

    return {
      monthlyTrends,
      categoryBreakdown,
      topMerchants,
      dailySpending
    };
  }, [filteredReceipts]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const calculateGrowth = () => {
    const { monthlyTrends } = analyticsData;
    if (monthlyTrends.length < 2) return { growth: 0, isPositive: true };
    
    const current = monthlyTrends[monthlyTrends.length - 1]?.amount || 0;
    const previous = monthlyTrends[monthlyTrends.length - 2]?.amount || 0;
    
    if (previous === 0) return { growth: 0, isPositive: true };
    
    const growth = ((current - previous) / previous) * 100;
    return { growth: Math.abs(growth), isPositive: growth >= 0 };
  };

  const { growth, isPositive } = calculateGrowth();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Expense Analytics</h2>
          <p className="text-gray-600">Comprehensive insights into your spending patterns</p>
        </div>
        
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="3m">Last 3 months</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={viewType} onValueChange={(value: any) => setViewType(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amount">By Amount</SelectItem>
              <SelectItem value="count">By Count</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Spending</p>
                <p className="text-2xl font-bold">{formatCurrency(filteredReceipts.reduce((sum, r) => sum + r.total_amount, 0))}</p>
                <div className="flex items-center mt-1">
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4 text-red-500 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-green-500 mr-1" />
                  )}
                  <span className={`text-sm ${isPositive ? 'text-red-500' : 'text-green-500'}`}>
                    {growth.toFixed(1)}% vs last period
                  </span>
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Receipts</p>
                <p className="text-2xl font-bold">{filteredReceipts.length}</p>
                <p className="text-sm text-gray-500">
                  Avg: {formatCurrency(filteredReceipts.length > 0 ? filteredReceipts.reduce((sum, r) => sum + r.total_amount, 0) / filteredReceipts.length : 0)}
                </p>
              </div>
              <ReceiptIcon className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Business Expenses</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(filteredReceipts.filter(r => r.is_business_expense).reduce((sum, r) => sum + r.total_amount, 0))}
                </p>
                <p className="text-sm text-gray-500">
                  {filteredReceipts.filter(r => r.is_business_expense).length} receipts
                </p>
              </div>
              <Target className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tax Deductible</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(filteredReceipts.filter(r => r.is_tax_deductible).reduce((sum, r) => sum + r.total_amount, 0))}
                </p>
                <p className="text-sm text-gray-500">
                  Est. savings: {formatCurrency(filteredReceipts.filter(r => r.is_tax_deductible).reduce((sum, r) => sum + r.total_amount, 0) * 0.25)}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="merchants">Merchants</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Spending Trends Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={analyticsData.monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monthName" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="business"
                    stackId="1"
                    stroke="#8884d8"
                    fill="#8884d8"
                    name="Business"
                  />
                  <Area
                    type="monotone"
                    dataKey="personal"
                    stackId="1"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                    name="Personal"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5" />
                  Spending by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analyticsData.categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey={viewType === 'amount' ? 'amount' : 'count'}
                    >
                      {analyticsData.categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [
                        viewType === 'amount' ? formatCurrency(value) : value,
                        viewType === 'amount' ? 'Amount' : 'Count'
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.categoryBreakdown.slice(0, 8).map((category, index) => (
                    <div key={category.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-sm font-medium">{category.category}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {viewType === 'amount' ? formatCurrency(category.amount) : `${category.count} receipts`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {((category[viewType] / filteredReceipts.reduce((sum, r) => sum + (viewType === 'amount' ? r.total_amount : 1), 0)) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="merchants" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Top Merchants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analyticsData.topMerchants.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="merchant" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                  />
                  <YAxis tickFormatter={viewType === 'amount' ? formatCurrency : undefined} />
                  <Tooltip 
                    formatter={(value: number) => [
                      viewType === 'amount' ? formatCurrency(value) : value,
                      viewType === 'amount' ? 'Total Spent' : 'Receipt Count'
                    ]}
                  />
                  <Bar 
                    dataKey={viewType === 'amount' ? 'amount' : 'count'} 
                    fill="#8884d8"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Spending by Day of Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.dailySpending}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis tickFormatter={viewType === 'amount' ? formatCurrency : undefined} />
                  <Tooltip 
                    formatter={(value: number) => [
                      viewType === 'amount' ? formatCurrency(value) : value,
                      viewType === 'amount' ? 'Average Spent' : 'Receipt Count'
                    ]}
                  />
                  <Bar 
                    dataKey={viewType === 'amount' ? 'amount' : 'count'} 
                    fill="#82ca9d"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Most Active Day</p>
                  <p className="text-xl font-bold">
                    {analyticsData.dailySpending.reduce((max, day) => 
                      day.count > max.count ? day : max, { day: 'None', count: 0 }
                    ).day}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Avg Receipt Value</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(
                      filteredReceipts.length > 0 
                        ? filteredReceipts.reduce((sum, r) => sum + r.total_amount, 0) / filteredReceipts.length 
                        : 0
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Largest Receipt</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(
                      filteredReceipts.length > 0 
                        ? Math.max(...filteredReceipts.map(r => r.total_amount))
                        : 0
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}