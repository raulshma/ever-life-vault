import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
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

const modules = [
  { name: 'Dashboard', path: '/', icon: Home },
  { name: 'Day Tracker', path: '/day-tracker', icon: Calendar },
  { name: 'Knowledge Base', path: '/knowledge', icon: BookOpen },
  { name: 'Vault', path: '/vault', icon: Shield },
  { name: 'Documents', path: '/documents', icon: FileText },
  { name: 'Inventory', path: '/inventory', icon: Package2 },
];

export const Layout: React.FC = () => {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Desktop Navigation */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-border shadow-card">
        <div className="w-full max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">LOS</span>
                </div>
                <span className="text-xl font-semibold text-foreground">Life OS</span>
              </Link>
              
              <div className="flex items-center space-x-1">
                {modules.slice(1).map((module) => {
                  const Icon = module.icon;
                  return (
                    <Link
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
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="icon">
                <Search size={18} />
              </Button>
              <Button variant="hero" size="sm">
                <Plus size={16} />
                Quick Add
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => signOut()}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="md:pt-20">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-border">
        <div className="grid grid-cols-6 py-2">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.path}
                to={module.path}
                className={cn(
                  "flex flex-col items-center justify-center py-2 px-1 text-xs transition-colors",
                  location.pathname === module.path
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon size={20} />
                <span className="mt-1 text-[10px] font-medium leading-tight">
                  {module.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Floating Action Button */}
      <div className="md:hidden fixed bottom-20 right-4 z-40">
        <Button variant="hero" size="icon" className="w-14 h-14 rounded-full shadow-glow">
          <Plus size={24} />
        </Button>
      </div>
    </div>
  );
};