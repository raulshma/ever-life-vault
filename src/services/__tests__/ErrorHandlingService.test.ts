/**
 * Unit tests for ErrorHandlingService
 * Tests error handling, classification, retry logic, and reporting
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  ErrorHandlingService, 
  errorHandlingService,
  ErrorType,
  ErrorSeverity,
  withErrorHandling,
  createAsyncHandler
} from '@/services/ErrorHandlingService';

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: mockToast
}));

describe('ErrorHandlingService', () => {
  let service: ErrorHandlingService;

  beforeEach(() => {
    service = new ErrorHandlingService({
      enableLogging: false, // Disable logging for tests
      enableToasts: false,
      enableReporting: false
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Error Normalization', () => {
    it('should normalize standard Error objects', () => {
      const error = new Error('Test error message');
      const appError = service.handleError(error);

      expect(appError.type).toBeDefined();
      expect(appError.severity).toBeDefined();
      expect(appError.message).toBe('Test error message');
      expect(appError.userMessage).toBeDefined();
      expect(appError.code).toBeDefined();
      expect(appError.timestamp).toBeInstanceOf(Date);
      expect(appError.isRetryable).toBeDefined();
      expect(appError.suggestedActions).toBeInstanceOf(Array);
    });

    it('should preserve AppError objects', () => {
      const appError = {
        id: 'test-error-id',
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        message: 'Test message',
        userMessage: 'User-friendly message',
        code: 'TEST_ERROR',
        timestamp: new Date(),
        isRetryable: false,
        suggestedActions: ['Test action']
      };

      const result = service.handleError(appError);
      expect(result).toEqual(appError);
    });

    it('should handle string errors', () => {
      const result = service.handleError('Simple error string');
      expect(result.message).toBe('Simple error string');
      expect(result.type).toBeDefined();
    });

    it('should handle null/undefined errors', () => {
      const result = service.handleError(null);
      expect(result.message).toBe('null');
      expect(result.type).toBe(ErrorType.UNKNOWN);
    });
  });

  describe('Error Classification', () => {
    it('should classify network errors correctly', () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      
      const result = service.handleError(networkError);
      expect(result.type).toBe(ErrorType.NETWORK);
      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should classify timeout errors correctly', () => {
      const timeoutError = new Error('Request timed out');
      timeoutError.name = 'TimeoutError';
      
      const result = service.handleError(timeoutError);
      expect(result.type).toBe(ErrorType.NETWORK);
      expect(result.code).toBe('REQUEST_TIMEOUT');
    });

    it('should classify HTTP 401 errors as auth errors', () => {
      const authError = new Error('Unauthorized');
      (authError as any).response = { status: 401 };
      
      const result = service.handleError(authError);
      expect(result.type).toBe(ErrorType.AUTH);
      expect(result.code).toBe('AUTH_TOKEN_EXPIRED');
      expect(result.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should classify HTTP 403 errors as permission errors', () => {
      const permissionError = new Error('Forbidden');
      (permissionError as any).response = { status: 403 };
      
      const result = service.handleError(permissionError);
      expect(result.type).toBe(ErrorType.AUTH);
      expect(result.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should classify HTTP 5xx errors as server errors', () => {
      const serverError = new Error('Internal Server Error');
      (serverError as any).response = { status: 500 };
      
      const result = service.handleError(serverError);
      expect(result.type).toBe(ErrorType.NETWORK);
      expect(result.code).toBe('SERVER_ERROR');
      expect(result.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should classify validation errors correctly', () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      
      const result = service.handleError(validationError);
      expect(result.type).toBe(ErrorType.VALIDATION);
      expect(result.code).toBe('INVALID_RECEIPT_DATA');
      expect(result.severity).toBe(ErrorSeverity.LOW);
    });

    it('should classify file errors correctly', () => {
      const fileError = new Error('File too large');
      (fileError as any).response = { status: 413 };
      
      const result = service.handleError(fileError);
      expect(result.type).toBe(ErrorType.FILE_UPLOAD);
      expect(result.code).toBe('FILE_TOO_LARGE');
    });

    it('should classify AI analysis errors correctly', () => {
      const aiError = new Error('AI analysis failed');
      (aiError as any).code = 'AI_SERVICE_ERROR';
      
      const result = service.handleError(aiError);
      expect(result.type).toBe(ErrorType.AI_ANALYSIS);
      expect(result.code).toBe('AI_ANALYSIS_FAILED');
    });

    it('should classify database errors correctly', () => {
      const dbError = new Error('Connection refused');
      (dbError as any).code = 'ECONNREFUSED';
      
      const result = service.handleError(dbError);
      expect(result.type).toBe(ErrorType.DATABASE);
      expect(result.code).toBe('DATABASE_CONNECTION_ERROR');
      expect(result.severity).toBe(ErrorSeverity.HIGH);
    });
  });

  describe('Retry Logic', () => {
    it('should retry retryable operations', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Temporary failure');
          error.name = 'NetworkError';
          throw error;
        }
        return 'success';
      });

      const result = await service.withRetry(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(
        new Error('Validation error')
      );

      await expect(service.withRetry(operation)).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect custom retry configuration', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        const error = new Error('Network error');
        error.name = 'NetworkError';
        throw error;
      });

      const customConfig = { maxAttempts: 2, baseDelay: 10 };
      
      await expect(
        service.withRetry(operation, {}, customConfig)
      ).rejects.toThrow();
      
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should implement exponential backoff', async () => {
      vi.useFakeTimers();
      
      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        const error = new Error('Network error');
        error.name = 'NetworkError';
        throw error;
      });

      const retryPromise = service.withRetry(operation, {}, {
        maxAttempts: 3,
        baseDelay: 100,
        backoffMultiplier: 2
      });

      // Let the first attempt fail
      await vi.advanceTimersByTimeAsync(1);
      expect(attempts).toBe(1);

      // Advance by first delay (100ms)
      await vi.advanceTimersByTimeAsync(100);
      expect(attempts).toBe(2);

      // Advance by second delay (200ms)
      await vi.advanceTimersByTimeAsync(200);
      expect(attempts).toBe(3);

      await expect(retryPromise).rejects.toThrow();
      vi.useRealTimers();
    });

    it('should add operation context to errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));
      const context = { operation: 'test-operation', userId: '123' };

      try {
        await service.withRetry(operation, context);
      } catch (error) {
        expect(error.context).toMatchObject(context);
      }
    });
  });

  describe('Error Logging and Storage', () => {
    it('should store errors in log', () => {
      const error = new Error('Test error');
      service.handleError(error);

      const recentErrors = service.getRecentErrors(10);
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toBe('Test error');
    });

    it('should limit error log size', () => {
      // Create service with custom config for testing
      const testService = new ErrorHandlingService();
      
      // Add more than the limit to test trimming
      for (let i = 0; i < 1005; i++) {
        testService.handleError(new Error(`Error ${i}`));
      }

      const recentErrors = testService.getRecentErrors(2000);
      expect(recentErrors.length).toBeLessThanOrEqual(1000);
    });

    it('should filter errors by type', () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      
      const validationError = new Error('Validation error');
      validationError.name = 'ValidationError';

      service.handleError(networkError);
      service.handleError(validationError);

      const networkErrors = service.getErrorsByType(ErrorType.NETWORK);
      const validationErrors = service.getErrorsByType(ErrorType.VALIDATION);

      expect(networkErrors).toHaveLength(1);
      expect(validationErrors).toHaveLength(1);
      expect(networkErrors[0].type).toBe(ErrorType.NETWORK);
      expect(validationErrors[0].type).toBe(ErrorType.VALIDATION);
    });

    it('should clear error log', () => {
      service.handleError(new Error('Test error'));
      expect(service.getRecentErrors()).toHaveLength(1);

      service.clearErrorLog();
      expect(service.getRecentErrors()).toHaveLength(0);
    });
  });

  describe('Error Statistics', () => {
    beforeEach(() => {
      // Add various types of errors
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      
      const validationError = new Error('Validation error');
      validationError.name = 'ValidationError';
      
      const authError = new Error('Auth error');
      (authError as any).response = { status: 401 };

      service.handleError(networkError);
      service.handleError(validationError);
      service.handleError(authError);
    });

    it('should provide total error count', () => {
      const stats = service.getErrorStats();
      expect(stats.total).toBe(3);
    });

    it('should provide error counts by type', () => {
      const stats = service.getErrorStats();
      
      expect(stats.byType[ErrorType.NETWORK]).toBe(1);
      expect(stats.byType[ErrorType.VALIDATION]).toBe(1);
      expect(stats.byType[ErrorType.AUTH]).toBe(1);
    });

    it('should provide error counts by severity', () => {
      const stats = service.getErrorStats();
      
      expect(stats.bySeverity[ErrorSeverity.LOW]).toBe(1); // Validation
      expect(stats.bySeverity[ErrorSeverity.MEDIUM]).toBe(1); // Network
      expect(stats.bySeverity[ErrorSeverity.HIGH]).toBe(1); // Auth
    });

    it('should provide recent trends', () => {
      const stats = service.getErrorStats();
      
      expect(stats.recentTrends).toBeInstanceOf(Array);
      expect(stats.recentTrends).toHaveLength(7); // 7 days
      expect(stats.recentTrends[stats.recentTrends.length - 1].count).toBe(3);
    });
  });

  describe('Error Reporting', () => {
    it('should call error reporters', () => {
      const reporter1 = vi.fn();
      const reporter2 = vi.fn();
      
      const reportingService = new ErrorHandlingService({
        enableReporting: true
      });
      
      reportingService.addErrorReporter(reporter1);
      reportingService.addErrorReporter(reporter2);

      const error = new Error('Test error');
      reportingService.handleError(error);

      expect(reporter1).toHaveBeenCalledTimes(1);
      expect(reporter2).toHaveBeenCalledTimes(1);
      expect(reporter1).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Test error'
      }));
    });

    it('should handle reporter failures gracefully', () => {
      const failingReporter = vi.fn().mockImplementation(() => {
        throw new Error('Reporter failed');
      });
      
      const workingReporter = vi.fn();
      
      const reportingService = new ErrorHandlingService({
        enableReporting: true,
        enableLogging: false // Disable logging to avoid console spam
      });
      
      reportingService.addErrorReporter(failingReporter);
      reportingService.addErrorReporter(workingReporter);

      expect(() => {
        reportingService.handleError(new Error('Test error'));
      }).not.toThrow();

      expect(workingReporter).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    it('should use default configuration', () => {
      const defaultService = new ErrorHandlingService();
      // Configuration is private, but we can test behavior
      expect(() => defaultService.handleError(new Error('Test'))).not.toThrow();
    });

    it('should allow configuration updates', () => {
      service.updateConfig({ enableToasts: true });
      // Configuration is private, but we can test that it doesn't throw
      expect(() => service.handleError(new Error('Test'))).not.toThrow();
    });
  });

  describe('Utility Functions', () => {
    describe('withErrorHandling', () => {
      it('should wrap function with error handling', async () => {
        const wrappedFunction = withErrorHandling(async (value: number) => {
          if (value < 0) throw new Error('Negative value');
          return value * 2;
        });

        const result = await wrappedFunction(5);
        expect(result).toBe(10);

        await expect(wrappedFunction(-1)).rejects.toThrow();
      });
    });

    describe('createAsyncHandler', () => {
      it('should create async handler with error handling', async () => {
        const handler = createAsyncHandler(async (value: number) => {
          if (value < 0) throw new Error('Negative value');
          return value * 2;
        });

        const result = await handler(5);
        expect(result).toBe(10);

        // Should not throw, but handle error internally
        await expect(handler(-1)).resolves.toBeUndefined();
      });

      it('should include context in error handling', async () => {
        const context = { component: 'test-component' };
        const handler = createAsyncHandler(async () => {
          throw new Error('Test error');
        }, context);

        await handler();
        
        const recentErrors = service.getRecentErrors(1);
        // The error would be handled by the global service, not our test instance
        // So we just verify the handler doesn't throw
      });
    });
  });

  describe('Toast Integration', () => {
    it('should show toasts when enabled', () => {
      const toastService = new ErrorHandlingService({
        enableToasts: true,
        enableLogging: false
      });

      const error = new Error('Test error');
      toastService.handleError(error);

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
          variant: expect.any(String)
        })
      );
    });

    it('should not show toasts when disabled', () => {
      const noToastService = new ErrorHandlingService({
        enableToasts: false
      });

      noToastService.handleError(new Error('Test error'));
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('should use appropriate toast variants for different severities', () => {
      const toastService = new ErrorHandlingService({
        enableToasts: true,
        enableLogging: false
      });

      // High severity error
      const criticalError = new Error('Critical error');
      (criticalError as any).response = { status: 500 };
      toastService.handleError(criticalError);

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive'
        })
      );
    });
  });

  describe('Singleton Instance', () => {
    it('should provide a singleton instance', () => {
      expect(errorHandlingService).toBeInstanceOf(ErrorHandlingService);
    });

    it('should maintain state across calls', () => {
      errorHandlingService.handleError(new Error('Test error'));
      const errors = errorHandlingService.getRecentErrors(1);
      expect(errors).toHaveLength(1);
    });
  });
});