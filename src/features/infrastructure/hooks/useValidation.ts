import { useState, useCallback, useMemo } from 'react';
import { 
  validateDockerComposeConfig, 
  validateServiceName, 
  validateDockerImage, 
  validatePortMapping, 
  validateEnvironmentVariable, 
  validateVolumeMount,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning
} from '../validation/schemas';
import type { DockerComposeConfig, ServiceDefinition, PortMapping, EnvironmentVariable, VolumeMount } from '../types';

export interface UseValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  validateConfig: (config: Partial<DockerComposeConfig>) => ValidationResult;
  validateService: (service: ServiceDefinition) => ValidationResult;
  validateField: (field: string, value: any) => ValidationResult;
  getFieldErrors: (field: string) => ValidationError[];
  getFieldWarnings: (field: string) => ValidationWarning[];
  clearErrors: () => void;
}

export function useValidation(): UseValidationResult {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);

  const validateConfig = useCallback((config: Partial<DockerComposeConfig>): ValidationResult => {
    const result = validateDockerComposeConfig(config);
    setErrors(result.errors);
    setWarnings(result.warnings);
    return result;
  }, []);

  const validateService = useCallback((service: ServiceDefinition): ValidationResult => {
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];

    // Validate service name
    const nameResult = validateServiceName(service.name);
    allErrors.push(...nameResult.errors);
    allWarnings.push(...nameResult.warnings);

    // Validate docker image
    const imageResult = validateDockerImage(service.image);
    allErrors.push(...imageResult.errors);
    allWarnings.push(...imageResult.warnings);

    // Validate ports
    service.ports.forEach((port, index) => {
      const portResult = validatePortMapping(port);
      const portErrors = portResult.errors.map(err => ({
        ...err,
        field: `ports.${index}.${err.field}`,
        path: ['ports', index.toString(), ...(err.path || [])]
      }));
      const portWarnings = portResult.warnings.map(warn => ({
        ...warn,
        field: `ports.${index}.${warn.field}`,
        path: ['ports', index.toString(), ...(warn.path || [])]
      }));
      allErrors.push(...portErrors);
      allWarnings.push(...portWarnings);
    });

    // Validate environment variables
    service.environment.forEach((env, index) => {
      const envResult = validateEnvironmentVariable(env);
      const envErrors = envResult.errors.map(err => ({
        ...err,
        field: `environment.${index}.${err.field}`,
        path: ['environment', index.toString(), ...(err.path || [])]
      }));
      const envWarnings = envResult.warnings.map(warn => ({
        ...warn,
        field: `environment.${index}.${warn.field}`,
        path: ['environment', index.toString(), ...(warn.path || [])]
      }));
      allErrors.push(...envErrors);
      allWarnings.push(...envWarnings);
    });

    // Validate volume mounts
    service.volumes.forEach((volume, index) => {
      const volumeResult = validateVolumeMount(volume);
      const volumeErrors = volumeResult.errors.map(err => ({
        ...err,
        field: `volumes.${index}.${err.field}`,
        path: ['volumes', index.toString(), ...(err.path || [])]
      }));
      const volumeWarnings = volumeResult.warnings.map(warn => ({
        ...warn,
        field: `volumes.${index}.${warn.field}`,
        path: ['volumes', index.toString(), ...(warn.path || [])]
      }));
      allErrors.push(...volumeErrors);
      allWarnings.push(...volumeWarnings);
    });

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }, []);

  const validateField = useCallback((field: string, value: any): ValidationResult => {
    switch (field) {
      case 'serviceName':
        return validateServiceName(value);
      case 'dockerImage':
        return validateDockerImage(value);
      case 'portMapping':
        return validatePortMapping(value);
      case 'environmentVariable':
        return validateEnvironmentVariable(value);
      case 'volumeMount':
        return validateVolumeMount(value);
      default:
        return { valid: true, errors: [], warnings: [] };
    }
  }, []);

  const getFieldErrors = useCallback((field: string): ValidationError[] => {
    return errors.filter(error => error.field === field || error.field.startsWith(`${field}.`));
  }, [errors]);

  const getFieldWarnings = useCallback((field: string): ValidationWarning[] => {
    return warnings.filter(warning => warning.field === field || warning.field.startsWith(`${field}.`));
  }, [warnings]);

  const clearErrors = useCallback(() => {
    setErrors([]);
    setWarnings([]);
  }, []);

  const isValid = useMemo(() => errors.length === 0, [errors]);
  const hasErrors = useMemo(() => errors.length > 0, [errors]);
  const hasWarnings = useMemo(() => warnings.length > 0, [warnings]);

  return {
    errors,
    warnings,
    isValid,
    hasErrors,
    hasWarnings,
    validateConfig,
    validateService,
    validateField,
    getFieldErrors,
    getFieldWarnings,
    clearErrors
  };
}

// Hook for real-time field validation
export function useFieldValidation(field: string, value: any, validateOnChange = true) {
  const [fieldErrors, setFieldErrors] = useState<ValidationError[]>([]);
  const [fieldWarnings, setFieldWarnings] = useState<ValidationWarning[]>([]);

  const validateFieldValue = useCallback((fieldValue: any) => {
    let result: ValidationResult;
    
    switch (field) {
      case 'serviceName':
        result = validateServiceName(fieldValue);
        break;
      case 'dockerImage':
        result = validateDockerImage(fieldValue);
        break;
      case 'portMapping':
        result = validatePortMapping(fieldValue);
        break;
      case 'environmentVariable':
        result = validateEnvironmentVariable(fieldValue);
        break;
      case 'volumeMount':
        result = validateVolumeMount(fieldValue);
        break;
      default:
        result = { valid: true, errors: [], warnings: [] };
    }
    
    setFieldErrors(result.errors);
    setFieldWarnings(result.warnings);
    return result;
  }, [field]);

  // Validate on value change if enabled
  useMemo(() => {
    if (validateOnChange && value !== undefined && value !== null && value !== '') {
      validateFieldValue(value);
    }
  }, [value, validateOnChange, validateFieldValue]);

  return {
    errors: fieldErrors,
    warnings: fieldWarnings,
    isValid: fieldErrors.length === 0,
    hasErrors: fieldErrors.length > 0,
    hasWarnings: fieldWarnings.length > 0,
    validate: validateFieldValue,
    clearErrors: () => {
      setFieldErrors([]);
      setFieldWarnings([]);
    }
  };
}

// Hook for server-side validation integration
export function useServerValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [serverErrors, setServerErrors] = useState<ValidationError[]>([]);

  const validateWithServer = useCallback(async (config: Partial<DockerComposeConfig>) => {
    setIsValidating(true);
    setServerErrors([]);

    try {
      // TODO: Replace with actual API call to server validation endpoint
      const response = await fetch('/api/infrastructure/configs/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Server validation failed');
      }

      const result = await response.json();
      
      if (!result.valid) {
        setServerErrors(result.errors || []);
      }

      return result;
    } catch (error) {
      console.error('Server validation error:', error);
      setServerErrors([{
        field: 'server',
        message: 'Unable to validate configuration with server. Please check your connection and try again.'
      }]);
      return {
        valid: false,
        errors: serverErrors,
        warnings: []
      };
    } finally {
      setIsValidating(false);
    }
  }, [serverErrors]);

  return {
    isValidating,
    serverErrors,
    validateWithServer,
    clearServerErrors: () => setServerErrors([])
  };
}

// Common validation error messages for user-friendly display
export const ValidationMessages = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_FORMAT: 'Invalid format',
  DUPLICATE_VALUE: 'Duplicate values are not allowed',
  SECURITY_WARNING: 'This configuration may pose security risks',
  PERFORMANCE_WARNING: 'This configuration may impact performance',
  BEST_PRACTICE: 'Consider following Docker best practices',
  
  // Service-specific messages
  SERVICE_NAME_INVALID: 'Service name must contain only lowercase letters, numbers, and hyphens',
  IMAGE_INVALID: 'Invalid Docker image format',
  PORT_RESERVED: 'This port is reserved or requires special privileges',
  PORT_CONFLICT: 'Port conflict detected',
  ENVIRONMENT_INVALID: 'Environment variable format is invalid',
  VOLUME_DANGEROUS: 'Mounting this path may be dangerous',
  DEPENDENCY_CIRCULAR: 'Circular dependency detected',
  DEPENDENCY_MISSING: 'Referenced service does not exist'
} as const;