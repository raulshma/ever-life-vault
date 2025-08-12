import React, { useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import { Home } from 'lucide-react';
import DashboardMosaic from '@/features/dashboard-widgets/components/DashboardMosaic';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageHeader
        title="Dashboard"
        description="Overview and quick access to your workspace"
        icon={Home}
      />
      <div className="container py-6 sm:py-10">
        <DashboardMosaic />
      </div>
    </div>
  );
}