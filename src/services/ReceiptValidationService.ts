/**
 * Receipt Data Validation Service
 * Provides comprehensive validation for receipt data including file validation,
 * data integrity checks, business rule validation, and sanitization.
 */

import { z } from 'zod';

// Validation schemas
export const ReceiptDataSchema = z.object({
  name: z.string()
    .min(1, 'Receipt name is required')
    .max(255, 'Receipt name cannot exceed 255 characters')
    .regex(/^[a-zA-Z0-9\s\-_.,!@#$%^&*()]+$/, 'Receipt name contains invalid characters'),
  
  merchant_name: z.string()
    .max(255, 'Merchant name cannot exceed 255 characters')
    .optional()
    .nullable(),
  
  total_amount: z.number()
    .positive('Total amount must be positive')
    .max(999999.99, 'Total amount cannot exceed $999,999.99')
    .refine((val) => Number.isFinite(val), 'Total amount must be a valid number')
    .refine((val) => Number(val.toFixed(2)) === val, 'Total amount can have at most 2 decimal places'),
  
  receipt_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Receipt date must be in YYYY-MM-DD format')
    .refine((date) => {
      const parsed = new Date(date);
      const today = new Date();
      const minDate = new Date('1900-01-01');
      const maxDate = new Date();
      maxDate.setDate(today.getDate() + 1); // Allow tomorrow for timezone differences
      
      return parsed >= minDate && parsed <= maxDate;
    }, 'Receipt date must be between 1900-01-01 and today'),
  
  currency: z.string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase ISO 4217 code')
    .default('USD'),
  
  tax_amount: z.number()
    .min(0, 'Tax amount cannot be negative')
    .max(999999.99, 'Tax amount cannot exceed $999,999.99')
    .optional()
    .nullable()
    .refine((val) => val === null || val === undefined || Number.isFinite(val), 'Tax amount must be a valid number'),
  
  category: z.string()
    .min(1, 'Category is required')
    .max(100, 'Category cannot exceed 100 characters')
    .regex(/^[a-z_]+$/, 'Category must be lowercase with underscores only'),
  
  subcategory: z.string()
    .max(100, 'Subcategory cannot exceed 100 characters')
    .regex(/^[a-z_]*$/, 'Subcategory must be lowercase with underscores only')
    .optional()
    .nullable(),
  
  payment_method: z.enum(['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'mobile_payment', 'other'])
    .optional()
    .nullable(),
  
  is_business_expense: z.boolean().optional().default(false),
  is_tax_deductible: z.boolean().optional().default(false),
  is_reimbursable: z.boolean().optional().default(false),
  
  notes: z.string()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .optional()
    .nullable(),
  
  tags: z.array(z.string().max(50, 'Tag cannot exceed 50 characters'))
    .max(20, 'Cannot have more than 20 tags')
    .optional()
    .default([])
});

export const FileUploadSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  size: z.number()
    .positive('File size must be positive')
    .max(10 * 1024 * 1024, 'File size cannot exceed 10MB'),
  type: z.string()
    .refine((type) => ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(type), 
            'File type must be JPEG, PNG, WebP, or PDF'),
  lastModified: z.number().positive('Last modified date is required')
});

export const BulkImportSchema = z.object({
  receipts: z.array(ReceiptDataSchema).min(1, 'At least one receipt is required').max(1000, 'Cannot import more than 1000 receipts at once'),
  validateOnly: z.boolean().optional().default(false),
  skipDuplicates: z.boolean().optional().default(true),
  overwriteExisting: z.boolean().optional().default(false)
});

// Validation result types
export interface ValidationResult<T = any> {
  isValid: boolean;
  data?: T;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  impact: 'low' | 'medium' | 'high';
  suggestion: string;
}

export interface SanitizationResult {
  original: any;
  sanitized: any;
  changes: Array<{
    field: string;
    from: any;
    to: any;
    reason: string;
  }>;
}

// Business rule validation
export interface BusinessRules {
  maxReceiptsPerUser: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  requiredFields: string[];
  duplicateDetectionFields: string[];
  currencyValidation: boolean;
  dateRangeValidation: boolean;
  amountValidation: boolean;
}

export const DEFAULT_BUSINESS_RULES: BusinessRules = {
  maxReceiptsPerUser: 10000,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  requiredFields: ['name', 'total_amount', 'receipt_date', 'category'],
  duplicateDetectionFields: ['merchant_name', 'total_amount', 'receipt_date'],
  currencyValidation: true,
  dateRangeValidation: true,
  amountValidation: true
};

export class ReceiptValidationService {
  private businessRules: BusinessRules;

  constructor(businessRules: BusinessRules = DEFAULT_BUSINESS_RULES) {
    this.businessRules = businessRules;
  }

  /**
   * Validate receipt data against schema and business rules
   */
  validateReceiptData(data: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Schema validation
      const schemaResult = ReceiptDataSchema.safeParse(data);
      
      if (!schemaResult.success) {
        schemaResult.error.errors.forEach(error => {
          errors.push({
            field: error.path.join('.'),
            message: error.message,
            code: error.code,
            severity: 'error',
            suggestion: this.getSuggestionForError(error.code, error.path.join('.'))
          });
        });
      }

      // Business rule validation
      if (schemaResult.success) {
        const businessValidation = this.validateBusinessRules(schemaResult.data);
        errors.push(...businessValidation.errors);
        warnings.push(...businessValidation.warnings);
      }

      // Data integrity checks
      const integrityValidation = this.validateDataIntegrity(data);
      warnings.push(...integrityValidation.warnings);

      return {
        isValid: errors.length === 0,
        data: schemaResult.success ? schemaResult.data : undefined,
        errors,
        warnings
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'general',
          message: 'Unexpected validation error occurred',
          code: 'VALIDATION_ERROR',
          severity: 'error'
        }],
        warnings: []
      };
    }
  }

  /**
   * Validate file upload
   */
  validateFileUpload(file: File): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const fileData = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    };

    const schemaResult = FileUploadSchema.safeParse(fileData);
    
    if (!schemaResult.success) {
      schemaResult.error.errors.forEach(error => {
        errors.push({
          field: error.path.join('.'),
          message: error.message,
          code: error.code,
          severity: 'error',
          suggestion: this.getFileSuggestion(error.code, error.path.join('.'))
        });
      });
    }

    // Additional file validation
    if (file.size === 0) {
      errors.push({
        field: 'size',
        message: 'File appears to be empty',
        code: 'EMPTY_FILE',
        severity: 'error',
        suggestion: 'Please select a valid file with content'
      });
    }

    // Check file extension matches MIME type
    const extension = file.name.split('.').pop()?.toLowerCase();
    const expectedExtensions = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
      'application/pdf': ['pdf']
    };

    const expected = expectedExtensions[file.type as keyof typeof expectedExtensions];
    if (expected && !expected.includes(extension || '')) {
      warnings.push({
        field: 'type',
        message: `File extension "${extension}" doesn't match MIME type "${file.type}"`,
        code: 'EXTENSION_MISMATCH',
        impact: 'medium',
        suggestion: 'Ensure the file extension matches the file type'
      });
    }

    return {
      isValid: errors.length === 0,
      data: schemaResult.success ? schemaResult.data : undefined,
      errors,
      warnings
    };
  }

  /**
   * Validate bulk import data
   */
  validateBulkImport(data: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const schemaResult = BulkImportSchema.safeParse(data);
    
    if (!schemaResult.success) {
      schemaResult.error.errors.forEach(error => {
        errors.push({
          field: error.path.join('.'),
          message: error.message,
          code: error.code,
          severity: 'error'
        });
      });
      
      return { isValid: false, errors, warnings };
    }

    // Validate individual receipts
    const receipts = schemaResult.data.receipts;
    const receiptErrors: ValidationError[] = [];
    
    receipts.forEach((receipt, index) => {
      const validation = this.validateReceiptData(receipt);
      validation.errors.forEach(error => {
        receiptErrors.push({
          ...error,
          field: `receipts[${index}].${error.field}`,
          message: `Receipt ${index + 1}: ${error.message}`
        });
      });
    });

    // Check for duplicates within the batch
    const duplicates = this.findDuplicatesInBatch(receipts);
    duplicates.forEach(duplicate => {
      warnings.push({
        field: `receipts[${duplicate.index}]`,
        message: `Duplicate receipt detected (similar to receipt ${duplicate.similarTo + 1})`,
        code: 'DUPLICATE_DETECTED',
        impact: 'medium',
        suggestion: 'Review and remove duplicate entries'
      });
    });

    return {
      isValid: errors.length === 0 && receiptErrors.length === 0,
      data: schemaResult.data,
      errors: [...errors, ...receiptErrors],
      warnings
    };
  }

  /**
   * Sanitize receipt data
   */
  sanitizeReceiptData(data: any): SanitizationResult {
    const original = { ...data };
    const sanitized = { ...data };
    const changes: SanitizationResult['changes'] = [];

    // Trim whitespace from string fields
    const stringFields = ['name', 'merchant_name', 'notes', 'category', 'subcategory'];
    stringFields.forEach(field => {
      if (typeof sanitized[field] === 'string') {
        const trimmed = sanitized[field].trim();
        if (trimmed !== sanitized[field]) {
          changes.push({
            field,
            from: sanitized[field],
            to: trimmed,
            reason: 'Removed leading/trailing whitespace'
          });
          sanitized[field] = trimmed;
        }
      }
    });

    // Normalize merchant name
    if (sanitized.merchant_name) {
      const normalized = this.normalizeMerchantName(sanitized.merchant_name);
      if (normalized !== sanitized.merchant_name) {
        changes.push({
          field: 'merchant_name',
          from: sanitized.merchant_name,
          to: normalized,
          reason: 'Normalized merchant name format'
        });
        sanitized.merchant_name = normalized;
      }
    }

    // Round amounts to 2 decimal places
    const amountFields = ['total_amount', 'tax_amount'];
    amountFields.forEach(field => {
      if (typeof sanitized[field] === 'number') {
        const rounded = Math.round(sanitized[field] * 100) / 100;
        if (rounded !== sanitized[field]) {
          changes.push({
            field,
            from: sanitized[field],
            to: rounded,
            reason: 'Rounded to 2 decimal places'
          });
          sanitized[field] = rounded;
        }
      }
    });

    // Normalize category
    if (sanitized.category) {
      const normalizedCategory = sanitized.category.toLowerCase().replace(/\s+/g, '_');
      if (normalizedCategory !== sanitized.category) {
        changes.push({
          field: 'category',
          from: sanitized.category,
          to: normalizedCategory,
          reason: 'Normalized category format'
        });
        sanitized.category = normalizedCategory;
      }
    }

    // Clean tags
    if (Array.isArray(sanitized.tags)) {
      const cleanedTags = sanitized.tags
        .map((tag: string) => tag.trim().toLowerCase())
        .filter((tag: string) => tag.length > 0)
        .filter((tag: string, index: number, arr: string[]) => arr.indexOf(tag) === index); // Remove duplicates
      
      if (JSON.stringify(cleanedTags) !== JSON.stringify(sanitized.tags)) {
        changes.push({
          field: 'tags',
          from: sanitized.tags,
          to: cleanedTags,
          reason: 'Cleaned and deduplicated tags'
        });
        sanitized.tags = cleanedTags;
      }
    }

    return { original, sanitized, changes };
  }

  /**
   * Validate business rules
   */
  private validateBusinessRules(data: any): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check tax amount vs total amount
    if (data.tax_amount && data.total_amount) {
      if (data.tax_amount > data.total_amount) {
        errors.push({
          field: 'tax_amount',
          message: 'Tax amount cannot exceed total amount',
          code: 'TAX_EXCEEDS_TOTAL',
          severity: 'error',
          suggestion: 'Verify the tax amount is correct'
        });
      }
      
      const taxRate = (data.tax_amount / data.total_amount) * 100;
      if (taxRate > 50) {
        warnings.push({
          field: 'tax_amount',
          message: `Tax rate appears unusually high (${taxRate.toFixed(1)}%)`,
          code: 'HIGH_TAX_RATE',
          impact: 'medium',
          suggestion: 'Verify the tax amount is correct'
        });
      }
    }

    // Check if business expense is tax deductible
    if (data.is_business_expense && !data.is_tax_deductible) {
      warnings.push({
        field: 'is_tax_deductible',
        message: 'Business expenses are typically tax deductible',
        code: 'BUSINESS_NOT_DEDUCTIBLE',
        impact: 'low',
        suggestion: 'Consider marking this as tax deductible'
      });
    }

    // Check for unusual amounts
    if (data.total_amount > 10000) {
      warnings.push({
        field: 'total_amount',
        message: 'Unusually large amount detected',
        code: 'LARGE_AMOUNT',
        impact: 'medium',
        suggestion: 'Verify the amount is correct'
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate data integrity
   */
  private validateDataIntegrity(data: any): { warnings: ValidationWarning[] } {
    const warnings: ValidationWarning[] = [];

    // Check for missing merchant name with substantial amount
    if (!data.merchant_name && data.total_amount > 50) {
      warnings.push({
        field: 'merchant_name',
        message: 'Missing merchant name for substantial amount',
        code: 'MISSING_MERCHANT',
        impact: 'low',
        suggestion: 'Adding merchant name improves expense tracking'
      });
    }

    // Check for very recent or future dates
    if (data.receipt_date) {
      const receiptDate = new Date(data.receipt_date);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      if (receiptDate > today) {
        warnings.push({
          field: 'receipt_date',
          message: 'Future date detected',
          code: 'FUTURE_DATE',
          impact: 'medium',
          suggestion: 'Verify the receipt date is correct'
        });
      }
    }

    return { warnings };
  }

  /**
   * Find duplicates in a batch of receipts
   */
  private findDuplicatesInBatch(receipts: any[]): Array<{ index: number; similarTo: number }> {
    const duplicates: Array<{ index: number; similarTo: number }> = [];
    
    for (let i = 0; i < receipts.length; i++) {
      for (let j = i + 1; j < receipts.length; j++) {
        if (this.areReceiptsSimilar(receipts[i], receipts[j])) {
          duplicates.push({ index: j, similarTo: i });
        }
      }
    }
    
    return duplicates;
  }

  /**
   * Check if two receipts are similar (potential duplicates)
   */
  private areReceiptsSimilar(receipt1: any, receipt2: any): boolean {
    const tolerance = 0.01; // $0.01 tolerance for amount differences
    
    return (
      receipt1.merchant_name === receipt2.merchant_name &&
      receipt1.receipt_date === receipt2.receipt_date &&
      Math.abs(receipt1.total_amount - receipt2.total_amount) <= tolerance
    );
  }

  /**
   * Normalize merchant name
   */
  private normalizeMerchantName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-zA-Z0-9\s\-&.]/g, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Get suggestion for validation errors
   */
  private getSuggestionForError(code: string, field: string): string | undefined {
    const suggestions: Record<string, string> = {
      'too_small': 'Please provide a valid value',
      'too_big': 'Please reduce the value',
      'invalid_type': 'Please provide the correct data type',
      'invalid_string': 'Please check the format and characters used',
      'invalid_date': 'Please use YYYY-MM-DD format',
      'custom': 'Please review and correct the value'
    };

    return suggestions[code];
  }

  /**
   * Get file-specific suggestions
   */
  private getFileSuggestion(code: string, field: string): string | undefined {
    if (field === 'size' && code === 'too_big') {
      return 'Please compress the image or choose a smaller file';
    }
    if (field === 'type') {
      return 'Please upload a JPEG, PNG, WebP, or PDF file';
    }
    return 'Please check the file and try again';
  }

  /**
   * Update business rules
   */
  updateBusinessRules(newRules: Partial<BusinessRules>): void {
    this.businessRules = { ...this.businessRules, ...newRules };
  }

  /**
   * Get current business rules
   */
  getBusinessRules(): BusinessRules {
    return { ...this.businessRules };
  }
}

// Export singleton instance
export const receiptValidationService = new ReceiptValidationService();