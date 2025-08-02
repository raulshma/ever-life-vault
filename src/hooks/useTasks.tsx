import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

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

type DatabaseTask = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  user_id: string;
};

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTasks = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const transformedTasks: Task[] = (data || []).map((task: DatabaseTask) => ({
        ...task,
        description: task.description || undefined,
        priority: task.priority as 'low' | 'medium' | 'high',
        status: task.status as 'todo' | 'in-progress' | 'done',
        due_date: task.due_date || undefined,
      }));
      
      setTasks(transformedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (title: string, description?: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title,
          description,
          priority,
          status: 'todo',
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      
      const transformedTask: Task = {
        ...data,
        description: data.description || undefined,
        priority: data.priority as 'low' | 'medium' | 'high',
        status: data.status as 'todo' | 'in-progress' | 'done',
        due_date: data.due_date || undefined,
      };
      
      setTasks(prev => [transformedTask, ...prev]);
      
      toast({
        title: "Success",
        description: "Task added successfully",
      });
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to add task",
        variant: "destructive",
      });
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      const transformedTask: Task = {
        ...data,
        description: data.description || undefined,
        priority: data.priority as 'low' | 'medium' | 'high',
        status: data.status as 'todo' | 'in-progress' | 'done',
        due_date: data.due_date || undefined,
      };
      
      setTasks(prev => prev.map(task => task.id === id ? transformedTask : task));
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTasks(prev => prev.filter(task => task.id !== id));
      
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    refetch: fetchTasks
  };
}