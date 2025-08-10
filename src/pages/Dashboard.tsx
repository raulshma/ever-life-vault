import React, { useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import QuickStats from '@/components/dashboard/QuickStats';
import ModuleGrid from '@/components/dashboard/ModuleGrid';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { Home } from 'lucide-react';
import DashboardMosaic from '@/features/dashboard-widgets/components/DashboardMosaic';

export default function Dashboard() {
  let enabled = useMemo(() => {
    const flag = (import.meta as any).env?.VITE_NEW_DASHBOARD
    const qp = new URLSearchParams(window.location.search).get('newDashboard')
    return String(flag).toLowerCase() === '1' || String(flag).toLowerCase() === 'true' || qp === '1' || qp === 'true'
  }, [])

  enabled = true
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageHeader
        title="Dashboard"
        description="Overview and quick access to your workspace"
        icon={Home}
      />
      <div className="container py-6 sm:py-10">
        {enabled ? (
          <DashboardMosaic />
        ) : (
          <>
            <QuickStats />
            <ModuleGrid />
            <RecentActivity />
          </>
        )}
      </div>
    </div>
  );
}