'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useReceipts } from '@/hooks/useReceipts';
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  FileImage,
  Database
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportError {
  row: number;
  field: string;
  message: string;
  value: any;
}

interface ImportResult {
  success: number;
  errors: ImportError[];
  total: number;
}

interface BulkImportExportProps {
  className?: string;
}

export function BulkImportExport({ className }: BulkImportExportProps) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | 'json'>('csv');
  const [importFormat, setImportFormat] = useState<'csv' | 'xlsx' | 'json'>('csv');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { receipts, createReceipt, getExpenseStats } = useReceipts();
  const { toast } = useToast();
  const stats = getExpenseStats();

  const validateReceiptData = (data: any, rowIndex: number): ImportError[] => {
    const errors: ImportError[] = [];
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push({ row: rowIndex, field: 'name', message: 'Name is required', value: data.name });
    }    
    if (!data.total_amount || isNaN(parseFloat(data.total_amount)) || parseFloat(data.total_amount) <= 0) {
      errors.push({ row: rowIndex, field: 'total_amount', message: 'Valid total amount is required', value: data.total_amount });
    }
    
    if (!data.receipt_date) {
      errors.push({ row: rowIndex, field: 'receipt_date', message: 'Receipt date is required', value: data.receipt_date });
    } else {
      const date = new Date(data.receipt_date);
      if (isNaN(date.getTime())) {
        errors.push({ row: rowIndex, field: 'receipt_date', message: 'Invalid date format', value: data.receipt_date });
      }
    }
    
    if (data.currency && typeof data.currency !== 'string') {
      errors.push({ row: rowIndex, field: 'currency', message: 'Currency must be a string', value: data.currency });
    }
    
    return errors;
  };

  const processImportData = async (data: any[]): Promise<ImportResult> => {
    const result: ImportResult = { success: 0, errors: [], total: data.length };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowIndex = i + 1;
      
      // Validate row data
      const validationErrors = validateReceiptData(row, rowIndex);
      if (validationErrors.length > 0) {
        result.errors.push(...validationErrors);
        continue;
      }
      
      try {
        // Transform data to match our schema
        const receiptData = {
          name: row.name?.toString().trim(),
          description: row.description?.toString() || '',
          total_amount: parseFloat(row.total_amount),
          currency: row.currency || 'USD',
          receipt_date: new Date(row.receipt_date).toISOString().split('T')[0],
          merchant_name: row.merchant_name?.toString() || '',
          category: row.category || 'other',
          tax_amount: row.tax_amount ? parseFloat(row.tax_amount) : undefined,
          payment_method: row.payment_method?.toString() || '',
          is_business_expense: row.is_business_expense === 'true' || row.is_business_expense === true,
          is_tax_deductible: row.is_tax_deductible === 'true' || row.is_tax_deductible === true,
          is_reimbursable: row.is_reimbursable === 'true' || row.is_reimbursable === true,
          notes: row.notes?.toString() || '',
        };
        
        await createReceipt(receiptData);
        result.success++;
        
        // Update progress
        setImportProgress(Math.round(((i + 1) / data.length) * 100));
        
        // Small delay to prevent overwhelming the API
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        result.errors.push({
          row: rowIndex,
          field: 'general',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          value: row
        });
      }
    }
    
    return result;
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setImportProgress(0);
    setImportResult(null);
    
    try {
      let data: any[] = [];
      
      if (importFormat === 'csv') {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        });
      } else if (importFormat === 'xlsx') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      } else if (importFormat === 'json') {
        const text = await file.text();
        const jsonData = JSON.parse(text);
        data = Array.isArray(jsonData) ? jsonData : jsonData.receipts || [jsonData];
      }
      
      if (data.length === 0) {
        throw new Error('No data found in file');
      }
      
      const result = await processImportData(data);
      setImportResult(result);
      
      if (result.success > 0) {
        toast({
          title: "Import Completed",
          description: `Successfully imported ${result.success} receipts.`,
        });
      }
      
      if (result.errors.length > 0) {
        toast({
          title: "Import Warnings",
          description: `${result.errors.length} items had errors and were skipped.`,
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setImportProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExport = async () => {
    if (receipts.length === 0) {
      toast({
        title: "No Data",
        description: "No receipts to export.",
        variant: "destructive",
      });
      return;
    }
    
    setExporting(true);
    
    try {
      const exportData = receipts.map(receipt => ({
        name: receipt.name,
        description: receipt.description || '',
        total_amount: receipt.total_amount,
        currency: receipt.currency,
        receipt_date: receipt.receipt_date,
        merchant_name: receipt.merchant_name || '',
        category: receipt.category,
        tax_amount: receipt.tax_amount || '',
        payment_method: receipt.payment_method || '',
        is_business_expense: receipt.is_business_expense ? 'true' : 'false',
        is_tax_deductible: receipt.is_tax_deductible ? 'true' : 'false',
        is_reimbursable: receipt.is_reimbursable ? 'true' : 'false',
        analysis_status: receipt.analysis_status,
        notes: receipt.notes || '',
        created_at: receipt.created_at,
      }));
      
      const timestamp = new Date().toISOString().split('T')[0];
      let blob: Blob;
      let filename: string;
      
      if (exportFormat === 'csv') {
        const headers = Object.keys(exportData[0]).join(',');
        const csvContent = [headers, ...exportData.map(row => 
          Object.values(row).map(value => `"${value}"`).join(',')
        )].join('\n');
        
        blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        filename = `receipts-export-${timestamp}.csv`;
      } else if (exportFormat === 'xlsx') {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Receipts');
        
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        filename = `receipts-export-${timestamp}.xlsx`;
      } else {
        const jsonData = {
          exportDate: new Date().toISOString(),
          summary: stats,
          receipts: exportData
        };
        
        blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json;charset=utf-8;' });
        filename = `receipts-export-${timestamp}.json`;
      }
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export Completed",
        description: `Successfully exported ${receipts.length} receipts as ${exportFormat.toUpperCase()}.`,
      });
      
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        name: 'Example Receipt',
        description: 'Sample receipt for import',
        total_amount: 25.99,
        currency: 'USD',
        receipt_date: '2024-01-15',
        merchant_name: 'Sample Store',
        category: 'food',
        tax_amount: 2.08,
        payment_method: 'credit_card',
        is_business_expense: 'false',
        is_tax_deductible: 'false',
        is_reimbursable: 'false',
        notes: 'Sample notes'
      }
    ];
    
    let blob: Blob;
    let filename: string;
    
    if (importFormat === 'csv') {
      const headers = Object.keys(template[0]).join(',');
      const csvContent = [headers, ...template.map(row => 
        Object.values(row).map(value => `"${value}"`).join(',')
      )].join('\n');
      
      blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      filename = `receipt-import-template.csv`;
    } else if (importFormat === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(template);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
      
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      filename = `receipt-import-template.xlsx`;
    } else {
      blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json;charset=utf-8;' });
      filename = `receipt-import-template.json`;
    }
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Receipts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Total Receipts</Label>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Database className="w-4 h-4" />
                <span>{receipts.length} receipts available</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Action</Label>
              <Button 
                onClick={handleExport} 
                disabled={exporting || receipts.length === 0}
                className="w-full"
              >
                {exporting ? (
                  <>Exporting...</>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export {exportFormat.toUpperCase()}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Receipts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Import Format</Label>
              <Select value={importFormat} onValueChange={(value: any) => setImportFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Template</Label>
              <Button variant="outline" onClick={downloadTemplate} className="w-full">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label>Select File</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept={importFormat === 'csv' ? '.csv' : importFormat === 'xlsx' ? '.xlsx,.xls' : '.json'}
                onChange={handleFileImport}
                disabled={importing}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="text-sm text-gray-600">
                {importing ? 'Importing...' : 'Ready to import'}
              </div>
            </div>
          </div>
          
          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing receipts...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
          )}
          
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Required fields: name, total_amount, receipt_date. 
              Download a template to see the expected format.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.errors.length === 0 ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              )}
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
                <div className="text-sm text-gray-600">Successful</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{importResult.errors.length}</div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{importResult.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
            
            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-red-600">Errors:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.errors.slice(0, 10).map((error, index) => (
                    <div key={index} className="text-sm bg-red-50 p-2 rounded">
                      <span className="font-medium">Row {error.row}:</span> {error.message} 
                      <span className="text-gray-600">({error.field})</span>
                    </div>
                  ))}
                  {importResult.errors.length > 10 && (
                    <div className="text-sm text-gray-500">
                      ... and {importResult.errors.length - 10} more errors
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}