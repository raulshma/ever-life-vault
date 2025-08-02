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

const modules = [
  {
    name: 'Day Tracker',
    description: 'Manage tasks and track daily productivity',
    path: '/day-tracker',
    icon: Calendar,
    color: 'from-blue-500 to-blue-600',
    stats: { active: 8, completed: 24 }
  },
  {
    name: 'Knowledge Base',
    description: 'Store and organize your research and notes',
    path: '/knowledge',
    icon: BookOpen,
    color: 'from-green-500 to-green-600',
    stats: { notes: 156, recent: 3 }
  },
  {
    name: 'Vault',
    description: 'Securely store credentials and sensitive data',
    path: '/vault',
    icon: Shield,
    color: 'from-red-500 to-red-600',
    stats: { credentials: 45, secure: true }
  },
  {
    name: 'Documents',
    description: 'Organize important personal documents',
    path: '/documents',
    icon: FileText,
    color: 'from-purple-500 to-purple-600',
    stats: { documents: 89, expiring: 2 }
  },
  {
    name: 'Inventory',
    description: 'Track physical items and their locations',
    path: '/inventory',
    icon: Package2,
    color: 'from-orange-500 to-orange-600',
    stats: { items: 234, locations: 12 }
  }
];

export default function ModuleGrid() {
  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold text-foreground mb-6">Your Life Modules</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link key={module.path} to={module.path}>
              <Card className="group hover:shadow-elegant transition-all duration-300 hover:scale-105 bg-gradient-card border-0">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 bg-gradient-to-r ${module.color} rounded-lg flex items-center justify-center shadow-card`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {Object.keys(module.stats)[0]}
                      </div>
                      <div className="text-lg font-semibold">
                        {Object.values(module.stats)[0]}
                      </div>
                    </div>
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {module.name}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
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