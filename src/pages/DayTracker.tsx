import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Calendar, 
  Clock, 
  Flag,
  MoreHorizontal,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';

const columns = [
  { id: 'todo', title: 'To Do', color: 'bg-gray-50' },
  { id: 'in-progress', title: 'In Progress', color: 'bg-blue-50' },
  { id: 'done', title: 'Done', color: 'bg-green-50' }
] as const;

const priorityColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800'
};

export default function DayTracker() {
  const { tasks, loading, addTask: addTaskHook, updateTask } = useTasks();
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    await addTaskHook(newTaskTitle);
    setNewTaskTitle('');
  };

  const moveTask = async (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => {
    await updateTask(taskId, { status: newStatus });
  };

  const getTasksByStatus = (status: 'todo' | 'in-progress' | 'done') => {
    return tasks.filter(task => task.status === status);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle pb-20 md:pb-8">
      {/* Header */}
      <div className="bg-gradient-primary text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Day Tracker</h1>
              <p className="text-white/90">Manage your tasks and track daily productivity</p>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span className="text-white/90">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Add Task */}
        <Card className="mb-8 bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Quick Add Task</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-3">
              <Input
                placeholder="What needs to be done?"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTask()}
                className="flex-1"
              />
              <Button onClick={addTask} variant="default">
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columns.map((column) => (
            <div key={column.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {column.title}
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {getTasksByStatus(column.id).length}
                </Badge>
              </div>

              <div className="space-y-3 min-h-[400px]">
                {getTasksByStatus(column.id).map((task) => (
                  <Card 
                    key={task.id} 
                    className="group hover:shadow-card transition-all duration-200 cursor-pointer bg-white border-0"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {task.title}
                        </h3>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>

                      {task.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <Badge 
                          variant="secondary" 
                          className={priorityColors[task.priority]}
                        >
                          <Flag className="w-3 h-3 mr-1" />
                          {task.priority}
                        </Badge>

                        {task.due_date && (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(task.due_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {/* Move Task Buttons */}
                      <div className="flex space-x-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        {column.id !== 'todo' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => moveTask(task.id, 'todo')}
                            className="text-xs"
                          >
                            To Do
                          </Button>
                        )}
                        {column.id !== 'in-progress' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => moveTask(task.id, 'in-progress')}
                            className="text-xs"
                          >
                            In Progress
                          </Button>
                        )}
                        {column.id !== 'done' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => moveTask(task.id, 'done')}
                            className="text-xs"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Done
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {getTasksByStatus(column.id).length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <p>No tasks in {column.title.toLowerCase()}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}