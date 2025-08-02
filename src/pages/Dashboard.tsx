import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Calendar, 
  BookOpen, 
  Shield, 
  FileText, 
  Package2,
  Plus,
  CheckCircle,
  Clock,
  Star,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';

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

const quickActions = [
  { icon: Calendar, label: 'Add Task', action: () => {}, variant: 'default' as const },
  { icon: BookOpen, label: 'New Note', action: () => {}, variant: 'accent' as const },
  { icon: Plus, label: 'Quick Capture', action: () => {}, variant: 'hero' as const },
];

const recentActivity = [
  { type: 'task', title: 'Review quarterly goals', time: '2 hours ago', icon: CheckCircle },
  { type: 'note', title: 'Meeting notes - Project Alpha', time: '4 hours ago', icon: BookOpen },
  { type: 'document', title: 'Uploaded insurance policy', time: '1 day ago', icon: FileText },
  { type: 'inventory', title: 'Added camping gear to garage', time: '2 days ago', icon: Package2 },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-subtle pb-20 md:pb-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-hero text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Life OS
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-3xl mx-auto">
              Organize your digital and physical life with speed, security, and simplicity
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={index}
                    variant={action.variant}
                    size="xl"
                    onClick={action.action}
                    className="shadow-glow"
                  >
                    <Icon size={20} />
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-foreground">32</div>
              <div className="text-sm text-muted-foreground">Tasks Done</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
                <BookOpen className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-foreground">156</div>
              <div className="text-sm text-muted-foreground">Notes</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-foreground">89</div>
              <div className="text-sm text-muted-foreground">Documents</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-lg mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <div className="text-2xl font-bold text-foreground">98%</div>
              <div className="text-sm text-muted-foreground">Organized</div>
            </CardContent>
          </Card>
        </div>

        {/* Modules Grid */}
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

        {/* Recent Activity */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">Recent Activity</h2>
          <Card className="bg-gradient-card shadow-card">
            <CardContent className="p-6">
              <div className="space-y-4">
                {recentActivity.map((activity, index) => {
                  const Icon = activity.icon;
                  return (
                    <div key={index} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{activity.title}</div>
                        <div className="text-sm text-muted-foreground">{activity.time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}