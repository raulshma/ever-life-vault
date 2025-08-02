import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, BookOpen, FileText, Package2 } from 'lucide-react';

const recentActivity = [
  { type: 'task', title: 'Review quarterly goals', time: '2 hours ago', icon: CheckCircle2 },
  { type: 'note', title: 'Meeting notes - Project Alpha', time: '4 hours ago', icon: BookOpen },
  { type: 'document', title: 'Uploaded insurance policy', time: '1 day ago', icon: FileText },
  { type: 'inventory', title: 'Added camping gear to garage', time: '2 days ago', icon: Package2 },
];

export default function RecentActivity() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Recent Activity</h2>
      <Card className="bg-gradient-card shadow-card">
        <CardContent className="p-6">
          <div className="space-y-4">
            {recentActivity.map((activity, index) => {
              const Icon = activity.icon;
              return (
                <div key={index} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{activity.title}</div>
                    <div className="text-sm text-muted-foreground">{activity.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}