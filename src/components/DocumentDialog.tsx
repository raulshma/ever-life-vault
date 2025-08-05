import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDocuments } from '@/hooks/useDocuments';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Upload, 
  X, 
  Calendar, 
  Tag, 
  FileText, 
  Download,
  Trash2,
  Edit3,
  Eye,
  DollarSign
} from 'lucide-react';

interface DocumentDialogProps {
  document?: any;
  mode: 'add' | 'edit' | 'view';
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DocumentDialog({ document, mode, trigger, open, onOpenChange }: DocumentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'other',
    value: '',
    tags: [] as string[],
    expiry_date: '',
    purchase_date: '',
    file_path: '',
    file_size: 0,
    mime_type: ''
  });
  const [newTag, setNewTag] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { addDocument, updateDocument, deleteDocument } = useDocuments();
  const { user } = useAuth();
  const { toast } = useToast();

  const categories = [
    'academic', 'career', 'finance', 'health', 'legal', 'receipts', 'other'
  ];

  useEffect(() => {
    if (document && (mode === 'edit' || mode === 'view')) {
      setFormData({
        name: document.name || '',
        category: document.category || 'other',
        value: document.value?.toString() || '',
        tags: document.tags || [],
        expiry_date: document.expiry_date || '',
        purchase_date: document.purchase_date || '',
        file_path: document.file_path || '',
        file_size: document.file_size || 0,
        mime_type: document.mime_type || ''
      });
    }
  }, [document, mode]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
    if (!newOpen) {
      setFormData({
        name: '',
        category: 'other',
        value: '',
        tags: [],
        expiry_date: '',
        purchase_date: '',
        file_path: '',
        file_size: 0,
        mime_type: ''
      });
      setSelectedFile(null);
      setNewTag('');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFormData(prev => ({
        ...prev,
        name: prev.name || file.name.split('.').slice(0, -1).join('.'),
        file_size: file.size,
        mime_type: file.type
      }));
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('documents')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    return fileName;
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Document name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let filePath = formData.file_path;

      if (selectedFile && mode !== 'view') {
        setUploading(true);
        filePath = await uploadFile(selectedFile);
        if (!filePath) throw new Error('File upload failed');
        setUploading(false);
      }

      const documentData = {
        ...formData,
        value: formData.value ? parseFloat(formData.value) : undefined,
        file_path: filePath
      };

      if (mode === 'add') {
        await addDocument(documentData);
        toast({
          title: "Success",
          description: "Document added successfully",
        });
      } else if (mode === 'edit' && document) {
        await updateDocument(document.id, documentData);
        toast({
          title: "Success",
          description: "Document updated successfully",
        });
      }

      handleOpenChange(false);
    } catch (error) {
      console.error('Error saving document:', error);
      toast({
        title: "Error",
        description: "Failed to save document",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!document) return;

    setLoading(true);
    try {
      await deleteDocument(document.id);
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      handleOpenChange(false);
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!document?.file_path) return;

    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Document downloaded successfully",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'add': return 'Add Document';
      case 'edit': return 'Edit Document';
      case 'view': return 'Document Details';
      default: return 'Document';
    }
  };

  const content = (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          {getDialogTitle()}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        {/* File Upload */}
        {mode !== 'view' && (
          <div>
            <Label htmlFor="file-upload">Upload File</Label>
            <div className="mt-2">
              <Input
                id="file-upload"
                type="file"
                onChange={handleFileSelect}
                disabled={loading || uploading}
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
              />
              {uploading && (
                <p className="text-sm text-muted-foreground mt-1">
                  Uploading file...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Document Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter document name"
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

        {/* Dates and Value */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <Label htmlFor="expiry_date">Expiry Date</Label>
            <Input
              id="expiry_date"
              type="date"
              value={formData.expiry_date}
              onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
              disabled={mode === 'view' || loading}
            />
          </div>

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
        </div>

        {/* Tags */}
        <div>
          <Label>Tags</Label>
          <div className="space-y-2">
            {mode !== 'view' && (
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={loading}
                >
                  <Tag className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  {mode !== 'view' && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                      disabled={loading}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* File Info */}
        {formData.file_path && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">File Information</p>
                <p className="text-xs text-muted-foreground">
                  Size: {(formData.file_size / 1024).toFixed(1)} KB
                  {formData.mime_type && ` • Type: ${formData.mime_type}`}
                </p>
              </div>
              {mode === 'view' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          {mode === 'view' ? (
            <>
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={!formData.file_path}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
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
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || uploading}
                className="flex-1"
              >
                {loading ? (
                  <>Loading...</>
                ) : mode === 'add' ? (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Add Document
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Update Document
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
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