import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useValidation } from '@/hooks/useValidation';
import { useReceipts, type Receipt, type ReceiptDocument } from '@/hooks/useReceipts';
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
  Save,
  FileText,
  Paperclip,
  Plus,
  Download,
  Trash2,
  Calendar,
  Building,
  Hash,
  Info,
  Clock,
  Shield,
  Phone,
  Mail,
  MapPin,
  Tag,
  AlertTriangle,
  RefreshCw
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
  const [aiProgress, setAiProgress] = useState({ stage: '', progress: 0 });
  const [categorizationService, setCategorizationService] = useState<SmartCategorizationService | null>(null);
  const [documents, setDocuments] = useState<ReceiptDocument[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<File[]>([]);
  const [isUsingAI, setIsUsingAI] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
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
    analyzing,
    quickAnalyzeReceipt,
    quickAnalyzing,
    getReceiptDocuments,
    addReceiptDocument,
    updateReceiptDocument,
    deleteReceiptDocument,
    analyzeDocument,
    analyzeAllDocuments
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
      setDocuments(receipt.receipt_documents || []);
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
    setDocuments([]);
    setSelectedDocuments([]);
    setIsUsingAI(false);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      if (!formData.name) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setFormData(prev => ({ ...prev, name: nameWithoutExt }));
      }

      // Auto-fill form with AI analysis if adding a new receipt
      if (mode === 'add' && user) {
        setIsUsingAI(true);
        setAiProgress({ stage: 'Starting analysis...', progress: 0 });
        
        try {
          // Upload file first to get a URL for analysis
          const uploadedUrl = await uploadFile(file);
          if (uploadedUrl) {
            // Get public URL for analysis
            const { data } = supabase.storage
              .from('receipts')
              .getPublicUrl(uploadedUrl.replace('https://your-supabase-url.supabase.co/storage/v1/object/public/receipts/', ''));
            
            if (data.publicUrl) {
              const aiFormData = await quickAnalyzeReceipt(data.publicUrl);
              
              if (aiFormData) {
                setFormData(prev => ({
                  ...prev,
                  name: aiFormData.name || prev.name,
                  description: aiFormData.description || prev.description,
                  total_amount: aiFormData.total_amount?.toString() || prev.total_amount,
                  currency: aiFormData.currency || prev.currency,
                  receipt_date: aiFormData.receipt_date || prev.receipt_date,
                  merchant_name: aiFormData.merchant_name || prev.merchant_name,
                  category: aiFormData.category || prev.category,
                  tax_amount: aiFormData.tax_amount?.toString() || prev.tax_amount,
                  payment_method: aiFormData.payment_method || prev.payment_method,
                  is_business_expense: aiFormData.is_business_expense,
                  is_tax_deductible: aiFormData.is_tax_deductible,
                  notes: aiFormData.notes || prev.notes,
                }));
                
                toast({
                  title: "AI Analysis Complete",
                  description: "Form has been auto-filled with receipt data",
                });
              }
            }
          }
        } catch (error) {
          console.error('AI analysis failed:', error);
          toast({
            title: "AI Analysis Failed",
            description: "Unable to analyze receipt automatically. Please fill the form manually.",
            variant: "destructive"
          });
        } finally {
          setIsUsingAI(false);
          setAiProgress({ stage: '', progress: 0 });
        }
      }
    }
  };

  const handleDocumentFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedDocuments(prev => [...prev, ...files]);
  };

  const removeSelectedDocument = (index: number) => {
    setSelectedDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadDocument = async (file: File, receiptId: string, documentData: Partial<ReceiptDocument>) => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${receiptId}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('receipt-documents')
      .upload(fileName, file);

    if (error) {
      console.error('Document upload error:', error);
      throw error;
    }

    // Add document record
    const documentRecord: Omit<ReceiptDocument, 'id' | 'receipt_id' | 'user_id' | 'created_at' | 'updated_at'> = {
      name: documentData.name || file.name.replace(/\.[^/.]+$/, ''),
      description: documentData.description,
      document_type: documentData.document_type || 'warranty' as const,
      file_path: fileName,
      file_size: file.size,
      mime_type: file.type,
      original_filename: file.name,
      expiry_date: documentData.expiry_date,
      issue_date: documentData.issue_date,
      document_number: documentData.document_number,
      issuer: documentData.issuer,
      tags: documentData.tags || [],
      notes: documentData.notes,
      is_primary: documentData.is_primary || false,
      analysis_status: 'pending' as const,
    };

    return await addReceiptDocument(receiptId, documentRecord);
  };

  const handleLearnFromCorrection = (suggestedCategory: string, actualCategory: string) => {
    if (categorizationService && receipt) {
      categorizationService.learnFromCorrection(receipt, suggestedCategory, actualCategory);
    }
  };

  // Render AI analysis information for a document
  const renderDocumentAnalysis = (doc: ReceiptDocument) => {
    if (!doc.ai_analysis_data) return null;

    const analysis = doc.ai_analysis_data;
    const confidence = doc.ai_confidence_score ? Math.round(doc.ai_confidence_score * 100) : 0;

    return (
      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">AI Analysis</span>
          <Badge variant="secondary" className="text-xs">
            {confidence}% confidence
          </Badge>
        </div>
        
        <div className="space-y-2 text-xs">
          {/* Product Information */}
          {analysis.product && (analysis.product.name || analysis.product.brand) && (
            <div className="flex items-start gap-2">
              <Tag className="w-3 h-3 mt-0.5 text-gray-500" />
              <div>
                <span className="font-medium">Product: </span>
                {analysis.product.brand && <span className="text-gray-600">{analysis.product.brand} </span>}
                {analysis.product.name && <span>{analysis.product.name}</span>}
                {analysis.product.model_number && (
                  <span className="text-gray-500"> (Model: {analysis.product.model_number})</span>
                )}
              </div>
            </div>
          )}
          
          {/* Warranty Information */}
          {analysis.warranty && (analysis.warranty.duration || analysis.warranty.end_date) && (
            <div className="flex items-start gap-2">
              <Shield className="w-3 h-3 mt-0.5 text-green-500" />
              <div>
                <span className="font-medium">Warranty: </span>
                {analysis.warranty.duration && <span>{analysis.warranty.duration}</span>}
                {analysis.warranty.end_date && (
                  <span className="text-gray-600"> (until {new Date(analysis.warranty.end_date).toLocaleDateString()})</span>
                )}
              </div>
            </div>
          )}
          
          {/* Important Dates */}
          {analysis.dates && (analysis.dates.expiry_date || analysis.dates.registration_deadline) && (
            <div className="flex items-start gap-2">
              <Calendar className="w-3 h-3 mt-0.5 text-orange-500" />
              <div>
                <span className="font-medium">Important Dates: </span>
                {analysis.dates.expiry_date && (
                  <span className="text-orange-600">Expires: {new Date(analysis.dates.expiry_date).toLocaleDateString()}</span>
                )}
                {analysis.dates.registration_deadline && (
                  <span className="text-red-600"> | Register by: {new Date(analysis.dates.registration_deadline).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          )}
          
          {/* Support Contact */}
          {analysis.support && (analysis.support.phone || analysis.support.email) && (
            <div className="flex items-start gap-2">
              <Phone className="w-3 h-3 mt-0.5 text-blue-500" />
              <div>
                <span className="font-medium">Support: </span>
                {analysis.support.phone && <span className="text-blue-600">{analysis.support.phone}</span>}
                {analysis.support.email && (
                  <span className="text-blue-600">
                    {analysis.support.phone ? ' | ' : ''}{analysis.support.email}
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Key Information */}
          {analysis.key_information && analysis.key_information.length > 0 && (
            <div className="flex items-start gap-2">
              <Info className="w-3 h-3 mt-0.5 text-purple-500" />
              <div>
                <span className="font-medium">Key Info: </span>
                <div className="mt-1 space-y-1">
                  {analysis.key_information.slice(0, 3).map((info: any, index: number) => (
                    <div key={index} className={`text-xs p-1 rounded ${
                      info.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' :
                      info.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    }`}>
                      <span className="font-medium">{info.category}: </span>
                      {info.content}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
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

  // Real-time form validation
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Receipt name is required';
    }
    
    if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
      errors.total_amount = 'Valid total amount is required';
    }
    
    if (formData.tax_amount && parseFloat(formData.tax_amount) < 0) {
      errors.tax_amount = 'Tax amount cannot be negative';
    }
    
    if (formData.tax_amount && formData.total_amount && 
        parseFloat(formData.tax_amount) > parseFloat(formData.total_amount)) {
      errors.tax_amount = 'Tax amount cannot exceed total amount';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
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

      // Upload and attach documents if any
      if (savedReceipt && selectedDocuments.length > 0) {
        try {
          for (const docFile of selectedDocuments) {
            await uploadDocument(docFile, savedReceipt.id, {
              document_type: 'warranty', // Default type, could be made configurable
              is_primary: selectedDocuments.indexOf(docFile) === 0 // First document is primary
            });
          }
          
          toast({
            title: "Success",
            description: `${selectedDocuments.length} document(s) attached to receipt`,
          });
        } catch (error) {
          console.error('Error uploading documents:', error);
          toast({
            title: "Warning",
            description: "Receipt saved but some documents failed to upload",
            variant: "destructive",
          });
        }
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
            <TabsList className={`grid w-full ${isMobile ? 'grid-cols-4 h-auto' : 'grid-cols-4'} flex-shrink-0`}>
            <TabsTrigger value="basic" className="text-xs sm:text-sm px-2 py-2">
              {isMobile ? 'Basic' : 'Basic Info'}
            </TabsTrigger>
            <TabsTrigger value="details" className="text-xs sm:text-sm px-2 py-2">
              Details
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs sm:text-sm px-2 py-2">
              {isMobile ? 'Docs' : 'Documents'}
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
                  className={`w-full ${validationErrors.name ? 'border-destructive' : ''}`}
                />
                {validationErrors.name && (
                  <p className="text-xs text-destructive mt-1">{validationErrors.name}</p>
                )}
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
                    className={`flex-1 ${validationErrors.total_amount ? 'border-destructive' : ''}`}
                  />
                </div>
                {validationErrors.total_amount && (
                  <p className="text-xs text-destructive mt-1">{validationErrors.total_amount}</p>
                )}
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
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Receipt Image</Label>
                {(isUsingAI || quickAnalyzing) && (
                  <Alert className="mt-2">
                    <Brain className="w-4 h-4 animate-pulse" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{aiProgress.stage || 'AI Analyzing...'}</span>
                          <span className="text-xs text-muted-foreground">{aiProgress.progress}%</span>
                        </div>
                        {aiProgress.progress > 0 && (
                          <Progress value={aiProgress.progress} className="h-1" />
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                </div>
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
                  className={`w-full ${validationErrors.tax_amount ? 'border-destructive' : ''}`}
                />
                {validationErrors.tax_amount && (
                  <p className="text-xs text-destructive mt-1">{validationErrors.tax_amount}</p>
                )}
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

          <TabsContent value="documents" className="space-y-3 sm:space-y-4 mt-3 sm:mt-6 overflow-y-auto max-h-full px-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Attached Documents</Label>
                <div className="text-xs text-muted-foreground">
                  Warranties, manuals, guarantees, etc.
                </div>
              </div>

              {/* Existing Documents */}
              {documents.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Current Documents</Label>
                    {mode !== 'view' && documents.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => analyzeAllDocuments(receipt?.id || '')}
                        className="text-xs"
                      >
                        <Brain className="w-3 h-3 mr-1" />
                        Analyze All
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {documents.map((doc, index) => (
                      <div key={doc.id} className="border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{doc.name}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="capitalize">{doc.document_type}</span>
                                {doc.is_primary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                                
                                {/* Analysis Status */}
                                {doc.analysis_status === 'processing' && (
                                  <div className="flex items-center gap-1 text-blue-600">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Analyzing...</span>
                                  </div>
                                )}
                                {doc.analysis_status === 'completed' && (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="w-3 h-3" />
                                    <span>Analyzed</span>
                                  </div>
                                )}
                                {doc.analysis_status === 'failed' && (
                                  <div className="flex items-center gap-1 text-red-600">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Failed</span>
                                  </div>
                                )}
                                {doc.analysis_status === 'pending' && (
                                  <div className="flex items-center gap-1 text-gray-500">
                                    <Clock className="w-3 h-3" />
                                    <span>Pending</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {mode !== 'view' && (
                              <>
                                {/* Analyze Button */}
                                {(doc.analysis_status === 'pending' || doc.analysis_status === 'failed') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => analyzeDocument(receipt?.id || '', doc.id)}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    <Brain className="w-3 h-3" />
                                  </Button>
                                )}
                                
                                {/* Re-analyze Button */}
                                {doc.analysis_status === 'completed' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => analyzeDocument(receipt?.id || '', doc.id)}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </Button>
                                )}
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteReceiptDocument(receipt?.id || '', doc.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* AI Analysis Results */}
                        {doc.analysis_status === 'completed' && renderDocumentAnalysis(doc)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Documents for Upload */}
              {selectedDocuments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Documents to Attach</Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedDocuments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{file.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSelectedDocument(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Documents */}
              {mode !== 'view' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Add Documents</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-3 sm:p-4">
                    <div className="text-center">
                      <Paperclip className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-muted-foreground mb-2" />
                      <div className="text-xs sm:text-sm text-muted-foreground mb-2">
                        Upload warranty documents, manuals, or guarantees
                      </div>
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp"
                        multiple
                        onChange={handleDocumentFileSelect}
                        className="hidden"
                        id="document-upload"
                      />
                      <Label htmlFor="document-upload" className="cursor-pointer">
                        <Button variant="outline" asChild size={isMobile ? "sm" : "default"}>
                          <span>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Documents
                          </span>
                        </Button>
                      </Label>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Supported formats: PDF, Word documents, images (max 50MB each)
                  </div>
                </div>
              )}
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