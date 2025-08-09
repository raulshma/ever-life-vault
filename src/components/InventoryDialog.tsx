import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useInventory } from '@/hooks/useInventory';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Package, 
  X, 
  Calendar, 
  Upload,
  Download,
  Trash2,
  Edit3,
  Eye,
  DollarSign,
  QrCode,
  MapPin,
  Camera
} from 'lucide-react';

interface InventoryDialogProps {
  item?: any;
  mode: 'add' | 'edit' | 'view';
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function InventoryDialog({ item, mode, trigger, open, onOpenChange }: InventoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'other',
    description: '',
    value: '',
    location_id: '',
    purchase_date: '',
    warranty_expires: '',
    has_qr_code: false,
    qr_code_data: '',
    is_lent: false,
    lent_to: '',
    lent_date: '',
    image_url: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { items, locations, addItem, updateItem, deleteItem } = useInventory();
  const { user } = useAuth();
  const { toast } = useToast();

  const categories = [
    'electronics', 'furniture', 'clothing', 'books', 'tools', 'sports', 'other'
  ];

  useEffect(() => {
    if (item && (mode === 'edit' || mode === 'view')) {
      setFormData({
        name: item.name || '',
        category: item.category || 'other',
        description: item.description || '',
        value: item.value?.toString() || '',
        location_id: item.location_id || '',
        purchase_date: item.purchase_date || '',
        warranty_expires: item.warranty_expires || '',
        has_qr_code: item.has_qr_code || false,
        qr_code_data: item.qr_code_data || '',
        is_lent: item.is_lent || false,
        lent_to: item.lent_to || '',
        lent_date: item.lent_date || '',
        image_url: item.image_url || ''
      });
    }
  }, [item, mode]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
    if (!newOpen) {
      setFormData({
        name: '',
        category: 'other',
        description: '',
        value: '',
        location_id: '',
        purchase_date: '',
        warranty_expires: '',
        has_qr_code: false,
        qr_code_data: '',
        is_lent: false,
        lent_to: '',
        lent_date: '',
        image_url: ''
      });
      setSelectedFile(null);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('inventory')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    // Get public URL
    const { data } = supabase.storage
      .from('inventory')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const generateQRCode = () => {
    const qrData = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setFormData(prev => ({
      ...prev,
      qr_code_data: qrData,
      has_qr_code: true
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Item name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let imageUrl = formData.image_url;

      if (selectedFile && mode !== 'view') {
        setUploading(true);
        imageUrl = await uploadFile(selectedFile);
        setUploading(false);
      }

      const itemData = {
        ...formData,
        value: formData.value ? parseFloat(formData.value) : undefined,
        image_url: imageUrl,
        location_id: formData.location_id || null
      };

      if (mode === 'add') {
        await addItem(itemData);
        toast({
          title: "Success",
          description: "Item added successfully",
        });
      } else if (mode === 'edit' && item) {
        await updateItem(item.id, itemData);
        toast({
          title: "Success",
          description: "Item updated successfully",
        });
      }

      handleOpenChange(false);
    } catch (error) {
      console.error('Error saving item:', error);
      toast({
        title: "Error",
        description: "Failed to save item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;

    setLoading(true);
    try {
      await deleteItem(item.id);
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
      handleOpenChange(false);
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'add': return 'Add Item';
      case 'edit': return 'Edit Item';
      case 'view': return 'Item Details';
      default: return 'Item';
    }
  };

  const content = (
    <DialogContent className="max-w-2xl max-h-[85vh]">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <Package className="w-5 h-5 mr-2" />
          {getDialogTitle()}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        {/* Image Upload */}
        {mode !== 'view' && (
          <div>
            <Label htmlFor="image-upload">Item Image</Label>
            <div className="mt-2">
              <Input
                id="image-upload"
                type="file"
                onChange={handleFileSelect}
                disabled={loading || uploading}
                accept="image/*"
              />
              {uploading && (
                <p className="text-sm text-muted-foreground mt-1">
                  Uploading image...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Image Preview */}
        {(formData.image_url || selectedFile) && (
          <div className="flex justify-center">
            <img
              src={selectedFile ? URL.createObjectURL(selectedFile) : formData.image_url}
              alt="Item preview"
              className="w-32 h-32 object-cover rounded-lg border"
            />
          </div>
        )}

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Item Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter item name"
              disabled={mode === 'view' || loading}
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              disabled={mode === 'view' || loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Enter item description"
            disabled={mode === 'view' || loading}
            rows={3}
          />
        </div>

        {/* Value and Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="value">Value ($)</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              value={formData.value}
              onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
              placeholder="0.00"
              disabled={mode === 'view' || loading}
            />
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Select
              value={formData.location_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, location_id: value }))}
              disabled={mode === 'view' || loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="purchase_date">Purchase Date</Label>
            <Input
              id="purchase_date"
              type="date"
              value={formData.purchase_date}
              onChange={(e) => setFormData(prev => ({ ...prev, purchase_date: e.target.value }))}
              disabled={mode === 'view' || loading}
            />
          </div>

          <div>
            <Label htmlFor="warranty_expires">Warranty Expires</Label>
            <Input
              id="warranty_expires"
              type="date"
              value={formData.warranty_expires}
              onChange={(e) => setFormData(prev => ({ ...prev, warranty_expires: e.target.value }))}
              disabled={mode === 'view' || loading}
            />
          </div>
        </div>

        {/* QR Code */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.has_qr_code}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, has_qr_code: checked }))}
                disabled={mode === 'view' || loading}
              />
              <Label>Has QR Code</Label>
            </div>
            {mode !== 'view' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateQRCode}
                disabled={loading}
              >
                <QrCode className="w-4 h-4 mr-2" />
                Generate QR
              </Button>
            )}
          </div>

          {formData.has_qr_code && (
            <div>
              <Label htmlFor="qr_code_data">QR Code Data</Label>
              <Input
                id="qr_code_data"
                value={formData.qr_code_data}
                onChange={(e) => setFormData(prev => ({ ...prev, qr_code_data: e.target.value }))}
                placeholder="QR code data"
                disabled={mode === 'view' || loading}
              />
            </div>
          )}
        </div>

        {/* Lending Status */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_lent}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_lent: checked }))}
              disabled={mode === 'view' || loading}
            />
            <Label>Currently Lent Out</Label>
          </div>

          {formData.is_lent && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lent_to">Lent To</Label>
                <Input
                  id="lent_to"
                  value={formData.lent_to}
                  onChange={(e) => setFormData(prev => ({ ...prev, lent_to: e.target.value }))}
                  placeholder="Person's name"
                  disabled={mode === 'view' || loading}
                />
              </div>

              <div>
                <Label htmlFor="lent_date">Lent Date</Label>
                <Input
                  id="lent_date"
                  type="date"
                  value={formData.lent_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, lent_date: e.target.value }))}
                  disabled={mode === 'view' || loading}
                />
              </div>
            </div>
          )}
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
              disabled={loading || uploading}
            >
              {loading ? (
                <>Loading...</>
              ) : mode === 'add' ? (
                <>
                  <Package className="w-4 h-4 mr-2" />
                  Add Item
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Update Item
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