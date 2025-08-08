import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, BookOpen, Plus } from 'lucide-react';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { useTasks } from '@/hooks/useTasks';

export default function HeroSection() {
  const navigate = useNavigate();
  const { addTask } = useTasks();
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const quickActions = [
    { 
      icon: Calendar, 
      label: 'Add Task', 
      action: () => setAddTaskOpen(true), 
      variant: 'default' as const 
    },
    { 
      icon: BookOpen, 
      label: 'New Note', 
      action: () => navigate('/knowledge'), 
      variant: 'accent' as const 
    },
    { 
      icon: Plus, 
      label: 'Quick Capture', 
      action: () => navigate('/day-tracker'), 
      variant: 'hero' as const 
    },
  ];
  return (
  <div className="relative overflow-hidden bg-gradient-hero text-white">
      <div className="absolute inset-0 bg-black/10"></div>
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        <div className="text-center">
      <h1 className="font-bold mb-4 text-[clamp(1.75rem,4vw,2.5rem)] leading-tight">
            Life OS
          </h1>
      <p className="mb-4 text-white/90 max-w-2xl md:max-w-3xl mx-auto text-[clamp(0.95rem,2vw,1.25rem)] leading-relaxed px-1">
            Organize your digital and physical life with speed, security, and simplicity
          </p>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center w-full max-w-xl mx-auto">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant={action.variant}
          size="lg"
          onClick={action.action}
          className="shadow-glow w-full sm:w-auto"
                >
                  <Icon size={20} />
                  {action.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <AddTaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        onAdd={async (title, description, priority, dueDate) => {
          await addTask(title, description, priority || 'medium', dueDate);
          setAddTaskOpen(false);
        }}
      />
    </div>
  );
}