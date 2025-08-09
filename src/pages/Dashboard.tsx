import React from 'react';
import PageHeader from '@/components/PageHeader';
import QuickStats from '@/components/dashboard/QuickStats';
import ModuleGrid from '@/components/dashboard/ModuleGrid';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { Home } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageHeader
        title="Dashboard"
        description="Overview and quick access to your workspace"
        icon={Home}
      />
      <div className="container py-6 sm:py-10">
        <QuickStats />
        <ModuleGrid />
        <RecentActivity />
      </div>
    </div>
  );
}