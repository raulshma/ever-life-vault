import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { ViewTransitionLink } from '@/components/ViewTransitionLink';
import {
  Calendar,
  BookOpen,
  Shield,
  FileText,
  Package2,
  Plus,
  Home,
  Search,
  LogOut
} from 'lucide-react';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { AddTaskDialog } from '@/components/AddTaskDialog';

const modules = [
  { name: 'Dashboard', path: '/', icon: Home },
  { name: 'Day Tracker', path: '/day-tracker', icon: Calendar },
  { name: 'Knowledge Base', path: '/knowledge', icon: BookOpen },
  { name: 'Vault', path: '/vault', icon: Shield },
  { name: 'Documents', path: '/documents', icon: FileText },
  { name: 'Inventory', path: '/inventory', icon: Package2 },
];

export const Layout: React.FC = React.memo(() => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { viewTransitionsEnabled, setViewTransitionsEnabled } = useSettings();

  // Local UI state for Search (Command Palette) and Quick Add
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = React.useState(false);

  // Quick Add handler (no-op for onAdd until wired to tasks hook/page)
  const handleQuickAdd = async (title: string, description?: string, priority?: 'low' | 'medium' | 'high', dueDate?: string) => {
    // TODO: Wire to tasks creation hook when available.
    // For now, just log and close dialog to give immediate feedback.
    console.debug('Quick Add task:', { title, description, priority, dueDate });
    return Promise.resolve();
  };

  // Global keyboard shortcut for opening search: Ctrl/Cmd + K
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-subtle safe-top safe-bottom">
      {/* Desktop Navigation */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-border shadow-card">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <ViewTransitionLink to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">LOS</span>
                </div>
                <span className="text-xl font-semibold text-foreground">Life OS</span>
              </ViewTransitionLink>
              
              <div className="flex items-center space-x-1">
                {modules.slice(1).map((module) => {
                  const Icon = module.icon;
                  return (
                    <ViewTransitionLink
                      key={module.path}
                      to={module.path}
                      className={cn(
                        "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        location.pathname === module.path
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon size={16} />
                      <span>{module.name}</span>
                    </ViewTransitionLink>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-3">
              <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)} aria-label="Open Search (Ctrl/Cmd+K)">
                <Search size={18} />
              </Button>
              <Button variant="hero" size="sm" className="hidden md:inline-flex" onClick={() => setIsQuickAddOpen(true)}>
                <Plus size={16} />
                Quick Add
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setViewTransitionsEnabled(!viewTransitionsEnabled)}
                className="text-muted-foreground hover:text-foreground hidden lg:inline-flex"
                title={`${viewTransitionsEnabled ? 'Disable' : 'Enable'} view transitions`}
              >
                {viewTransitionsEnabled ? '🔄' : '⏸️'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-4 md:pt-20 pb-24 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-border safe-bottom">
        <div className="grid grid-cols-6 py-1.5">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <ViewTransitionLink
                key={module.path}
                to={module.path}
                className={cn(
                  "flex flex-col items-center justify-center py-1.5 px-1 text-[11px] transition-colors",
                  location.pathname === module.path
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon size={18} />
                <span className="mt-1 text-[10px] font-medium leading-tight">
                  {module.name}
                </span>
              </ViewTransitionLink>
            );
          })}
        </div>
      </nav>

      {/* Mobile Floating Action Button */}
      <div className="md:hidden fixed right-4 z-40" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
        <Button variant="hero" size="icon" className="w-14 h-14 rounded-full shadow-glow" onClick={() => setIsQuickAddOpen(true)} aria-label="Quick Add">
          <Plus size={24} />
        </Button>
      </div>

      {/* Search Command Palette */}
      <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {modules.map((m) => (
              <CommandItem key={m.path} onSelect={() => { setIsSearchOpen(false); }}>
                <m.icon className="mr-2 h-4 w-4" />
                <span>{m.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Quick Add Task Dialog */}
      <AddTaskDialog
        open={isQuickAddOpen}
        onOpenChange={setIsQuickAddOpen}
        onAdd={async (...args) => {
          await handleQuickAdd(...args);
          setIsQuickAddOpen(false);
        }}
      />
    </div>
  );
});