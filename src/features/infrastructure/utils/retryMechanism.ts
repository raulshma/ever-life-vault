import { InfrastructureError, parseErrorFromResponse, showErrorToast, showInfoToast } from './errorHandling';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: InfrastructureError) => boolean;
  onRetry?: (attempt: number, error: InfrastructureError) => void;
  onMaxAttemptsReached?: (error: InfrastructureError) => void;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryCondition: (error) => error.retryable,
};

export class RetryableOperation<T> {
  private options: RetryOptions;
  private operation: () => Promise<T>;
  private currentAttempt = 0;

  constructor(operation: () => Promise<T>, options: Partial<RetryOptions> = {}) {
    this.operation = operation;
    this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
  }

  async execute(): Promise<T> {
    this.currentAttempt = 0;
    return this.attemptOperation();
  }

  private async attemptOperation(): Promise<T> {
    try {
      this.currentAttempt++;
      return await this.operation();
    } catch (error) {
      const infrastructureError = parseErrorFromResponse(error);
      
      // Check if we should retry
      const shouldRetry = this.shouldRetry(infrastructureError);
      
      if (shouldRetry && this.currentAttempt < this.options.maxAttempts) {
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.options.baseDelay * Math.pow(this.options.backoffMultiplier, this.currentAttempt - 1),
          this.options.maxDelay
        );
        
        // Notify about retry
        this.options.onRetry?.(this.currentAttempt, infrastructureError);
        
        // Show retry notification
        showInfoToast(
          `Retrying operation (${this.currentAttempt}/${this.options.maxAttempts})`,
          `Waiting ${delay / 1000}s before retry...`
        );
        
        // Wait before retry
        await this.delay(delay);
        
        // Retry the operation
        return this.attemptOperation();
      } else {
        // Max attempts reached or not retryable
        if (this.currentAttempt >= this.options.maxAttempts) {
          this.options.onMaxAttemptsReached?.(infrastructureError);
        }
        
        // Show error toast
        showErrorToast(infrastructureError);
        
        throw infrastructureError;
      }
    }
  }

  private shouldRetry(error: InfrastructureError): boolean {
    if (this.options.retryCondition) {
      return this.options.retryCondition(error);
    }
    return error.retryable;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Convenience function for simple retry operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const retryableOperation = new RetryableOperation(operation, options);
  return retryableOperation.execute();
}

// Specialized retry functions for common infrastructure operations
export async function withDockerRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  return withRetry(operation, {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 8000,
    retryCondition: (error) => {
      // Retry Docker daemon connection issues and transient failures
      return error.retryable && (
        error.code === 'DOCKER_DAEMON_UNAVAILABLE' ||
        error.code === 'NETWORK_CONNECTION_FAILED' ||
        error.code === 'NETWORK_TIMEOUT'
      );
    },
    ...options,
  });
}

export async function withNetworkRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  return withRetry(operation, {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 5000,
    retryCondition: (error) => {
      // Retry network-related errors
      return error.retryable && (
        error.code === 'NETWORK_CONNECTION_FAILED' ||
        error.code === 'NETWORK_TIMEOUT' ||
        error.code === 'SERVER_ERROR'
      );
    },
    ...options,
  });
}

export async function withFileSystemRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  return withRetry(operation, {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 2000,
    retryCondition: (error) => {
      // Only retry transient file system errors
      return error.retryable && error.code !== 'FILESYSTEM_PERMISSION_DENIED';
    },
    ...options,
  });
}

// Hook for React components to use retry mechanisms
export function useRetryableOperation<T>() {
  const executeWithRetry = async (
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> => {
    return withRetry(operation, options);
  };

  const executeDockerOperation = async (
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> => {
    return withDockerRetry(operation, options);
  };

  const executeNetworkOperation = async (
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> => {
    return withNetworkRetry(operation, options);
  };

  const executeFileSystemOperation = async (
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> => {
    return withFileSystemRetry(operation, options);
  };

  return {
    executeWithRetry,
    executeDockerOperation,
    executeNetworkOperation,
    executeFileSystemOperation,
  };
}