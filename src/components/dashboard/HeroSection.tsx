import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, BookOpen, Plus, Shield, Sparkles } from 'lucide-react';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { useTasks } from '@/hooks/useTasks';

export default function HeroSection() {
  const navigate = useNavigate();
  const { addTask } = useTasks();
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const handleOpenSearch = () => {
    // Trigger the global Cmd/Ctrl+K listener defined in Layout
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    );
  };

  const quickActions = [
    {
      icon: Calendar,
      label: 'Add Task',
      action: () => setAddTaskOpen(true),
      variant: 'default' as const,
    },
    {
      icon: BookOpen,
      label: 'New Note',
      action: () => navigate('/knowledge'),
      variant: 'accent' as const,
    },
    {
      icon: Plus,
      label: 'Quick Capture',
      action: () => navigate('/day-tracker'),
      variant: 'hero' as const,
    },
  ];

  return (
    <section className="relative aurora overflow-hidden">
      {/* Aurora blobs */}
      <div className="aurora-blob aurora-blob--primary float-med w-[36rem] h-[36rem] -top-24 -left-24" />
      <div className="aurora-blob aurora-blob--accent float-slow w-[26rem] h-[26rem] -bottom-24 -right-16" />
      <div className="aurora-blob aurora-blob--violet float-fast w-[20rem] h-[20rem] top-16 right-1/3" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12 sm:pt-14 sm:pb-16">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 pill shadow-card gradient-sheen">
            <Sparkles className="h-4 w-4 text-primary" />
            Life OS
          </span>
          <h1 className="mt-4 font-extrabold tracking-tight leading-tight text-balance text-[clamp(2rem,4.5vw,3rem)] bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary">
            Your second brain for the real world
          </h1>
          <p className="mt-3 sm:mt-4 text-muted-foreground max-w-2xl md:max-w-3xl mx-auto text-[clamp(0.95rem,1.8vw,1.15rem)] leading-relaxed">
            Capture, organize, and secure everything that matters — tasks, notes, documents, and your vault — all in one elegant workspace.
          </p>

          {/* Search / Quick actions */}
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center w-full max-w-2xl mx-auto">
            <button
              onClick={handleOpenSearch}
              className="group glass hover:shadow-elegant hover-lift rounded-xl px-4 py-3 sm:px-5 sm:py-3.5 text-left flex items-center gap-3"
            >
              <span className="i-lucide-search h-5 w-5 text-muted-foreground" aria-hidden />
              <span className="flex-1 text-sm sm:text-base text-muted-foreground">
                Search anything
                <span className="ml-2 hidden sm:inline text-xs text-muted-foreground/70">Ctrl/⌘ + K</span>
              </span>
            </button>
            <div className="flex gap-2 sm:gap-3">
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
                    <Icon size={18} />
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Feature hints */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto">
            {[
              { icon: Shield, title: 'Encrypted Vault', desc: 'Zero-knowledge local encryption' },
              { icon: BookOpen, title: 'Knowledge Base', desc: 'Powerful notes with structure' },
              { icon: Calendar, title: 'Day Tracker', desc: 'Fast capture, focused execution' },
            ].map((f, idx) => (
              <div key={idx} className="glass rounded-xl p-3 sm:p-4 text-left shine-card">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center shadow-card">
                    <f.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{f.title}</div>
                    <div className="text-[12px] text-muted-foreground">{f.desc}</div>
                  </div>
                </div>
              </div>
            ))}
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
    </section>
  );
}