import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  HardDrive, 
  Database, 
  Archive, 
  Plus,
  Settings,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Download,
  Upload
} from 'lucide-react';

interface StorageDevice {
  id: string;
  name: string;
  type: 'ssd' | 'hdd' | 'nvme' | 'raid';
  capacity: number;
  used: number;
  available: number;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  temperature: number;
  mountPoint: string;
  filesystem: string;
}

interface BackupJob {
  id: string;
  name: string;
  source: string;
  destination: string;
  status: 'running' | 'completed' | 'failed' | 'scheduled';
  lastRun: string;
  nextRun: string;
  size: number;
}

export default function Storage() {
  const [storageDevices, setStorageDevices] = useState<StorageDevice[]>([
    {
      id: '1',
      name: 'System SSD',
      type: 'ssd',
      capacity: 500,
      used: 320,
      available: 180,
      status: 'healthy',
      temperature: 42,
      mountPoint: '/',
      filesystem: 'ext4'
    },
    {
      id: '2',
      name: 'Data HDD 1',
      type: 'hdd',
      capacity: 2000,
      used: 1200,
      available: 800,
      status: 'healthy',
      temperature: 38,
      mountPoint: '/data',
      filesystem: 'ext4'
    },
    {
      id: '3',
      name: 'Data HDD 2',
      type: 'hdd',
      capacity: 2000,
      used: 1800,
      available: 200,
      status: 'warning',
      temperature: 45,
      mountPoint: '/backup',
      filesystem: 'ext4'
    },
    {
      id: '4',
      name: 'RAID Array',
      type: 'raid',
      capacity: 8000,
      used: 4500,
      available: 3500,
      status: 'healthy',
      temperature: 40,
      mountPoint: '/storage',
      filesystem: 'zfs'
    }
  ]);

  const [backupJobs, setBackupJobs] = useState<BackupJob[]>([
    {
      id: '1',
      name: 'Daily System Backup',
      source: '/home',
      destination: '/backup/daily',
      status: 'completed',
      lastRun: '2 hours ago',
      nextRun: 'Tomorrow 2:00 AM',
      size: 45.2
    },
    {
      id: '2',
      name: 'Weekly Full Backup',
      source: '/data',
      destination: 'remote://backup-server',
      status: 'running',
      lastRun: 'Running now',
      nextRun: 'Next Sunday',
      size: 1200.5
    },
    {
      id: '3',
      name: 'Config Backup',
      source: '/etc',
      destination: '/backup/config',
      status: 'failed',
      lastRun: '1 day ago',
      nextRun: 'Today 6:00 PM',
      size: 2.1
    }
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', capacity: '', mountPoint: '' });

  const getStorageIcon = (type: string) => {
    switch (type) {
      case 'ssd':
      case 'nvme': return <HardDrive className="w-5 h-5" />;
      case 'hdd': return <Database className="w-5 h-5" />;
      case 'raid': return <Archive className="w-5 h-5" />;
      default: return <HardDrive className="w-5 h-5" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'healthy': return 'success' as const;
      case 'warning': return 'warning' as const;
      case 'critical': return 'destructive' as const;
      case 'offline': return 'secondary' as const;
      default: return 'secondary' as const;
    }
  };

  const getBackupStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success' as const;
      case 'running': return 'info' as const;
      case 'failed': return 'destructive' as const;
      case 'scheduled': return 'secondary' as const;
      default: return 'secondary' as const;
    }
  };

  const getBackupStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Download className="w-4 h-4 animate-pulse" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      case 'scheduled': return <Upload className="w-4 h-4" />;
      default: return <Upload className="w-4 h-4" />;
    }
  };

  const addDevice = () => {
    if (newDevice.name && newDevice.capacity && newDevice.mountPoint) {
      const device: StorageDevice = {
        id: Date.now().toString(),
        name: newDevice.name,
        type: 'hdd',
        capacity: parseInt(newDevice.capacity),
        used: 0,
        available: parseInt(newDevice.capacity),
        status: 'offline',
        temperature: 0,
        mountPoint: newDevice.mountPoint,
        filesystem: 'ext4'
      };
      setStorageDevices([...storageDevices, device]);
      setNewDevice({ name: '', capacity: '', mountPoint: '' });
      setShowAddForm(false);
    }
  };

  const totalCapacity = storageDevices.reduce((sum, device) => sum + device.capacity, 0);
  const totalUsed = storageDevices.reduce((sum, device) => sum + device.used, 0);
  const totalAvailable = storageDevices.reduce((sum, device) => sum + device.available, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Storage Management</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Storage
        </Button>
      </div>

      {/* Storage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(totalCapacity / 1000).toFixed(1)} TB</div>
            <div className="text-xs text-muted-foreground">
              {storageDevices.length} devices
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Used Space</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(totalUsed / 1000).toFixed(1)} TB</div>
            <div className="text-xs text-muted-foreground">
              {Math.round((totalUsed / totalCapacity) * 100)}% utilized
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div 
                className="bg-[hsl(var(--info))] h-2 rounded-full" 
                style={{ width: `${(totalUsed / totalCapacity) * 100}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Space</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(totalAvailable / 1000).toFixed(1)} TB</div>
            <div className="text-xs text-muted-foreground">
              Free space remaining
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Storage Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Storage Device</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Device Name"
              value={newDevice.name}
              onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
            />
            <Input
              placeholder="Capacity (GB)"
              type="number"
              value={newDevice.capacity}
              onChange={(e) => setNewDevice({ ...newDevice, capacity: e.target.value })}
            />
            <Input
              placeholder="Mount Point (e.g., /mnt/storage)"
              value={newDevice.mountPoint}
              onChange={(e) => setNewDevice({ ...newDevice, mountPoint: e.target.value })}
            />
            <div className="flex gap-2">
              <Button onClick={addDevice}>Add Device</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Storage Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {storageDevices.map((device) => (
          <Card key={device.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                {getStorageIcon(device.type)}
                <span className="ml-2">{device.name}</span>
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant={getStatusVariant(device.status)}>
                  {device.status}
                </Badge>
                <Badge variant="outline">
                  {device.type.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Capacity:</span>
                  <div className="font-mono">{device.capacity} GB</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Temperature:</span>
                  <div className="font-mono">{device.temperature}°C</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Mount Point:</span>
                  <div className="font-mono">{device.mountPoint}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Filesystem:</span>
                  <div className="font-mono">{device.filesystem}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Used: {device.used} GB</span>
                  <span>Available: {device.available} GB</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${
                      (device.used / device.capacity) > 0.9 ? 'bg-[hsl(var(--destructive))]' :
                      (device.used / device.capacity) > 0.8 ? 'bg-[hsl(var(--warning))]' : 'bg-[hsl(var(--success))]'
                    }`}
                    style={{ width: `${(device.used / device.capacity) * 100}%` }}
                  ></div>
                </div>
                   <div className="text-center text-sm text-muted-foreground">
                  {Math.round((device.used / device.capacity) * 100)}% used
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline">
                  <Settings className="w-4 h-4 mr-1" />
                  Configure
                </Button>
                <Button size="sm" variant="outline">
                  <Trash2 className="w-4 h-4 mr-1" />
                  Format
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Backup Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Backup Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {backupJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getBackupStatusIcon(job.status)}
                    <div>
                      <h3 className="font-medium">{job.name}</h3>
                      <div className="text-sm text-muted-foreground">
                        {job.source} → {job.destination}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right text-sm">
                    <div>Size: {job.size} GB</div>
                    <div className="text-muted-foreground">Last: {job.lastRun}</div>
                    <div className="text-muted-foreground">Next: {job.nextRun}</div>
                  </div>
                  
                   <Badge variant={getBackupStatusVariant(job.status)}>
                    {job.status}
                  </Badge>
                  
                  <Button size="sm" variant="outline">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}