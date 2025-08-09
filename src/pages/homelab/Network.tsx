import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Network as NetworkIcon, 
  Wifi, 
  Router, 
  Shield, 
  Activity,
  Plus,
  Settings,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface NetworkDevice {
  id: string;
  name: string;
  ip: string;
  mac: string;
  type: 'router' | 'switch' | 'access-point' | 'device';
  status: 'online' | 'offline';
  bandwidth: number;
  lastSeen: string;
}

interface NetworkStats {
  totalDevices: number;
  activeDevices: number;
  totalBandwidth: number;
  usedBandwidth: number;
  uptime: string;
}

export default function Network() {
  const [devices, setDevices] = useState<NetworkDevice[]>([
    {
      id: '1',
      name: 'Main Router',
      ip: '192.168.1.1',
      mac: '00:1B:44:11:3A:B7',
      type: 'router',
      status: 'online',
      bandwidth: 1000,
      lastSeen: 'Now'
    },
    {
      id: '2',
      name: 'Switch-01',
      ip: '192.168.1.2',
      mac: '00:1B:44:11:3A:B8',
      type: 'switch',
      status: 'online',
      bandwidth: 100,
      lastSeen: 'Now'
    },
    {
      id: '3',
      name: 'WiFi AP Living Room',
      ip: '192.168.1.10',
      mac: '00:1B:44:11:3A:B9',
      type: 'access-point',
      status: 'online',
      bandwidth: 300,
      lastSeen: 'Now'
    },
    {
      id: '4',
      name: 'Desktop-PC',
      ip: '192.168.1.100',
      mac: '00:1B:44:11:3A:C0',
      type: 'device',
      status: 'online',
      bandwidth: 45,
      lastSeen: '2 min ago'
    },
    {
      id: '5',
      name: 'Laptop-Work',
      ip: '192.168.1.101',
      mac: '00:1B:44:11:3A:C1',
      type: 'device',
      status: 'offline',
      bandwidth: 0,
      lastSeen: '1 hour ago'
    }
  ]);

  const [stats] = useState<NetworkStats>({
    totalDevices: 5,
    activeDevices: 4,
    totalBandwidth: 1000,
    usedBandwidth: 445,
    uptime: '15 days, 8 hours'
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', ip: '', mac: '' });

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'router': return <Router className="w-5 h-5" />;
      case 'switch': return <NetworkIcon className="w-5 h-5" />;
      case 'access-point': return <Wifi className="w-5 h-5" />;
      case 'device': return <Activity className="w-5 h-5" />;
      default: return <NetworkIcon className="w-5 h-5" />;
    }
  };

  const getStatusVariant = (status: string) => {
    return status === 'online' ? 'success' as const : 'destructive' as const;
  };

  const getTypeVariant = (type: string) => {
    switch (type) {
      case 'router': return 'info' as const;
      case 'switch': return 'secondary' as const;
      case 'access-point': return 'warning' as const;
      case 'device': return 'secondary' as const;
      default: return 'secondary' as const;
    }
  };

  const addDevice = () => {
    if (newDevice.name && newDevice.ip && newDevice.mac) {
      const device: NetworkDevice = {
        id: Date.now().toString(),
        name: newDevice.name,
        ip: newDevice.ip,
        mac: newDevice.mac,
        type: 'device',
        status: 'offline',
        bandwidth: 0,
        lastSeen: 'Never'
      };
      setDevices([...devices, device]);
      setNewDevice({ name: '', ip: '', mac: '' });
      setShowAddForm(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Network Management</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Device
        </Button>
      </div>

      {/* Network Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <NetworkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDevices}</div>
            <div className="text-xs text-muted-foreground">
              {stats.activeDevices} active
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bandwidth Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round((stats.usedBandwidth / stats.totalBandwidth) * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {stats.usedBandwidth} / {stats.totalBandwidth} Mbps
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div 
                className="bg-[hsl(var(--info))] h-2 rounded-full" 
                style={{ width: `${(stats.usedBandwidth / stats.totalBandwidth) * 100}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Uptime</CardTitle>
            <CheckCircle className="h-4 w-4 text-[hsl(var(--success))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.9%</div>
            <div className="text-xs text-muted-foreground">
              {stats.uptime}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Status</CardTitle>
            <Shield className="h-4 w-4 text-[hsl(var(--success))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--success))]">Secure</div>
            <div className="text-xs text-muted-foreground">
              Firewall active
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Device Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Device</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Device Name"
              value={newDevice.name}
              onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
            />
            <Input
              placeholder="IP Address"
              value={newDevice.ip}
              onChange={(e) => setNewDevice({ ...newDevice, ip: e.target.value })}
            />
            <Input
              placeholder="MAC Address"
              value={newDevice.mac}
              onChange={(e) => setNewDevice({ ...newDevice, mac: e.target.value })}
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

      {/* Device List */}
      <Card>
        <CardHeader>
          <CardTitle>Network Devices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getDeviceIcon(device.type)}
                    <div>
                      <h3 className="font-medium">{device.name}</h3>
                       <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>{device.ip}</span>
                        <span>•</span>
                        <span className="font-mono text-xs">{device.mac}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {device.bandwidth > 0 ? `${device.bandwidth} Mbps` : 'Inactive'}
                    </div>
                     <div className="text-xs text-muted-foreground">
                      Last seen: {device.lastSeen}
                    </div>
                  </div>
                  
                    <div className="flex items-center space-x-2">
                      <Badge variant={getTypeVariant(device.type)}>
                        {device.type}
                      </Badge>
                      <Badge variant={getStatusVariant(device.status)}>
                        {device.status}
                      </Badge>
                    </div>
                  
                  <Button size="sm" variant="outline">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Network Topology */}
      <Card>
        <CardHeader>
          <CardTitle>Network Topology</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="flex items-center justify-center p-8 bg-muted rounded-lg">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center space-x-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-[hsl(var(--info))] rounded-full flex items-center justify-center text-primary-foreground mb-2">
                    <Router className="w-8 h-8" />
                  </div>
                  <span className="text-sm">Router</span>
                </div>
                
                 <div className="w-16 h-0.5 bg-border"></div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center text-secondary-foreground mb-2">
                    <NetworkIcon className="w-8 h-8" />
                  </div>
                  <span className="text-sm">Switch</span>
                </div>
                
                 <div className="w-16 h-0.5 bg-border"></div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-[hsl(var(--warning))] rounded-full flex items-center justify-center text-[hsl(var(--warning-foreground))] mb-2">
                    <Wifi className="w-8 h-8" />
                  </div>
                  <span className="text-sm">Access Point</span>
                </div>
              </div>
              
               <div className="text-sm text-muted-foreground">
                Simplified network topology view
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}