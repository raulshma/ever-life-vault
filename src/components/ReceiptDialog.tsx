import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useReceipts, type Receipt } from '@/hooks/useReceipts';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { CategorySuggestions } from '@/components/CategorySuggestions';
import { SmartCategorizationService } from '@/services/SmartCategorizationService';
import { 
  Receipt as ReceiptIcon, 
  Upload,
  Brain,
  Camera,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Save
} from 'lucide-react';

interface ReceiptDialogProps {
  receipt?: Receipt;
  mode: 'add' | 'edit' | 'view';
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ReceiptDialog({ receipt, mode, trigger, open, onOpenChange }: ReceiptDialogProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [categorizationService, setCategorizationService] = useState<SmartCategorizationService | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    total_amount: '',
    currency: 'USD',
    receipt_date: new Date().toISOString().split('T')[0],
    merchant_name: '',
    category: 'other',
    tax_amount: '',
    payment_method: '',
    is_business_expense: false,
    is_tax_deductible: false,
    notes: '',
  });

  const { 
    categories,
    receipts,
    createReceipt, 
    updateReceipt, 
    analyzeReceipt,
    analyzing 
  } = useReceipts();
  const { user } = useAuth();
  const { toast } = useToast();

  // Initialize categorization service when receipts are loaded
  useEffect(() => {
    if (receipts.length > 0) {
      const service = new SmartCategorizationService(receipts);
      setCategorizationService(service);
    }
  }, [receipts]);

  useEffect(() => {
    if (receipt && (mode === 'edit' || mode === 'view')) {
      setFormData({
        name: receipt.name || '',
        description: receipt.description || '',
        total_amount: receipt.total_amount?.toString() || '',
        currency: receipt.currency || 'USD',
        receipt_date: receipt.receipt_date || new Date().toISOString().split('T')[0],
        merchant_name: receipt.merchant_name || '',
        category: receipt.category || 'other',
        tax_amount: receipt.tax_amount?.toString() || '',
        payment_method: receipt.payment_method || '',
        is_business_expense: receipt.is_business_expense || false,
        is_tax_deductible: receipt.is_tax_deductible || false,
        notes: receipt.notes || '',
      });
      setPreviewUrl(receipt.image_url || null);
    }
  }, [receipt, mode]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      total_amount: '',
      currency: 'USD',
      receipt_date: new Date().toISOString().split('T')[0],
      merchant_name: '',
      category: 'other',
      tax_amount: '',
      payment_method: '',
      is_business_expense: false,
      is_tax_deductible: false,
      notes: '',
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      if (!formData.name) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setFormData(prev => ({ ...prev, name: nameWithoutExt }));
      }
    }
  };

  const handleLearnFromCorrection = (suggestedCategory: string, actualCategory: string) => {
    if (categorizationService && receipt) {
      categorizationService.learnFromCorrection(receipt, suggestedCategory, actualCategory);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `receipts/${user.id}/${Date.now()}.${fileExt}`;

    setUploadProgress(10);

    const { error } = await supabase.storage
      .from('receipts')
      .upload(fileName, file);

    setUploadProgress(90);

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    setUploadProgress(100);

    const { data } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Receipt name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
      toast({
        title: "Error",
        description: "Valid total amount is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let imageUrl: string | undefined = receipt?.image_url;

      if (selectedFile && mode !== 'view') {
        const uploadedUrl = await uploadFile(selectedFile);
        if (!uploadedUrl) throw new Error('Image upload failed');
        imageUrl = uploadedUrl;
      }

      const receiptData = {
        ...formData,
        total_amount: parseFloat(formData.total_amount),
        tax_amount: formData.tax_amount ? parseFloat(formData.tax_amount) : undefined,
        image_url: imageUrl,
      };

      let savedReceipt: Receipt | null = null;

      if (mode === 'add') {
        savedReceipt = await createReceipt(receiptData);
      } else if (mode === 'edit' && receipt) {
        savedReceipt = await updateReceipt(receipt.id, receiptData);
      }

      if (savedReceipt && imageUrl && mode === 'add') {
        await analyzeReceipt(savedReceipt.id);
      }

      handleOpenChange(false);
    } catch (error) {
      console.error('Error saving receipt:', error);
      toast({
        title: "Error",
        description: "Failed to save receipt",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isAnalyzing = receipt ? analyzing.has(receipt.id) : false;
  const isReadOnly = mode === 'view';

  return (
    <Dialog open={open !== undefined ? open : isOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      
      <DialogContent className="max-w-3xl max-h-[95vh] sm:max-h-[90vh] w-[95vw] sm:w-full mx-2 sm:mx-0 flex flex-col">
        <DialogHeader className="pb-2 sm:pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <ReceiptIcon className="w-5 h-5" />
            {mode === 'add' ? 'Add New Receipt' : 
             mode === 'edit' ? 'Edit Receipt' : 
             'View Receipt'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs defaultValue="basic" className="w-full h-full">
            <TabsList className={`grid w-full ${isMobile ? 'grid-cols-3 h-auto' : 'grid-cols-3'} flex-shrink-0`}>
            <TabsTrigger value="basic" className="text-xs sm:text-sm px-2 py-2">
              {isMobile ? 'Basic' : 'Basic Info'}
            </TabsTrigger>
            <TabsTrigger value="details" className="text-xs sm:text-sm px-2 py-2">
              Details
            </TabsTrigger>
            <TabsTrigger value="analysis" className="text-xs sm:text-sm px-2 py-2">
              {isMobile ? 'AI' : 'AI Analysis'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-3 sm:space-y-4 mt-3 sm:mt-6 overflow-y-auto max-h-full px-1">
            <div className={`${isMobile ? 'space-y-4' : 'grid grid-cols-2 gap-4'}`}>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Receipt Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={isReadOnly}
                  placeholder="Enter receipt name"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_amount" className="text-sm font-medium">Total Amount *</Label>
                <div className="flex gap-2">
                  <Select 
                    value={formData.currency} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="total_amount"
                    type="number"
                    step="0.01"
                    value={formData.total_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_amount: e.target.value }))}
                    disabled={isReadOnly}
                    placeholder="0.00"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt_date" className="text-sm font-medium">Receipt Date</Label>
                <Input
                  id="receipt_date"
                  type="date"
                  value={formData.receipt_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, receipt_date: e.target.value }))}
                  disabled={isReadOnly}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name.toLowerCase().replace(/\s+/g, '_')}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Smart Category Suggestions */}
                {mode !== 'view' && (
                  <CategorySuggestions
                    receiptData={{
                      merchant_name: formData.merchant_name,
                      total_amount: parseFloat(formData.total_amount) || 0,
                      receipt_date: formData.receipt_date,
                      description: formData.description
                    }}
                    currentCategory={formData.category}
                    onCategorySelect={(category) => setFormData(prev => ({ ...prev, category }))}
                    onLearnFromCorrection={handleLearnFromCorrection}
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant_name" className="text-sm font-medium">Merchant Name</Label>
              <Input
                id="merchant_name"
                value={formData.merchant_name}
                onChange={(e) => setFormData(prev => ({ ...prev, merchant_name: e.target.value }))}
                disabled={isReadOnly}
                placeholder="Store or business name"
                className="w-full"
              />
            </div>

            {!isReadOnly && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Receipt Image</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-3 sm:p-4">
                  {previewUrl ? (
                    <div className="text-center space-y-2">
                      <img 
                        src={previewUrl} 
                        alt="Receipt preview" 
                        className="max-w-full max-h-32 sm:max-h-48 mx-auto rounded object-contain"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPreviewUrl(null);
                          setSelectedFile(null);
                        }}
                        className="mt-2"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Camera className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-muted-foreground mb-2" />
                      <div className="text-xs sm:text-sm text-muted-foreground mb-2">
                        Upload receipt image for AI analysis
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                      />
                      <Label htmlFor="file-upload" className="cursor-pointer">
                        <Button variant="outline" asChild size={isMobile ? "sm" : "default"}>
                          <span>
                            <Upload className="w-4 h-4 mr-2" />
                            Choose Image
                          </span>
                        </Button>
                      </Label>
                    </div>
                  )}
                  
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-2">
                      <Progress value={uploadProgress} className="w-full" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {isReadOnly && receipt?.image_url && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Receipt Image</Label>
                <img 
                  src={receipt.image_url} 
                  alt="Receipt" 
                  className="max-w-full max-h-32 sm:max-h-48 rounded border object-contain"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-3 sm:space-y-4 mt-3 sm:mt-6 overflow-y-auto max-h-full px-1">
            <div className={`${isMobile ? 'space-y-4' : 'grid grid-cols-2 gap-4'}`}>
              <div className="space-y-2">
                <Label htmlFor="tax_amount" className="text-sm font-medium">Tax Amount</Label>
                <Input
                  id="tax_amount"
                  type="number"
                  step="0.01"
                  value={formData.tax_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, tax_amount: e.target.value }))}
                  disabled={isReadOnly}
                  placeholder="0.00"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method" className="text-sm font-medium">Payment Method</Label>
                <Select 
                  value={formData.payment_method} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="digital">Digital Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Classification</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Switch
                    id="is_business_expense"
                    checked={formData.is_business_expense}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_business_expense: checked }))}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor="is_business_expense" className="text-sm font-medium cursor-pointer">
                    Business Expense
                  </Label>
                </div>

                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Switch
                    id="is_tax_deductible"
                    checked={formData.is_tax_deductible}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_tax_deductible: checked }))}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor="is_tax_deductible" className="text-sm font-medium cursor-pointer">
                    Tax Deductible
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                disabled={isReadOnly}
                placeholder="Enter description..."
                rows={isMobile ? 2 : 3}
                className="w-full resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                disabled={isReadOnly}
                placeholder="Additional notes..."
                rows={isMobile ? 2 : 3}
                className="w-full resize-none"
              />
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-3 sm:space-y-4 mt-3 sm:mt-6 overflow-y-auto max-h-full px-1">
            {receipt ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <Label className="text-sm font-medium">AI Analysis</Label>
                  {mode !== 'view' && receipt.image_url && (
                    <Button
                      variant="outline"
                      size={isMobile ? "sm" : "default"}
                      onClick={() => analyzeReceipt(receipt.id)}
                      disabled={isAnalyzing}
                      className="w-full sm:w-auto"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Brain className="w-4 h-4 mr-2" />
                      )}
                      {isAnalyzing ? 'Analyzing...' : (isMobile ? 'Analyze' : 'Analyze Receipt')}
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge variant={
                      receipt.analysis_status === 'completed' ? 'default' :
                      receipt.analysis_status === 'failed' ? 'destructive' :
                      'secondary'
                    }>
                      {receipt.analysis_status}
                    </Badge>
                  </div>
                  
                  {receipt.ai_confidence_score && (
                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                      <span className="text-sm font-medium">Confidence:</span>
                      <span className="text-sm font-semibold">{Math.round(receipt.ai_confidence_score * 100)}%</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-6 sm:py-8">
                <Brain className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm">Save receipt to enable AI analysis</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
        </div>

        <DialogFooter className="pt-4 sm:pt-6 flex-shrink-0">
          {mode !== 'view' && (
            <Button 
              onClick={handleSubmit} 
              disabled={loading}
              className="w-full sm:w-auto"
              size={isMobile ? "default" : "default"}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {mode === 'add' ? (isMobile ? 'Create' : 'Create Receipt') : (isMobile ? 'Update' : 'Update Receipt')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}