import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Server, Power, PowerOff, Settings } from "lucide-react";

interface ServerData {
  id: string;
  name: string;
  ip: string;
  status: "online" | "offline" | "maintenance";
  cpu: number;
  memory: number;
  storage: number;
}

export default function Servers() {
  const [servers, setServers] = useState<ServerData[]>([
    {
      id: "1",
      name: "Main Server",
      ip: "192.168.1.100",
      status: "online",
      cpu: 45,
      memory: 68,
      storage: 72,
    },
    {
      id: "2",
      name: "Backup Server",
      ip: "192.168.1.101",
      status: "offline",
      cpu: 0,
      memory: 0,
      storage: 45,
    },
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newServer, setNewServer] = useState({ name: "", ip: "" });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "online":
        return "success" as const;
      case "offline":
        return "destructive" as const;
      case "maintenance":
        return "warning" as const;
      default:
        return "secondary" as const;
    }
  };

  const toggleServerStatus = (id: string) => {
    setServers(
      servers.map((server) =>
        server.id === id
          ? {
              ...server,
              status: server.status === "online" ? "offline" : "online",
            }
          : server
      )
    );
  };

  const addServer = () => {
    if (newServer.name && newServer.ip) {
      const server: ServerData = {
        id: Date.now().toString(),
        name: newServer.name,
        ip: newServer.ip,
        status: "offline",
        cpu: 0,
        memory: 0,
        storage: 0,
      };
      setServers([...servers, server]);
      setNewServer({ name: "", ip: "" });
      setShowAddForm(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Server Management</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Server
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Server</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Server Name"
              value={newServer.name}
              onChange={(e) =>
                setNewServer({ ...newServer, name: e.target.value })
              }
            />
            <Input
              placeholder="IP Address"
              value={newServer.ip}
              onChange={(e) =>
                setNewServer({ ...newServer, ip: e.target.value })
              }
            />
            <div className="flex gap-2">
              <Button onClick={addServer}>Add Server</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {servers.map((server) => (
          <Card key={server.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Server className="w-5 h-5 mr-2" />
                {server.name}
              </CardTitle>
              <Badge variant={getStatusVariant(server.status)}>
                {server.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">IP: {server.ip}</div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>CPU</span>
                  <span>{server.cpu}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-[hsl(var(--info))] h-2 rounded-full"
                    style={{ width: `${server.cpu}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Memory</span>
                  <span>{server.memory}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-[hsl(var(--success))] h-2 rounded-full"
                    style={{ width: `${server.memory}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Storage</span>
                  <span>{server.storage}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-[hsl(var(--primary))] h-2 rounded-full"
                    style={{ width: `${server.storage}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant={
                    server.status === "online" ? "destructive" : "default"
                  }
                  onClick={() => toggleServerStatus(server.id)}
                >
                  {server.status === "online" ? (
                    <PowerOff className="w-4 h-4 mr-1" />
                  ) : (
                    <Power className="w-4 h-4 mr-1" />
                  )}
                  {server.status === "online" ? "Stop" : "Start"}
                </Button>
                <Button size="sm" variant="outline">
                  <Settings className="w-4 h-4 mr-1" />
                  Config
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
