import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Calendar, 
  BookOpen, 
  Shield, 
  FileText, 
  Package2
} from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { useCredentials } from '@/hooks/useCredentials';
import { useDocuments } from '@/hooks/useDocuments';
import { useInventory } from '@/hooks/useInventory';

export default function ModuleGrid() {
  const { tasks } = useTasks();
  const { notes } = useNotes();
  const { credentials } = useCredentials();
  const { documents, getExpiringDocuments } = useDocuments();
  const { items, locations } = useInventory();

  const activeTasks = tasks.filter(task => task.status !== 'done').length;
  const completedTasks = tasks.filter(task => task.status === 'done').length;
  const expiringDocs = getExpiringDocuments().length;

  const modules = [
    {
      name: 'Day Tracker',
      description: 'Manage tasks and track daily productivity',
      path: '/day-tracker',
      icon: Calendar,
      color: 'from-blue-500 to-blue-600',
      stats: { active: activeTasks, completed: completedTasks }
    },
    {
      name: 'Knowledge Base',
      description: 'Store and organize your research and notes',
      path: '/knowledge',
      icon: BookOpen,
      color: 'from-green-500 to-green-600',
      stats: { notes: notes.length, favorites: notes.filter(n => n.is_favorite).length }
    },
    {
      name: 'Vault',
      description: 'Securely store credentials and sensitive data',
      path: '/vault',
      icon: Shield,
      color: 'from-red-500 to-red-600',
      stats: { credentials: credentials.length, secure: true }
    },
    {
      name: 'Documents',
      description: 'Organize important personal documents',
      path: '/documents',
      icon: FileText,
      color: 'from-purple-500 to-purple-600',
      stats: { documents: documents.length, expiring: expiringDocs }
    },
    {
      name: 'Inventory',
      description: 'Track physical items and their locations',
      path: '/inventory',
      icon: Package2,
      color: 'from-orange-500 to-orange-600',
      stats: { items: items.length, locations: locations.length }
    }
  ];

  return (
    <div className="mb-8 sm:mb-12">
      <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Your Life Modules</h2>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link key={module.path} to={module.path}>
              <Card className="group hover:shadow-elegant transition-all duration-300 hover:scale-[1.02] sm:hover:scale-105 bg-gradient-card border-0">
                <CardHeader className="pb-3 sm:pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r ${module.color} rounded-lg flex items-center justify-center shadow-card`}>
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {Object.keys(module.stats)[0]}
                      </div>
                      <div className="text-base sm:text-lg font-semibold">
                        {Object.values(module.stats)[0]}
                      </div>
                    </div>
                  </div>
                  <CardTitle className="text-lg sm:text-xl group-hover:text-primary transition-colors">
                    {module.name}
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    {module.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}