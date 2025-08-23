import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  InfrastructureError, 
  parseErrorFromResponse, 
  showErrorToast, 
  showSuccessToast,
  showWarningToast,
  showInfoToast 
} from '../utils/errorHandling';
import { useRetryableOperation } from '../utils/retryMechanism';

export interface ErrorHandlingOptions {
  showToast?: boolean;
  logError?: boolean;
  invalidateQueries?: string[];
  onError?: (error: InfrastructureError) => void;
  onSuccess?: (data: any) => void;
}

export function useErrorHandling() {
  const queryClient = useQueryClient();
  const { executeWithRetry, executeDockerOperation, executeNetworkOperation } = useRetryableOperation();

  const handleError = useCallback((
    error: any, 
    options: ErrorHandlingOptions = {}
  ) => {
    const infrastructureError = parseErrorFromResponse(error);
    
    // Log error if requested (default: true in development)
    if (options.logError !== false && import.meta.env.DEV) {
      console.error('Infrastructure Error:', infrastructureError, error);
    }
    
    // Show toast notification if requested (default: true)
    if (options.showToast !== false) {
      showErrorToast(infrastructureError);
    }
    
    // Invalidate queries if specified
    if (options.invalidateQueries?.length) {
      options.invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    }
    
    // Call custom error handler
    options.onError?.(infrastructureError);
    
    return infrastructureError;
  }, [queryClient]);

  const handleSuccess = useCallback((
    data: any,
    message: string,
    options: ErrorHandlingOptions = {}
  ) => {
    // Show success toast
    showSuccessToast(message);
    
    // Invalidate queries if specified
    if (options.invalidateQueries?.length) {
      options.invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    }
    
    // Call custom success handler
    options.onSuccess?.(data);
    
    return data;
  }, [queryClient]);

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    successMessage: string,
    options: ErrorHandlingOptions = {}
  ): Promise<T> => {
    try {
      const result = await operation();
      return handleSuccess(result, successMessage, options);
    } catch (error) {
      throw handleError(error, options);
    }
  }, [handleError, handleSuccess]);

  const executeWithRetryAndErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    successMessage: string,
    options: ErrorHandlingOptions = {}
  ): Promise<T> => {
    try {
      const result = await executeWithRetry(operation);
      return handleSuccess(result, successMessage, options);
    } catch (error) {
      throw handleError(error, options);
    }
  }, [executeWithRetry, handleError, handleSuccess]);

  const executeDockerOperationWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    successMessage: string,
    options: ErrorHandlingOptions = {}
  ): Promise<T> => {
    try {
      const result = await executeDockerOperation(operation);
      return handleSuccess(result, successMessage, options);
    } catch (error) {
      throw handleError(error, options);
    }
  }, [executeDockerOperation, handleError, handleSuccess]);

  const executeNetworkOperationWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    successMessage: string,
    options: ErrorHandlingOptions = {}
  ): Promise<T> => {
    try {
      const result = await executeNetworkOperation(operation);
      return handleSuccess(result, successMessage, options);
    } catch (error) {
      throw handleError(error, options);
    }
  }, [executeNetworkOperation, handleError, handleSuccess]);

  // Utility functions for common toast notifications
  const showSuccess = useCallback((message: string, description?: string) => {
    showSuccessToast(message, description);
  }, []);

  const showError = useCallback((message: string, description?: string) => {
    showErrorToast({
      code: 'CUSTOM_ERROR',
      message,
      details: description,
      troubleshooting: ['Try the operation again', 'Check your configuration'],
      retryable: true,
      severity: 'medium'
    });
  }, []);

  const showWarning = useCallback((message: string, description?: string) => {
    showWarningToast(message, description);
  }, []);

  const showInfo = useCallback((message: string, description?: string) => {
    showInfoToast(message, description);
  }, []);

  return {
    handleError,
    handleSuccess,
    executeWithErrorHandling,
    executeWithRetryAndErrorHandling,
    executeDockerOperationWithErrorHandling,
    executeNetworkOperationWithErrorHandling,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}

// Specialized hooks for different types of operations
export function useDockerErrorHandling() {
  const { executeDockerOperationWithErrorHandling, handleError, showSuccess } = useErrorHandling();
  
  return {
    executeDockerOperation: executeDockerOperationWithErrorHandling,
    handleDockerError: (error: any) => handleError(error, {
      invalidateQueries: ['docker-stacks', 'docker-containers']
    }),
    showDockerSuccess: showSuccess,
  };
}

export function useConfigurationErrorHandling() {
  const { executeWithRetryAndErrorHandling, handleError, showSuccess } = useErrorHandling();
  
  return {
    executeConfigOperation: executeWithRetryAndErrorHandling,
    handleConfigError: (error: any) => handleError(error, {
      invalidateQueries: ['docker-configs', 'docker-validation']
    }),
    showConfigSuccess: showSuccess,
  };
}

export function useSecretsErrorHandling() {
  const { executeWithErrorHandling, handleError, showSuccess } = useErrorHandling();
  
  return {
    executeSecretsOperation: executeWithErrorHandling,
    handleSecretsError: (error: any) => handleError(error, {
      invalidateQueries: ['secrets']
    }),
    showSecretsSuccess: showSuccess,
  };
}