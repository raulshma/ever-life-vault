import React from 'react';
import { WidgetShell } from '../components/WidgetShell';
import type { WidgetProps } from '../types';
import { useReceipts } from '@/hooks/useReceipts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { 
  Receipt as ReceiptIcon, 
  DollarSign, 
  TrendingUp, 
  AlertCircle,
  Calendar,
  Store
} from 'lucide-react';

type ReceiptConfig = { 
  max?: number;
  showBusinessOnly?: boolean;
  showAnalytics?: boolean;
}

export default function ReceiptWidget({ config }: WidgetProps<ReceiptConfig>) {
  const { receipts, loading, getExpenseStats } = useReceipts();
  const max = typeof config?.max === 'number' ? config.max : 5;
  const showBusinessOnly = config?.showBusinessOnly ?? false;
  const showAnalytics = config?.showAnalytics ?? true;
  
  const filteredReceipts = showBusinessOnly 
    ? receipts.filter(r => r.is_business_expense)
    : receipts;
  
  const recent = filteredReceipts.slice(0, max);
  const stats = getExpenseStats();
  
  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getAnalysisStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <div className="w-2 h-2 bg-success rounded-full" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-destructive" />;
      case 'processing':
        return <div className="w-2 h-2 bg-info rounded-full animate-pulse" />;
      default:
        return <div className="w-2 h-2 bg-muted rounded-full" />;
    }
  };

  if (loading) {
    return (
      <WidgetShell title="Receipts">
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title="Receipts">
      <div className="space-y-4">
        {/* Quick Stats */}
        {showAnalytics && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ReceiptIcon className="w-3 h-3 text-info" />
                <span className="text-xs text-muted-foreground">Total:</span>
                <span className="font-medium">{stats.receiptCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-3 h-3 text-success" />
                <span className="text-xs text-muted-foreground">Amount:</span>
                <span className="font-medium">{formatCurrency(stats.totalAmount)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-info" />
                <span className="text-xs text-muted-foreground">Business:</span>
                <span className="font-medium">{formatCurrency(stats.businessExpenses)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3 text-warning" />
                <span className="text-xs text-muted-foreground">This Month:</span>
                <span className="font-medium">
                  {Object.entries(stats.monthlyTotals)
                    .filter(([month]) => month === new Date().toISOString().substring(0, 7))
                    .reduce((sum, [_, amount]) => sum + amount, 0)
                    .toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Recent Receipts */}
        <div>
          <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
            <span>Recent receipts</span>
            {showBusinessOnly && <Badge variant="outline" className="text-xs">Business only</Badge>}
          </div>
          
          {recent.length === 0 ? (
            <div className="text-center py-4">
              <ReceiptIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No receipts yet</p>
              <Button variant="ghost" size="sm" asChild className="mt-2">
                <Link to="/receipts">Add Your First Receipt</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((receipt) => (
                <div key={receipt.id} className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getAnalysisStatusIcon(receipt.analysis_status)}
                      <span className="font-medium truncate">{receipt.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Store className="w-3 h-3" />
                      <span className="truncate">
                        {receipt.merchant_name || 'Unknown Merchant'}
                      </span>
                      <span>•</span>
                      <span>{new Date(receipt.receipt_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="font-medium text-success">
                      {formatCurrency(receipt.total_amount, receipt.currency)}
                    </div>
                    <div className="flex gap-1">
                      {receipt.is_business_expense && (
                        <Badge variant="outline" className="text-xs">Business</Badge>
                      )}
                      {receipt.is_tax_deductible && (
                        <Badge variant="outline" className="text-xs">Tax</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" asChild className="flex-1">
            <Link to="/receipts">View All</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="flex-1">
            <Link to="/analytics">Analytics</Link>
          </Button>
        </div>
      </div>
    </WidgetShell>
  );
}