import React, { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Minus } from "lucide-react";
import type { VolumeDefinition } from "../types";

interface VolumeConfigurationFormProps {
  volume: VolumeDefinition;
  onUpdate: (volume: VolumeDefinition) => void;
  onRemove: () => void;
}

export const VolumeConfigurationForm: React.FC<VolumeConfigurationFormProps> = ({
  volume,
  onUpdate,
  onRemove,
}) => {
  const handleFieldChange = useCallback((field: keyof VolumeDefinition, value: any) => {
    onUpdate({ ...volume, [field]: value });
  }, [volume, onUpdate]);

  const handleDriverOptChange = useCallback((key: string, value: string) => {
    const newDriverOpts = { ...volume.driver_opts };
    if (value.trim() === '') {
      delete newDriverOpts[key];
    } else {
      newDriverOpts[key] = value;
    }
    handleFieldChange('driver_opts', newDriverOpts);
  }, [volume.driver_opts, handleFieldChange]);

  const handleAddDriverOpt = useCallback(() => {
    const newDriverOpts = { ...volume.driver_opts, '': '' };
    handleFieldChange('driver_opts', newDriverOpts);
  }, [volume.driver_opts, handleFieldChange]);

  const handleRemoveDriverOpt = useCallback((key: string) => {
    const newDriverOpts = { ...volume.driver_opts };
    delete newDriverOpts[key];
    handleFieldChange('driver_opts', newDriverOpts);
  }, [volume.driver_opts, handleFieldChange]);

  const driverOptEntries = Object.entries(volume.driver_opts || {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{volume.name || "Unnamed Volume"}</CardTitle>
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
            <Label htmlFor={`volume-name-${volume.name}`}>Volume Name *</Label>
            <Input
              id={`volume-name-${volume.name}`}
              value={volume.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="my-volume"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`volume-driver-${volume.name}`}>Driver</Label>
            <Select
              value={volume.driver || 'local'}
              onValueChange={(value) => handleFieldChange('driver', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="nfs">NFS</SelectItem>
                <SelectItem value="cifs">CIFS</SelectItem>
                <SelectItem value="overlay2">Overlay2</SelectItem>
                <SelectItem value="tmpfs">TmpFS</SelectItem>
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
                          const newDriverOpts = { ...volume.driver_opts };
                          delete newDriverOpts[key];
                          if (newKey.trim() !== '') {
                            newDriverOpts[newKey] = value;
                          }
                          handleFieldChange('driver_opts', newDriverOpts);
                        }}
                        placeholder="type"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Option Value</Label>
                      <Input
                        value={value}
                        onChange={(e) => handleDriverOptChange(key, e.target.value)}
                        placeholder="nfs"
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
        {volume.driver && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Common {volume.driver} options:</p>
            <div className="text-xs text-muted-foreground space-y-1">
              {volume.driver === 'local' && (
                <>
                  <p>• type: none, bind, volume</p>
                  <p>• device: /path/to/host/directory</p>
                  <p>• o: bind,uid=1000,gid=1000</p>
                </>
              )}
              {volume.driver === 'nfs' && (
                <>
                  <p>• type: nfs</p>
                  <p>• device: server:/path/to/share</p>
                  <p>• o: addr=192.168.1.100,rw</p>
                </>
              )}
              {volume.driver === 'cifs' && (
                <>
                  <p>• type: cifs</p>
                  <p>• device: //server/share</p>
                  <p>• o: username=user,password=pass</p>
                </>
              )}
              {volume.driver === 'tmpfs' && (
                <>
                  <p>• type: tmpfs</p>
                  <p>• tmpfs-size: 100m</p>
                  <p>• tmpfs-mode: 1777</p>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};