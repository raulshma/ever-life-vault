import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Calendar,
  Clock,
  Flag,
  CheckCircle2,
  Edit,
  Trash2,
  Grid,
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton'
import { useTasks } from '@/hooks/useTasks';
import { TaskEditDialog } from '@/components/TaskEditDialog';
import { AddTaskDialog } from '@/components/AddTaskDialog';
const MonthlyStatusSheets = React.lazy(() => import('@/components/MonthlyStatusSheets').then(m => ({ default: m.MonthlyStatusSheets })));
import PageHeader from '@/components/PageHeader';

const columns = [
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' }
] as const;

const priorityVariantMap: Record<'low' | 'medium' | 'high', 'success' | 'warning' | 'destructive'> = {
  low: 'success',
  medium: 'warning',
  high: 'destructive',
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
  const { tasks, loading, addTask: addTaskHook, updateTask, deleteTask, refetch } = useTasks();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Redesign state additions
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [showDone, setShowDone] = useState(true);
  const [sortBy, setSortBy] = useState<'created' | 'priority' | 'due' | 'title'>('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [dragOverColumn, setDragOverColumn] = useState<null | Task['status']>(null);

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

  const filteredTasks = useMemo(() => {
    const lowered = search.trim().toLowerCase();
    const priorityRanks: Record<Task['priority'], number> = { high: 3, medium: 2, low: 1 };
    return tasks
      .filter(t => (showDone ? true : t.status !== 'done'))
      .filter(t => (priorityFilter === 'all' ? true : t.priority === priorityFilter))
      .filter(t => (!lowered ? true : (t.title + (t.description || '')).toLowerCase().includes(lowered)))
      .sort((a, b) => {
        switch (sortBy) {
          case 'priority':
            return (priorityRanks[b.priority] - priorityRanks[a.priority]) * (sortDir === 'asc' ? -1 : 1);
          case 'due':
            return ((a.due_date ? new Date(a.due_date).getTime() : Infinity) - (b.due_date ? new Date(b.due_date).getTime() : Infinity)) * (sortDir === 'asc' ? 1 : -1);
          case 'title':
            return a.title.localeCompare(b.title) * (sortDir === 'asc' ? 1 : -1);
          case 'created':
          default:
            return (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) * (sortDir === 'asc' ? -1 : 1);
        }
      });
  }, [tasks, search, priorityFilter, showDone, sortBy, sortDir]);

  const getTasksByStatus = useCallback((status: Task['status']) => filteredTasks.filter(task => task.status === status), [filteredTasks]);

  const total = filteredTasks.length;
  const doneCount = filteredTasks.filter(t => t.status === 'done').length;
  const progressPct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/task-id', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDrop = async (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/task-id');
    if (id) await moveTask(id, status);
    setDragOverColumn(null);
  };

  const clearFilters = () => {
    setSearch('');
    setPriorityFilter('all');
    setShowDone(true);
    setSortBy('created');
    setSortDir('desc');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle pb-0">
        <PageHeader
          title="Day Tracker"
          description="Manage your tasks and track daily productivity"
          icon={Calendar}
        />
        <div className="pt-4 pb-0 container">
          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            <div className="md:col-span-2 bg-card/60 dark:bg-card/20 border border-border rounded-2xl p-6">
              <Skeleton className="h-5 w-32 mb-4" />
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-24 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-gradient-card rounded-2xl p-6">
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-2 w-full mb-2" />
              <div className="flex justify-between text-xs">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-8" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 mt-6">
            {['To Do','In Progress','Done'].map((title, idx) => (
              <div key={idx} className="space-y-3 rounded-2xl p-1">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-10" />
                </div>
                <div className="space-y-3 min-h-[320px] sm:min-h-[400px]">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="gradient-border-l bg-card/80 border rounded-2xl p-4">
                      <Skeleton className="h-4 w-1/2 mb-2" />
                      <Skeleton className="h-3 w-1/4 mb-2" />
                      <div className="flex justify-between">
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <div className="flex gap-2">
                          <Skeleton className="h-8 w-8 rounded-md" />
                          <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle pb-0">
      <PageHeader
        title="Day Tracker"
        description="Manage your tasks and track daily productivity"
        icon={Calendar}
        meta={
          <div className="rounded-md px-2 py-0.5 text-xs bg-muted text-muted-foreground">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        }
      />

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
            {/* Summary & Controls */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
              <Card className="bg-card/60 dark:bg-card/20 backdrop-blur-md border border-border shadow-sm md:col-span-2 rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium tracking-wide flex items-center gap-2">
                    <Search className="w-4 h-4" /> Task Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col lg:flex-row gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search tasks..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-8 rounded-xl"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant={priorityFilter === 'all' ? 'default' : 'outline'} size="sm" className="rounded-full" onClick={() => setPriorityFilter('all')}>All</Button>
                        <Button variant={priorityFilter === 'high' ? 'default' : 'outline'} size="sm" className="rounded-full" onClick={() => setPriorityFilter('high')}>High</Button>
                        <Button variant={priorityFilter === 'medium' ? 'default' : 'outline'} size="sm" className="rounded-full" onClick={() => setPriorityFilter('medium')}>Med</Button>
                        <Button variant={priorityFilter === 'low' ? 'default' : 'outline'} size="sm" className="rounded-full" onClick={() => setPriorityFilter('low')}>Low</Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => setShowDone(d => !d)}>
                      <Filter className="w-3.5 h-3.5 mr-1" /> {showDone ? 'Hide Done' : 'Show Done'}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => toggleSort('priority')}>
                      <ArrowUpDown className="w-3.5 h-3.5 mr-1" /> Priority {sortBy === 'priority' && (sortDir === 'asc' ? '↑' : '↓')}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => toggleSort('due')}>
                      <ArrowUpDown className="w-3.5 h-3.5 mr-1" /> Due {sortBy === 'due' && (sortDir === 'asc' ? '↑' : '↓')}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => toggleSort('title')}>
                      <ArrowUpDown className="w-3.5 h-3.5 mr-1" /> Title {sortBy === 'title' && (sortDir === 'asc' ? '↑' : '↓')}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => toggleSort('created')}>
                      <ArrowUpDown className="w-3.5 h-3.5 mr-1" /> Created {sortBy === 'created' && (sortDir === 'asc' ? '↑' : '↓')}
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={clearFilters}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-card shadow-card border-0 rounded-2xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium tracking-wide">Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span>{doneCount} / {total} Done</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span>High: {filteredTasks.filter(t=>t.priority==='high').length}</span>
                    <span>Med: {filteredTasks.filter(t=>t.priority==='medium').length}</span>
                    <span>Low: {filteredTasks.filter(t=>t.priority==='low').length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
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
                <div
                  key={column.id}
                  className={
                    `space-y-3 sm:space-y-4 rounded-2xl p-1 transition-colors` +
                    (dragOverColumn === column.id ? ' bg-primary/10 ring-2 ring-primary/40' : '')
                  }
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDrop={(e) => handleDrop(e, column.id)}
                >
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
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="group gradient-border-l hover:shadow-card transition-all duration-300 cursor-grab active:cursor-grabbing bg-card/80 dark:bg-card/20 border border-border backdrop-blur-md rounded-2xl"
                      >
                        <CardContent className="p-4 sm:p-5 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2">
                              <Checkbox
                                checked={task.status === 'done'}
                                onCheckedChange={(val) => moveTask(task.id, val ? 'done' : 'todo')}
                                className="mt-1"
                                aria-label={task.status === 'done' ? 'Mark as not done' : 'Mark as done'}
                              />
                              <div>
                                <h3
                                  className={
                                    `font-semibold text-foreground group-hover:text-primary transition-colors ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`
                                  }
                                >
                                  {task.title}
                                </h3>
                                {task.description && (
                                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-3">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                          <div className="flex items-center justify-between text-[11px] sm:text-xs">
                            <Badge
                              variant={priorityVariantMap[task.priority]}
                              className="rounded-full px-2.5 py-1"
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
                          <div className="flex flex-wrap gap-2 pt-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {columns.filter(c => c.id !== task.status).map(c => (
                              <Button
                                key={c.id}
                                variant="ghost"
                                size="sm"
                                onClick={() => moveTask(task.id, c.id as Task['status'])}
                                className="text-xs rounded-full"
                              >
                                {c.title}
                              </Button>
                            ))}
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
            <React.Suspense fallback={<div className="p-6"><div className="space-y-2"><div className="h-5 w-32 bg-muted rounded" /><div className="grid grid-cols-4 gap-1">{Array.from({length:8}).map((_,i)=>(<div key={i} className="h-6 bg-muted rounded" />))}</div></div></div>}>
              <MonthlyStatusSheets />
            </React.Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}