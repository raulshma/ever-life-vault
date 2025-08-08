import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, BookOpen, FileText, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const colorMap = {
  blue: 'bg-sky-100 text-sky-600',
  green: 'bg-emerald-100 text-emerald-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600'
};

export default function QuickStats() {
  const [stats, setStats] = useState([
    { icon: CheckCircle, value: '0', label: 'Tasks Done', color: 'blue' },
    { icon: BookOpen, value: '0', label: 'Notes', color: 'green' },
    { icon: FileText, value: '0', label: 'Documents', color: 'purple' },
    { icon: TrendingUp, value: '0%', label: 'Organized', color: 'orange' }
  ]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        // Fetch completed tasks
        const { count: completedTasks } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'done');

        // Fetch total notes
        const { count: totalNotes } = await supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Fetch total documents
        const { count: totalDocuments } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Fetch total tasks to calculate organized percentage
        const { count: totalTasks } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        const organizedPercentage = totalTasks > 0 ? Math.round(((completedTasks || 0) / totalTasks) * 100) : 0;

        setStats([
          { icon: CheckCircle, value: (completedTasks || 0).toString(), label: 'Tasks Done', color: 'blue' },
          { icon: BookOpen, value: (totalNotes || 0).toString(), label: 'Notes', color: 'green' },
          { icon: FileText, value: (totalDocuments || 0).toString(), label: 'Documents', color: 'purple' },
          { icon: TrendingUp, value: `${organizedPercentage}%`, label: 'Organized', color: 'orange' }
        ]);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[1, 2, 3, 4].map((index) => (
          <Card key={index} className="glass shadow-card">
            <CardContent className="p-6 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
              <div className="text-sm text-muted-foreground">Loading...</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="glass shadow-card shine-card hover-lift">
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