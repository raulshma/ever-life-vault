import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Network, 
  Thermometer,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

interface SystemMetrics {
  cpu: {
    usage: number;
    temperature: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  storage: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    upload: number;
    download: number;
  };
  uptime: string;
  alerts: Alert[];
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
}

export default function Monitoring() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: {
      usage: 45,
      temperature: 62,
      cores: 8
    },
    memory: {
      used: 12.4,
      total: 32,
      percentage: 39
    },
    storage: {
      used: 850,
      total: 2000,
      percentage: 43
    },
    network: {
      upload: 2.4,
      download: 15.8
    },
    uptime: '7 days, 14 hours',
    alerts: [
      {
        id: '1',
        type: 'warning',
        message: 'High CPU temperature detected on Server-01',
        timestamp: '2 minutes ago'
      },
      {
        id: '2',
        type: 'info',
        message: 'Backup completed successfully',
        timestamp: '1 hour ago'
      }
    ]
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshMetrics = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update with random values for demo
    setMetrics(prev => ({
      ...prev,
      cpu: {
        ...prev.cpu,
        usage: Math.floor(Math.random() * 100),
        temperature: Math.floor(Math.random() * 30) + 50
      },
      memory: {
        ...prev.memory,
        percentage: Math.floor(Math.random() * 100)
      },
      network: {
        upload: Math.random() * 10,
        download: Math.random() * 50
      }
    }));
    
    setIsRefreshing(false);
  };

  useEffect(() => {
    const interval = setInterval(refreshMetrics, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default: return <CheckCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getAlertBadgeColor = (type: string) => {
    switch (type) {
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">System Monitoring</h1>
        <Button onClick={refreshMetrics} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.cpu.usage}%</div>
            <div className="text-xs text-muted-foreground">
              {metrics.cpu.cores} cores
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${metrics.cpu.usage}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.memory.percentage}%</div>
            <div className="text-xs text-muted-foreground">
              {metrics.memory.used}GB / {metrics.memory.total}GB
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${metrics.memory.percentage}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.storage.percentage}%</div>
            <div className="text-xs text-muted-foreground">
              {metrics.storage.used}GB / {metrics.storage.total}GB
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-purple-600 h-2 rounded-full" 
                style={{ width: `${metrics.storage.percentage}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temperature</CardTitle>
            <Thermometer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.cpu.temperature}°C</div>
            <div className="text-xs text-muted-foreground">
              CPU Temperature
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className={`h-2 rounded-full ${
                  metrics.cpu.temperature > 70 ? 'bg-red-600' : 
                  metrics.cpu.temperature > 60 ? 'bg-yellow-600' : 'bg-green-600'
                }`}
                style={{ width: `${(metrics.cpu.temperature / 100) * 100}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network and System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Network className="w-5 h-5 mr-2" />
              Network Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Upload</span>
              <span className="font-mono">{metrics.network.upload.toFixed(1)} MB/s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Download</span>
              <span className="font-mono">{metrics.network.download.toFixed(1)} MB/s</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm">System Uptime</span>
                <span className="font-mono">{metrics.uptime}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.alerts.map((alert) => (
                <div key={alert.id} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <Badge className={`${getAlertBadgeColor(alert.type)} text-white text-xs`}>
                        {alert.type}
                      </Badge>
                      <span className="text-xs text-gray-500">{alert.timestamp}</span>
                    </div>
                    <p className="text-sm mt-1">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}