import React from 'react';
import { BudgetDashboard } from '@/components/BudgetDashboard';
import { PageHeader } from '@/components/PageHeader';

export default function Budget() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader 
        title="Budget & Financial Planning" 
        description="Smart budgeting, expense tracking, and automated financial reporting"
      />
      
      <BudgetDashboard />
    </div>
  );
}