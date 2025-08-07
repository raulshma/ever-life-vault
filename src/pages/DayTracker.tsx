import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Calendar, 
  Clock, 
  Flag,
  MoreHorizontal,
  CheckCircle2,
  Loader2,
  Edit,
  Trash2,
  Grid
} from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { TaskEditDialog } from '@/components/TaskEditDialog';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { MonthlyStatusSheets } from '@/components/MonthlyStatusSheets';

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

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in-progress' | 'done';
  created_at: string;
  updated_at: string;
  due_date?: string;
  user_id: string;
}

export default function DayTracker() {
  const { tasks, loading, addTask: addTaskHook, updateTask, deleteTask } = useTasks();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    await addTaskHook(newTaskTitle);
    setNewTaskTitle('');
  };

  const addTaskDetailed = async (title: string, description?: string, priority?: 'low' | 'medium' | 'high', dueDate?: string) => {
    await addTaskHook(title, description, priority, dueDate);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setShowEditDialog(true);
  };

  const handleSaveTask = async (updates: Partial<Task>) => {
    if (!selectedTask) return;
    await updateTask(selectedTask.id, updates);
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
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
    <div className="min-h-screen bg-gradient-subtle pb-0">
      {/* Header */}
      <div className="relative bg-gradient-primary text-white gradient-sheen">
        <div className="absolute inset-0 bg-white/5" />
        <div className="container relative py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Day Tracker</h1>
              <p className="text-white/80 text-sm sm:text-base mt-1">
                Manage your tasks and track daily productivity
              </p>
            </div>
            <div className="glass rounded-xl px-4 py-2 flex items-center gap-2 text-sm sm:text-base shadow-elegant">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
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

      <div className="pt-4 pb-0">
        <Tabs defaultValue="monthly" className="w-full">
          <TabsList className="tablist-elevated grid w-full grid-cols-2 mb-6 sm:mb-8">
            <TabsTrigger value="kanban" className="tabtrigger flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden xs:inline">Daily Tasks</span>
              <span className="xs:hidden">Daily</span>
            </TabsTrigger>
            <TabsTrigger value="monthly" className="tabtrigger flex items-center gap-2">
              <Grid className="h-4 w-4" />
              <span className="hidden xs:inline">Monthly Status</span>
              <span className="xs:hidden">Monthly</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="space-y-6 sm:space-y-8">
            {/* Quick Add Task */}
            <Card className="bg-gradient-card shadow-card border-0 rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                  </span>
                  <span className="font-semibold">Quick Add Task</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="What needs to be done?"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTask()}
                    className="flex-1 rounded-xl"
                  />
                  <div className="flex gap-2">
                    <Button onClick={addTask} variant="default" className="flex-1 sm:flex-none rounded-xl">
                      <Plus className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                    <Button onClick={() => setShowAddDialog(true)} variant="outline" className="flex-1 sm:flex-none rounded-xl">
                      <Plus className="w-4 h-4 mr-2" />
                      Detailed
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Kanban Board */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
              {columns.map((column) => (
                <div key={column.id} className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base sm:text-lg font-semibold text-foreground">
                      {column.title}
                    </h2>
                    <span className="pill">{getTasksByStatus(column.id).length}</span>
                  </div>

                  <div className="space-y-3 min-h-[320px] sm:min-h-[400px]">
                    {getTasksByStatus(column.id).map((task) => (
                      <Card
                        key={task.id}
                        className="group gradient-border-l hover:shadow-card transition-all duration-300 cursor-pointer bg-white/80 dark:bg-white/5 border border-white/50 dark:border-white/10 backdrop-blur-md rounded-2xl"
                      >
                        <CardContent className="p-4 sm:p-5">
                          <div className="flex items-start justify-between mb-2 sm:mb-3">
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {task.title}
                            </h3>
                            <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="action-ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTask(task);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="action-ghost text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {task.description && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {task.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between">
                            <Badge
                              variant="secondary"
                              className={`${priorityColors[task.priority]} rounded-full px-2.5 py-1`}
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
                          <div className="flex flex-wrap gap-2 mt-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {column.id !== 'todo' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveTask(task.id, 'todo')}
                                className="text-xs rounded-full"
                              >
                                To Do
                              </Button>
                            )}
                            {column.id !== 'in-progress' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveTask(task.id, 'in-progress')}
                                className="text-xs rounded-full"
                              >
                                In Progress
                              </Button>
                            )}
                            {column.id !== 'done' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveTask(task.id, 'done')}
                                className="text-xs rounded-full"
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
                      <div className="text-center py-10 sm:py-12 text-muted-foreground">
                        <div className="empty-bubble w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
                        </div>
                        <p className="text-sm sm:text-base">No tasks in {column.title.toLowerCase()}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Task Edit Dialog */}
            <TaskEditDialog
              task={selectedTask}
              open={showEditDialog}
              onOpenChange={setShowEditDialog}
              onSave={handleSaveTask}
              onDelete={handleDeleteTask}
            />

            {/* Add Task Dialog */}
            <AddTaskDialog
              open={showAddDialog}
              onOpenChange={setShowAddDialog}
              onAdd={addTaskDetailed}
            />
          </TabsContent>

          <TabsContent value="monthly">
            <MonthlyStatusSheets />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}