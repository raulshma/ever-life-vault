/**
 * Unit tests for ReceiptValidationService
 * Tests comprehensive validation logic, business rules, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ReceiptValidationService, 
  receiptValidationService,
  DEFAULT_BUSINESS_RULES,
  ReceiptDataSchema,
  FileUploadSchema,
  BulkImportSchema
} from '@/services/ReceiptValidationService';

describe('ReceiptValidationService', () => {
  let validationService: ReceiptValidationService;

  beforeEach(() => {
    validationService = new ReceiptValidationService();
  });

  describe('Receipt Data Validation', () => {
    const validReceiptData = {
      name: 'Test Receipt',
      merchant_name: 'Test Store',
      total_amount: 25.99,
      receipt_date: '2024-01-15',
      currency: 'USD',
      tax_amount: 2.00,
      category: 'food_dining',
      subcategory: 'restaurant',
      payment_method: 'credit_card',
      is_business_expense: false,
      is_tax_deductible: false,
      is_reimbursable: false,
      notes: 'Test notes',
      tags: ['food', 'lunch']
    };

    it('should validate correct receipt data', () => {
      const result = validationService.validateReceiptData(validReceiptData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(validReceiptData);
    });

    it('should require name field', () => {
      const invalidData = { ...validReceiptData, name: '' };
      const result = validationService.validateReceiptData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'name',
          code: 'too_small'
        })
      );
    });

    it('should validate total amount is positive', () => {
      const invalidData = { ...validReceiptData, total_amount: -10 };
      const result = validationService.validateReceiptData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'total_amount',
          message: 'Total amount must be positive'
        })
      );
    });

    it('should validate total amount has max 2 decimal places', () => {
      const invalidData = { ...validReceiptData, total_amount: 25.999 };
      const result = validationService.validateReceiptData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'total_amount',
          message: 'Total amount can have at most 2 decimal places'
        })
      );
    });

    it('should validate receipt date format', () => {
      const invalidData = { ...validReceiptData, receipt_date: '15/01/2024' };
      const result = validationService.validateReceiptData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'receipt_date',
          message: 'Receipt date must be in YYYY-MM-DD format'
        })
      );
    });

    it('should validate currency is ISO 4217 format', () => {
      const invalidData = { ...validReceiptData, currency: 'us' };
      const result = validationService.validateReceiptData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'currency',
          message: 'Currency must be a 3-letter ISO code'
        })
      );
    });

    it('should validate category format', () => {
      const invalidData = { ...validReceiptData, category: 'Food & Dining' };
      const result = validationService.validateReceiptData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'category',
          message: 'Category must be lowercase with underscores only'
        })
      );
    });

    it('should validate payment method enum', () => {
      const invalidData = { ...validReceiptData, payment_method: 'cryptocurrency' };
      const result = validationService.validateReceiptData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'payment_method'
        })
      );
    });

    it('should limit tags array length', () => {
      const invalidData = { 
        ...validReceiptData, 
        tags: new Array(25).fill('tag') // More than 20 tags
      };
      const result = validationService.validateReceiptData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'tags',
          message: 'Cannot have more than 20 tags'
        })
      );
    });

    it('should validate notes length', () => {
      const invalidData = { 
        ...validReceiptData, 
        notes: 'x'.repeat(1001) // More than 1000 characters
      };
      const result = validationService.validateReceiptData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'notes',
          message: 'Notes cannot exceed 1000 characters'
        })
      );
    });
  });

  describe('Business Rules Validation', () => {
    const validData = {
      name: 'Test Receipt',
      total_amount: 100.00,
      receipt_date: '2024-01-15',
      category: 'business',
      tax_amount: 50.00,
      is_business_expense: true,
      is_tax_deductible: false
    };

    it('should warn when tax amount exceeds total amount', () => {
      const invalidData = { ...validData, tax_amount: 150.00 };
      const result = validationService.validateReceiptData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'tax_amount',
          code: 'TAX_EXCEEDS_TOTAL',
          message: 'Tax amount cannot exceed total amount'
        })
      );
    });

    it('should warn about high tax rates', () => {
      const highTaxData = { ...validData, tax_amount: 60.00 }; // 60% tax rate
      const result = validationService.validateReceiptData(highTaxData);
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'tax_amount',
          code: 'HIGH_TAX_RATE',
          message: expect.stringContaining('Tax rate appears unusually high')
        })
      );
    });

    it('should suggest tax deductible for business expenses', () => {
      const businessData = { 
        ...validData, 
        is_business_expense: true,
        is_tax_deductible: false 
      };
      const result = validationService.validateReceiptData(businessData);
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'is_tax_deductible',
          code: 'BUSINESS_NOT_DEDUCTIBLE',
          message: 'Business expenses are typically tax deductible'
        })
      );
    });

    it('should warn about large amounts', () => {
      const largeAmountData = { ...validData, total_amount: 15000.00 };
      const result = validationService.validateReceiptData(largeAmountData);
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'total_amount',
          code: 'LARGE_AMOUNT',
          message: 'Unusually large amount detected'
        })
      );
    });
  });

  describe('File Upload Validation', () => {
    const createMockFile = (
      name: string, 
      size: number, 
      type: string, 
      lastModified: number = Date.now()
    ): File => {
      const file = new File(['content'], name, { type, lastModified });
      Object.defineProperty(file, 'size', { value: size });
      return file;
    };

    it('should validate correct file upload', () => {
      const file = createMockFile('receipt.jpg', 1024 * 1024, 'image/jpeg');
      const result = validationService.validateFileUpload(file);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files that are too large', () => {
      const file = createMockFile('large-receipt.jpg', 15 * 1024 * 1024, 'image/jpeg');
      const result = validationService.validateFileUpload(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'size',
          message: 'File size cannot exceed 10MB'
        })
      );
    });

    it('should reject unsupported file types', () => {
      const file = createMockFile('receipt.txt', 1024, 'text/plain');
      const result = validationService.validateFileUpload(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'type',
          message: 'File type must be JPEG, PNG, WebP, or PDF'
        })
      );
    });

    it('should reject empty files', () => {
      const file = createMockFile('empty-receipt.jpg', 0, 'image/jpeg');
      const result = validationService.validateFileUpload(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'size',
          code: 'EMPTY_FILE',
          message: 'File appears to be empty'
        })
      );
    });

    it('should warn about extension/MIME type mismatch', () => {
      const file = createMockFile('receipt.txt', 1024, 'image/jpeg');
      const result = validationService.validateFileUpload(file);
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'type',
          code: 'EXTENSION_MISMATCH',
          message: expect.stringContaining('File extension "txt" doesn\'t match MIME type')
        })
      );
    });
  });

  describe('Bulk Import Validation', () => {
    const validBulkData = {
      receipts: [
        {
          name: 'Receipt 1',
          total_amount: 25.99,
          receipt_date: '2024-01-15',
          category: 'food_dining'
        },
        {
          name: 'Receipt 2',
          total_amount: 15.50,
          receipt_date: '2024-01-16',
          category: 'transportation'
        }
      ],
      validateOnly: false,
      skipDuplicates: true,
      overwriteExisting: false
    };

    it('should validate correct bulk import data', () => {
      const result = validationService.validateBulkImport(validBulkData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require at least one receipt', () => {
      const invalidData = { ...validBulkData, receipts: [] };
      const result = validationService.validateBulkImport(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'receipts',
          message: 'At least one receipt is required'
        })
      );
    });

    it('should limit maximum receipts per import', () => {
      const invalidData = { 
        ...validBulkData, 
        receipts: new Array(1001).fill(validBulkData.receipts[0])
      };
      const result = validationService.validateBulkImport(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'receipts',
          message: 'Cannot import more than 1000 receipts at once'
        })
      );
    });

    it('should validate individual receipts in bulk', () => {
      const invalidData = {
        ...validBulkData,
        receipts: [
          ...validBulkData.receipts,
          { name: '', total_amount: -10, receipt_date: 'invalid', category: 'invalid' }
        ]
      };
      const result = validationService.validateBulkImport(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field.includes('receipts[2]'))).toBe(true);
    });

    it('should detect duplicates within batch', () => {
      const duplicateData = {
        ...validBulkData,
        receipts: [
          {
            name: 'Receipt 1',
            merchant_name: 'Same Store',
            total_amount: 25.99,
            receipt_date: '2024-01-15',
            category: 'food_dining'
          },
          {
            name: 'Receipt 2',
            merchant_name: 'Same Store',
            total_amount: 25.99,
            receipt_date: '2024-01-15',
            category: 'food_dining'
          }
        ]
      };
      const result = validationService.validateBulkImport(duplicateData);
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'DUPLICATE_DETECTED',
          message: expect.stringContaining('Duplicate receipt detected')
        })
      );
    });
  });

  describe('Data Sanitization', () => {
    it('should trim whitespace from string fields', () => {
      const dirtyData = {
        name: '  Test Receipt  ',
        merchant_name: '  Test Store  ',
        notes: '  Test notes  ',
        category: '  food_dining  '
      };

      const result = validationService.sanitizeReceiptData(dirtyData);
      
      expect(result.sanitized.name).toBe('Test Receipt');
      expect(result.sanitized.merchant_name).toBe('Test Store');
      expect(result.sanitized.notes).toBe('Test notes');
      expect(result.sanitized.category).toBe('food_dining');
      expect(result.changes).toHaveLength(4);
    });

    it('should normalize merchant names', () => {
      const data = { merchant_name: 'mcdonald\'s #123!!!' };
      const result = validationService.sanitizeReceiptData(data);
      
      expect(result.sanitized.merchant_name).toBe('Mcdonald S 123');
      expect(result.changes).toContainEqual(
        expect.objectContaining({
          field: 'merchant_name',
          reason: 'Normalized merchant name format'
        })
      );
    });

    it('should round amounts to 2 decimal places', () => {
      const data = { total_amount: 25.999, tax_amount: 2.555 };
      const result = validationService.sanitizeReceiptData(data);
      
      expect(result.sanitized.total_amount).toBe(26.00);
      expect(result.sanitized.tax_amount).toBe(2.56);
      expect(result.changes).toHaveLength(2);
    });

    it('should normalize categories', () => {
      const data = { category: 'Food & Dining' };
      const result = validationService.sanitizeReceiptData(data);
      
      expect(result.sanitized.category).toBe('food_&_dining');
      expect(result.changes).toContainEqual(
        expect.objectContaining({
          field: 'category',
          reason: 'Normalized category format'
        })
      );
    });

    it('should clean and deduplicate tags', () => {
      const data = { tags: ['  food  ', 'LUNCH', 'food', '', 'dining'] };
      const result = validationService.sanitizeReceiptData(data);
      
      expect(result.sanitized.tags).toEqual(['food', 'lunch', 'dining']);
      expect(result.changes).toContainEqual(
        expect.objectContaining({
          field: 'tags',
          reason: 'Cleaned and deduplicated tags'
        })
      );
    });
  });

  describe('Business Rules Configuration', () => {
    it('should use default business rules', () => {
      const rules = validationService.getBusinessRules();
      expect(rules).toEqual(DEFAULT_BUSINESS_RULES);
    });

    it('should allow updating business rules', () => {
      const newRules = { maxReceiptsPerUser: 5000, maxFileSize: 5 * 1024 * 1024 };
      validationService.updateBusinessRules(newRules);
      
      const updatedRules = validationService.getBusinessRules();
      expect(updatedRules.maxReceiptsPerUser).toBe(5000);
      expect(updatedRules.maxFileSize).toBe(5 * 1024 * 1024);
    });
  });

  describe('Singleton Instance', () => {
    it('should provide a singleton instance', () => {
      expect(receiptValidationService).toBeInstanceOf(ReceiptValidationService);
    });

    it('should maintain state across calls', () => {
      receiptValidationService.updateBusinessRules({ maxReceiptsPerUser: 8000 });
      const rules = receiptValidationService.getBusinessRules();
      expect(rules.maxReceiptsPerUser).toBe(8000);
    });
  });

  describe('Schema Exports', () => {
    it('should export Zod schemas', () => {
      expect(ReceiptDataSchema).toBeDefined();
      expect(FileUploadSchema).toBeDefined();
      expect(BulkImportSchema).toBeDefined();
    });

    it('should validate with exported schemas directly', () => {
      const validData = {
        name: 'Test Receipt',
        total_amount: 25.99,
        receipt_date: '2024-01-15',
        category: 'food_dining'
      };

      const result = ReceiptDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed data gracefully', () => {
      const malformedData = { circular: {} };
      malformedData.circular = malformedData; // Create circular reference
      
      const result = validationService.validateReceiptData(malformedData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should provide helpful error suggestions', () => {
      const invalidData = { 
        name: '',
        total_amount: 'not-a-number',
        receipt_date: 'invalid-date'
      };
      
      const result = validationService.validateReceiptData(invalidData);
      expect(result.errors.every(error => error.suggestion)).toBe(true);
    });
  });
});