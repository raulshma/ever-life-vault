/**
 * Validation Hook
 * React hook for integrating validation services with components
 * providing real-time validation, error handling, and form state management.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  receiptValidationService, 
  ValidationResult, 
  ValidationError, 
  ValidationWarning 
} from '@/services/ReceiptValidationService';
import { errorHandlingService } from '@/services/ErrorHandlingService';
import { useToast } from '@/hooks/use-toast';

export interface ValidationState {
  isValidating: boolean;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  hasBeenValidated: boolean;
  validatedData?: any;
}

export interface ValidationHookOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  showToasts?: boolean;
  autoSanitize?: boolean;
  validateAsync?: boolean;
}

export interface FieldValidationState {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  hasBeenTouched: boolean;
}

export function useValidation(options: ValidationHookOptions = {}) {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    debounceMs = 300,
    showToasts = false,
    autoSanitize = true,
    validateAsync = false
  } = options;

  const { toast } = useToast();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const [validationState, setValidationState] = useState<ValidationState>({
    isValidating: false,
    isValid: false,
    errors: [],
    warnings: [],
    hasBeenValidated: false,
    validatedData: undefined
  });

  const [fieldStates, setFieldStates] = useState<Record<string, FieldValidationState>>({});

  /**
   * Validate receipt data
   */
  const validateReceiptData = useCallback(async (data: any): Promise<ValidationResult> => {
    try {
      setValidationState(prev => ({ ...prev, isValidating: true }));

      let processedData = data;
      
      // Auto-sanitize if enabled
      if (autoSanitize) {
        const sanitizationResult = receiptValidationService.sanitizeReceiptData(data);
        processedData = sanitizationResult.sanitized;
        
        if (sanitizationResult.changes.length > 0 && showToasts) {
          toast({
            title: "Data Sanitized",
            description: `${sanitizationResult.changes.length} fields were automatically cleaned`,
            variant: "default"
          });
        }
      }

      // Perform validation
      const result = validateAsync 
        ? await Promise.resolve(receiptValidationService.validateReceiptData(processedData))
        : receiptValidationService.validateReceiptData(processedData);

      // Update validation state
      setValidationState({
        isValidating: false,
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
        hasBeenValidated: true,
        validatedData: result.data
      });

      // Show validation errors as toasts if enabled
      if (showToasts && result.errors.length > 0) {
        toast({
          title: "Validation Errors",
          description: `${result.errors.length} validation errors found`,
          variant: "destructive"
        });
      }

      return result;
    } catch (error) {
      const appError = errorHandlingService.handleError(error, {
        component: 'useValidation',
        operation: 'validateReceiptData'
      });

      setValidationState({
        isValidating: false,
        isValid: false,
        errors: [{
          field: 'general',
          message: appError.userMessage,
          code: appError.code,
          severity: 'error'
        }],
        warnings: [],
        hasBeenValidated: true,
        validatedData: undefined
      });

      return {
        isValid: false,
        errors: [{
          field: 'general',
          message: appError.userMessage,
          code: appError.code,
          severity: 'error'
        }],
        warnings: []
      };
    }
  }, [autoSanitize, showToasts, validateAsync, toast]);

  /**
   * Validate file upload
   */
  const validateFileUpload = useCallback(async (file: File): Promise<ValidationResult> => {
    try {
      setValidationState(prev => ({ ...prev, isValidating: true }));

      const result = receiptValidationService.validateFileUpload(file);

      setValidationState({
        isValidating: false,
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
        hasBeenValidated: true,
        validatedData: result.data
      });

      if (showToasts) {
        if (result.errors.length > 0) {
          toast({
            title: "File Validation Error",
            description: result.errors[0].message,
            variant: "destructive"
          });
        } else if (result.warnings.length > 0) {
          toast({
            title: "File Warning",
            description: result.warnings[0].message,
            variant: "default"
          });
        }
      }

      return result;
    } catch (error) {
      const appError = errorHandlingService.handleError(error, {
        component: 'useValidation',
        operation: 'validateFileUpload'
      });

      const errorResult = {
        isValid: false,
        errors: [{
          field: 'file',
          message: appError.userMessage,
          code: appError.code,
          severity: 'error' as const
        }],
        warnings: []
      };

      setValidationState({
        isValidating: false,
        isValid: false,
        errors: errorResult.errors,
        warnings: [],
        hasBeenValidated: true,
        validatedData: undefined
      });

      return errorResult;
    }
  }, [showToasts, toast]);

  /**
   * Validate bulk import data
   */
  const validateBulkImport = useCallback(async (data: any): Promise<ValidationResult> => {
    try {
      setValidationState(prev => ({ ...prev, isValidating: true }));

      const result = receiptValidationService.validateBulkImport(data);

      setValidationState({
        isValidating: false,
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
        hasBeenValidated: true,
        validatedData: result.data
      });

      if (showToasts) {
        if (result.errors.length > 0) {
          toast({
            title: "Bulk Import Validation Failed",
            description: `${result.errors.length} validation errors found`,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Bulk Import Validated",
            description: `${data.receipts?.length || 0} receipts ready for import`,
            variant: "default"
          });
        }
      }

      return result;
    } catch (error) {
      const appError = errorHandlingService.handleError(error, {
        component: 'useValidation',
        operation: 'validateBulkImport'
      });

      const errorResult = {
        isValid: false,
        errors: [{
          field: 'general',
          message: appError.userMessage,
          code: appError.code,
          severity: 'error' as const
        }],
        warnings: []
      };

      setValidationState({
        isValidating: false,
        isValid: false,
        errors: errorResult.errors,
        warnings: [],
        hasBeenValidated: true,
        validatedData: undefined
      });

      return errorResult;
    }
  }, [showToasts, toast]);

  /**
   * Validate specific field
   */
  const validateField = useCallback((fieldName: string, value: any, schema?: any): FieldValidationState => {
    try {
      // Mark field as touched
      setFieldStates(prev => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          hasBeenTouched: true
        }
      }));

      // For now, we'll do basic validation
      // This could be extended to use field-specific schemas
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // Basic required field validation
      if (value === undefined || value === null || value === '') {
        errors.push({
          field: fieldName,
          message: `${fieldName} is required`,
          code: 'REQUIRED_FIELD',
          severity: 'error'
        });
      }

      // Field-specific validation
      if (fieldName === 'total_amount' && typeof value === 'number') {
        if (value <= 0) {
          errors.push({
            field: fieldName,
            message: 'Amount must be positive',
            code: 'INVALID_AMOUNT',
            severity: 'error'
          });
        }
        if (value > 999999.99) {
          errors.push({
            field: fieldName,
            message: 'Amount is unusually large',
            code: 'LARGE_AMOUNT',
            severity: 'error'
          });
        }
      }

      if (fieldName === 'receipt_date' && typeof value === 'string') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          errors.push({
            field: fieldName,
            message: 'Invalid date format',
            code: 'INVALID_DATE',
            severity: 'error'
          });
        } else if (date > new Date()) {
          warnings.push({
            field: fieldName,
            message: 'Future date detected',
            code: 'FUTURE_DATE',
            impact: 'medium',
            suggestion: 'Verify the date is correct'
          });
        }
      }

      const fieldState: FieldValidationState = {
        isValid: errors.length === 0,
        errors,
        warnings,
        hasBeenTouched: true
      };

      setFieldStates(prev => ({
        ...prev,
        [fieldName]: fieldState
      }));

      return fieldState;
    } catch (error) {
      const fieldState: FieldValidationState = {
        isValid: false,
        errors: [{
          field: fieldName,
          message: 'Validation error occurred',
          code: 'VALIDATION_ERROR',
          severity: 'error'
        }],
        warnings: [],
        hasBeenTouched: true
      };

      setFieldStates(prev => ({
        ...prev,
        [fieldName]: fieldState
      }));

      return fieldState;
    }
  }, []);

  /**
   * Debounced validation for real-time validation
   */
  const debouncedValidate = useCallback((data: any) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      validateReceiptData(data);
    }, debounceMs);
  }, [validateReceiptData, debounceMs]);

  /**
   * Clear validation state
   */
  const clearValidation = useCallback(() => {
    setValidationState({
      isValidating: false,
      isValid: false,
      errors: [],
      warnings: [],
      hasBeenValidated: false,
      validatedData: undefined
    });
    setFieldStates({});
  }, []);

  /**
   * Mark field as touched
   */
  const touchField = useCallback((fieldName: string) => {
    setFieldStates(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        hasBeenTouched: true,
        isValid: prev[fieldName]?.isValid ?? true,
        errors: prev[fieldName]?.errors ?? [],
        warnings: prev[fieldName]?.warnings ?? []
      }
    }));
  }, []);

  /**
   * Get validation summary
   */
  const validationSummary = useMemo(() => {
    const totalErrors = validationState.errors.length;
    const totalWarnings = validationState.warnings.length;
    const fieldErrors = Object.values(fieldStates).reduce((sum, field) => sum + field.errors.length, 0);
    const fieldWarnings = Object.values(fieldStates).reduce((sum, field) => sum + field.warnings.length, 0);

    return {
      hasErrors: totalErrors > 0 || fieldErrors > 0,
      hasWarnings: totalWarnings > 0 || fieldWarnings > 0,
      totalErrors: totalErrors + fieldErrors,
      totalWarnings: totalWarnings + fieldWarnings,
      isValid: validationState.isValid && Object.values(fieldStates).every(field => field.isValid),
      hasBeenValidated: validationState.hasBeenValidated
    };
  }, [validationState, fieldStates]);

  /**
   * Get errors for a specific field
   */
  const getFieldErrors = useCallback((fieldName: string): ValidationError[] => {
    return fieldStates[fieldName]?.errors || [];
  }, [fieldStates]);

  /**
   * Get warnings for a specific field
   */
  const getFieldWarnings = useCallback((fieldName: string): ValidationWarning[] => {
    return fieldStates[fieldName]?.warnings || [];
  }, [fieldStates]);

  /**
   * Check if field is valid
   */
  const isFieldValid = useCallback((fieldName: string): boolean => {
    return fieldStates[fieldName]?.isValid ?? true;
  }, [fieldStates]);

  /**
   * Check if field has been touched
   */
  const isFieldTouched = useCallback((fieldName: string): boolean => {
    return fieldStates[fieldName]?.hasBeenTouched ?? false;
  }, [fieldStates]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    // Validation state
    validationState,
    fieldStates,
    validationSummary,

    // Validation methods
    validateReceiptData,
    validateFileUpload,
    validateBulkImport,
    validateField,
    debouncedValidate,

    // State management
    clearValidation,
    touchField,

    // Field helpers
    getFieldErrors,
    getFieldWarnings,
    isFieldValid,
    isFieldTouched,

    // Computed properties
    isValidating: validationState.isValidating,
    isValid: validationSummary.isValid,
    hasErrors: validationSummary.hasErrors,
    hasWarnings: validationSummary.hasWarnings,
    errors: validationState.errors,
    warnings: validationState.warnings
  };
}

/**
 * Hook for form validation with enhanced features
 */
export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  options: ValidationHookOptions = {}
) {
  const validation = useValidation(options);
  const [values, setValues] = useState<T>(initialValues);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const setValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    if (options.validateOnChange) {
      validation.validateField(field as string, value);
    }
  }, [validation, options.validateOnChange]);

  const setFieldTouched = useCallback((field: keyof T) => {
    setTouchedFields(prev => new Set(prev).add(field as string));
    validation.touchField(field as string);
    
    if (options.validateOnBlur) {
      validation.validateField(field as string, values[field]);
    }
  }, [validation, values, options.validateOnBlur]);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setTouchedFields(new Set());
    validation.clearValidation();
  }, [initialValues, validation]);

  const validateForm = useCallback(async () => {
    return await validation.validateReceiptData(values);
  }, [validation, values]);

  const isFieldTouched = useCallback((field: keyof T) => {
    return touchedFields.has(field as string);
  }, [touchedFields]);

  return {
    ...validation,
    values,
    setValue,
    setFieldTouched,
    resetForm,
    validateForm,
    isFieldTouched: isFieldTouched,
    touchedFields: Array.from(touchedFields)
  };
}