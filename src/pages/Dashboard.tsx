import React from 'react';
import HeroSection from '@/components/dashboard/HeroSection';
import QuickStats from '@/components/dashboard/QuickStats';
import ModuleGrid from '@/components/dashboard/ModuleGrid';
import RecentActivity from '@/components/dashboard/RecentActivity';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-subtle pb-24 md:pb-8">
      <HeroSection />
      <div className="container py-8 sm:py-10">
        <QuickStats />
        <ModuleGrid />
        <RecentActivity />
      </div>
    </div>
  );
}