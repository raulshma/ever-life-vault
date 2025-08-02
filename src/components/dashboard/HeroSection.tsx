import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, BookOpen, Plus } from 'lucide-react';

const quickActions = [
  { icon: Calendar, label: 'Add Task', action: () => {}, variant: 'default' as const },
  { icon: BookOpen, label: 'New Note', action: () => {}, variant: 'accent' as const },
  { icon: Plus, label: 'Quick Capture', action: () => {}, variant: 'hero' as const },
];

export default function HeroSection() {
  return (
    <div className="relative overflow-hidden bg-gradient-hero text-white">
      <div className="absolute inset-0 bg-black/10"></div>
      <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Life OS
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-3xl mx-auto">
            Organize your digital and physical life with speed, security, and simplicity
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant={action.variant}
                  size="xl"
                  onClick={action.action}
                  className="shadow-glow"
                >
                  <Icon size={20} />
                  {action.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}