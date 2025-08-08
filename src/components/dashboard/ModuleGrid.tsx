import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Calendar,
  BookOpen,
  Shield,
  FileText,
  Package2,
  Server,
  Monitor,
  Network,
  Database,
  Play,
  Film,
} from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useNotes } from '@/hooks/useNotes';
import { useDocuments } from '@/hooks/useDocuments';
import { useInventory } from '@/hooks/useInventory';

export default function ModuleGrid() {
  const { tasks } = useTasks();
  const { notes } = useNotes();
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
      color: 'from-teal-400 to-teal-500',
      stats: { active: activeTasks, completed: completedTasks }
    },
    {
      name: 'Knowledge Base',
      description: 'Store and organize your research and notes',
      path: '/knowledge',
      icon: BookOpen,
      color: 'from-emerald-400 to-emerald-500',
      stats: { notes: notes.length, favorites: notes.filter(n => n.is_favorite).length }
    },
    {
      name: 'Vault',
      description: 'Securely store credentials and sensitive data',
      path: '/vault',
      icon: Shield,
      color: 'from-cyan-500 to-cyan-600',
      stats: { encrypted: 'Yes', secure: true }
    },
    {
      name: 'Documents',
      description: 'Organize important personal documents',
      path: '/documents',
      icon: FileText,
      color: 'from-sky-400 to-sky-500',
      stats: { documents: documents.length, expiring: expiringDocs }
    },
    {
      name: 'Inventory',
      description: 'Track physical items and their locations',
      path: '/inventory',
      icon: Package2,
      color: 'from-lime-400 to-lime-500',
      stats: { items: items.length, locations: locations.length }
    },
    // Homelab modules
    {
      name: 'Servers',
      description: 'Manage and monitor your home servers',
      path: '/homelab/servers',
      icon: Server,
      color: 'from-indigo-400 to-indigo-500',
      stats: { category: 'Homelab' }
    },
    {
      name: 'Monitoring',
      description: 'System health, metrics, and alerts',
      path: '/homelab/monitoring',
      icon: Monitor,
      color: 'from-purple-400 to-purple-500',
      stats: { category: 'Homelab' }
    },
    {
      name: 'Network',
      description: 'Devices, bandwidth and security status',
      path: '/homelab/network',
      icon: Network,
      color: 'from-orange-400 to-orange-500',
      stats: { category: 'Homelab' }
    },
    {
      name: 'Storage',
      description: 'Disks, arrays, backups and capacity',
      path: '/homelab/storage',
      icon: Database,
      color: 'from-rose-400 to-rose-500',
      stats: { category: 'Homelab' }
    },
    {
      name: 'Jellyfin',
      description: 'Media server sessions, users and stats',
      path: '/homelab/jellyfin',
      icon: Play,
      color: 'from-violet-400 to-violet-500',
      stats: { category: 'Homelab' }
    },
    {
      name: 'Media Requests',
      description: 'Request and manage movies and TV shows',
      path: '/homelab/media-requests',
      icon: Film,
      color: 'from-fuchsia-400 to-fuchsia-500',
      stats: { category: 'Homelab' }
    }
  ];

  return (
    <div className="mb-10 sm:mb-14">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Your Life Modules</h2>
        <span className="hidden sm:inline text-xs pill">Tap a module to jump in</span>
      </div>
      <div className="grid gap-4 sm:gap-6 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link key={module.path} to={module.path}>
              <Card className="tilt shine-card bg-gradient-card border-0 hover-lift group">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r ${module.color} rounded-xl flex items-center justify-center shadow-card`}>
                      <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
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