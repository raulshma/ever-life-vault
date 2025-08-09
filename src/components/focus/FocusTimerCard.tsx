import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FocusTimer } from '@/components/focus/FocusTimer';
import { useTasks } from '@/hooks/useTasks';

export const FocusTimerCard: React.FC = () => {
  const { tasks } = useTasks();
  const active = tasks.find(t => t.status !== 'done');

  return (
    <Card className="glass shadow-card border-0">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">Focus</CardTitle>
      </CardHeader>
      <CardContent>
        <FocusTimer taskId={active?.id ?? null} taskTitle={active?.title} />
      </CardContent>
    </Card>
  );
};

export default FocusTimerCard;


