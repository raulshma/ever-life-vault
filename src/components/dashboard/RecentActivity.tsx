import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, BookOpen, FileText, Package2, Loader2 } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { useDocuments } from '@/hooks/useDocuments';
import { useInventory } from '@/hooks/useInventory';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  type: 'task' | 'note' | 'document' | 'inventory';
  title: string;
  time: string;
  icon: React.ElementType;
  timestamp: Date;
}

export default function RecentActivity() {
  const { tasks, loading: tasksLoading } = useTasks();
  const { notes, loading: notesLoading } = useNotes();
  const { documents, loading: documentsLoading } = useDocuments();
  const { items, loading: inventoryLoading } = useInventory();

  const loading = tasksLoading || notesLoading || documentsLoading || inventoryLoading;

  const getRecentActivity = (): Activity[] => {
    const activities: Activity[] = [];

    // Recent tasks
    tasks.slice(0, 2).forEach(task => {
      activities.push({
        type: 'task',
        title: task.title,
        time: formatDistanceToNow(new Date(task.updated_at), { addSuffix: true }),
        icon: CheckCircle2,
        timestamp: new Date(task.updated_at)
      });
    });

    // Recent notes
    notes.slice(0, 2).forEach(note => {
      activities.push({
        type: 'note',
        title: note.title,
        time: formatDistanceToNow(new Date(note.updated_at), { addSuffix: true }),
        icon: BookOpen,
        timestamp: new Date(note.updated_at)
      });
    });

    // Recent documents
    documents.slice(0, 2).forEach(doc => {
      activities.push({
        type: 'document',
        title: doc.name,
        time: formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true }),
        icon: FileText,
        timestamp: new Date(doc.updated_at)
      });
    });

    // Recent inventory items
    items.slice(0, 2).forEach(item => {
      activities.push({
        type: 'inventory',
        title: item.name,
        time: formatDistanceToNow(new Date(item.updated_at), { addSuffix: true }),
        icon: Package2,
        timestamp: new Date(item.updated_at)
      });
    });

    // Sort by timestamp and return most recent 8
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8);
  };

  const recentActivity = getRecentActivity();

  if (loading) {
    return (
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Recent Activity</h2>
        <Card className="glass shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading activity...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Recent Activity</h2>
      <Card className="glass shadow-card">
        <CardContent className="p-6">
          <div className="space-y-3 sm:space-y-4 gradient-border-l pl-3 sm:pl-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <div key={index} className="flex items-center gap-3 sm:gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{activity.title}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">{activity.time}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity found. Start by adding some tasks, notes, or documents!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}