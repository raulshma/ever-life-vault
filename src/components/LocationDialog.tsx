import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useInventory } from '@/hooks/useInventory';
import { 
  MapPin, 
  Trash2,
  Edit3,
  Eye,
  Home,
  Car,
  Package,
  Building,
  Warehouse
} from 'lucide-react';

interface LocationDialogProps {
  location?: any;
  mode: 'add' | 'edit' | 'view';
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LocationDialog({ location, mode, trigger, open, onOpenChange }: LocationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'Home'
  });

  const { addLocation, updateLocation, deleteLocation } = useInventory();
  const { toast } = useToast();

  const iconOptions = [
    { value: 'Home', label: 'Home', icon: Home },
    { value: 'Car', label: 'Car', icon: Car },
    { value: 'Package', label: 'Storage', icon: Package },
    { value: 'Building', label: 'Office', icon: Building },
    { value: 'Warehouse', label: 'Warehouse', icon: Warehouse }
  ];

  useEffect(() => {
    if (location && (mode === 'edit' || mode === 'view')) {
      setFormData({
        name: location.name || '',
        description: location.description || '',
        icon: location.icon || 'Home'
      });
    }
  }, [location, mode]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
    if (!newOpen) {
      setFormData({
        name: '',
        description: '',
        icon: 'Home'
      });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Location name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (mode === 'add') {
        await addLocation(formData);
        toast({
          title: "Success",
          description: "Location added successfully",
        });
      } else if (mode === 'edit' && location) {
        await updateLocation(location.id, formData);
        toast({
          title: "Success",
          description: "Location updated successfully",
        });
      }

      handleOpenChange(false);
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        title: "Error",
        description: "Failed to save location",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!location) return;

    setLoading(true);
    try {
      await deleteLocation(location.id);
      toast({
        title: "Success",
        description: "Location deleted successfully",
      });
      handleOpenChange(false);
    } catch (error) {
      console.error('Error deleting location:', error);
      toast({
        title: "Error",
        description: "Failed to delete location",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'add': return 'Add Location';
      case 'edit': return 'Edit Location';
      case 'view': return 'Location Details';
      default: return 'Location';
    }
  };

  const selectedIcon = iconOptions.find(opt => opt.value === formData.icon);
  const IconComponent = selectedIcon?.icon || Home;

  const content = (
    <DialogContent className="max-w-lg max-h-[85vh]">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          {getDialogTitle()}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        {/* Basic Information */}
        <div>
          <Label htmlFor="name">Location Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter location name"
            disabled={mode === 'view' || loading}
          />
        </div>

        {/* Icon Selection */}
        <div>
          <Label htmlFor="icon">Icon</Label>
          <Select
            value={formData.icon}
            onValueChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}
            disabled={mode === 'view' || loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select icon">
                <div className="flex items-center">
                  <IconComponent className="w-4 h-4 mr-2" />
                  {selectedIcon?.label}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {iconOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center">
                      <Icon className="w-4 h-4 mr-2" />
                      {option.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Enter location description"
            disabled={mode === 'view' || loading}
            rows={3}
          />
        </div>

        {/* Footer actions moved into sticky footer below */}
      </div>

      <DialogFooter>
        {mode === 'view' ? (
          <>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>Loading...</>
              ) : mode === 'add' ? (
                <>
                  <MapPin className="w-4 h-4 mr-2" />
                  Add Location
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Update Location
                </>
              )}
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );

  if (open !== undefined) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {content}
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      {content}
    </Dialog>
  );
}