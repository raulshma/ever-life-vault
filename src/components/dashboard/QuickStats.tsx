import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, BookOpen, FileText, TrendingUp } from 'lucide-react';

const stats = [
  { icon: CheckCircle, value: '32', label: 'Tasks Done', color: 'blue' },
  { icon: BookOpen, value: '156', label: 'Notes', color: 'green' },
  { icon: FileText, value: '89', label: 'Documents', color: 'purple' },
  { icon: TrendingUp, value: '98%', label: 'Organized', color: 'orange' }
];

const colorMap = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600'
};

export default function QuickStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="bg-gradient-card shadow-card">
            <CardContent className="p-6 text-center">
              <div className={`flex items-center justify-center w-12 h-12 rounded-lg mx-auto mb-3 ${colorMap[stat.color]}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}