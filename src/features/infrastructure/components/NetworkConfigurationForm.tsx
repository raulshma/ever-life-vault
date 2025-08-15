import React, { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Minus } from "lucide-react";
import type { NetworkDefinition } from "../types";

interface NetworkConfigurationFormProps {
  network: NetworkDefinition;
  onUpdate: (network: NetworkDefinition) => void;
  onRemove: () => void;
}

export const NetworkConfigurationForm: React.FC<NetworkConfigurationFormProps> = ({
  network,
  onUpdate,
  onRemove,
}) => {
  const handleFieldChange = useCallback((field: keyof NetworkDefinition, value: any) => {
    onUpdate({ ...network, [field]: value });
  }, [network, onUpdate]);

  const handleDriverOptChange = useCallback((key: string, value: string) => {
    const newDriverOpts = { ...network.driver_opts };
    if (value.trim() === '') {
      delete newDriverOpts[key];
    } else {
      newDriverOpts[key] = value;
    }
    handleFieldChange('driver_opts', newDriverOpts);
  }, [network.driver_opts, handleFieldChange]);

  const handleAddDriverOpt = useCallback(() => {
    const newDriverOpts = { ...network.driver_opts, '': '' };
    handleFieldChange('driver_opts', newDriverOpts);
  }, [network.driver_opts, handleFieldChange]);

  const handleRemoveDriverOpt = useCallback((key: string) => {
    const newDriverOpts = { ...network.driver_opts };
    delete newDriverOpts[key];
    handleFieldChange('driver_opts', newDriverOpts);
  }, [network.driver_opts, handleFieldChange]);

  const driverOptEntries = Object.entries(network.driver_opts || {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{network.name || "Unnamed Network"}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`network-name-${network.name}`}>Network Name *</Label>
            <Input
              id={`network-name-${network.name}`}
              value={network.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="my-network"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`network-driver-${network.name}`}>Driver</Label>
            <Select
              value={network.driver || 'bridge'}
              onValueChange={(value) => handleFieldChange('driver', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bridge">Bridge</SelectItem>
                <SelectItem value="host">Host</SelectItem>
                <SelectItem value="overlay">Overlay</SelectItem>
                <SelectItem value="macvlan">Macvlan</SelectItem>
                <SelectItem value="ipvlan">IPvlan</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Driver Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Driver Options</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddDriverOpt}
              className="flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Add Option
            </Button>
          </div>
          
          {driverOptEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No driver options configured</p>
          ) : (
            <div className="space-y-2">
              {driverOptEntries.map(([key, value], index) => (
                <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Option Key</Label>
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          const newDriverOpts = { ...network.driver_opts };
                          delete newDriverOpts[key];
                          if (newKey.trim() !== '') {
                            newDriverOpts[newKey] = value;
                          }
                          handleFieldChange('driver_opts', newDriverOpts);
                        }}
                        placeholder="subnet"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Option Value</Label>
                      <Input
                        value={value}
                        onChange={(e) => handleDriverOptChange(key, e.target.value)}
                        placeholder="172.20.0.0/16"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveDriverOpt(key)}
                    className="text-destructive"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Common Driver Options Help */}
        {network.driver && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Common {network.driver} options:</p>
            <div className="text-xs text-muted-foreground space-y-1">
              {network.driver === 'bridge' && (
                <>
                  <p>• com.docker.network.bridge.name: br-custom</p>
                  <p>• com.docker.network.driver.mtu: 1500</p>
                  <p>• subnet: 172.20.0.0/16</p>
                  <p>• gateway: 172.20.0.1</p>
                </>
              )}
              {network.driver === 'overlay' && (
                <>
                  <p>• subnet: 10.0.0.0/24</p>
                  <p>• gateway: 10.0.0.1</p>
                  <p>• encrypted: true</p>
                  <p>• attachable: true</p>
                </>
              )}
              {network.driver === 'macvlan' && (
                <>
                  <p>• parent: eth0</p>
                  <p>• subnet: 192.168.1.0/24</p>
                  <p>• gateway: 192.168.1.1</p>
                  <p>• ip_range: 192.168.1.128/25</p>
                </>
              )}
              {network.driver === 'ipvlan' && (
                <>
                  <p>• parent: eth0</p>
                  <p>• ipvlan_mode: l2</p>
                  <p>• subnet: 192.168.1.0/24</p>
                  <p>• gateway: 192.168.1.1</p>
                </>
              )}
              {network.driver === 'host' && (
                <p>• No additional options needed for host networking</p>
              )}
              {network.driver === 'none' && (
                <p>• No network connectivity for containers</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};