import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryableOperation, withRetry, withDockerRetry } from '../retryMechanism';
import { createInfrastructureError, ERROR_CODES } from '../errorHandling';
import { afterEach } from 'node:test';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }
}));

describe('retryMechanism', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('RetryableOperation', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const retryableOp = new RetryableOperation(operation);

      const result = await retryableOp.execute();

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const retryableError = new Error('Network connection failed');
      Object.assign(retryableError, createInfrastructureError(ERROR_CODES.NETWORK_CONNECTION_FAILED));
      const operation = vi.fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');

      const retryableOp = new RetryableOperation(operation, {
        maxAttempts: 2,
        baseDelay: 100
      });

      const executePromise = retryableOp.execute();
      
      // Fast-forward through the delay
      await vi.advanceTimersByTimeAsync(100);
      
      const result = await executePromise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      // Create a non-retryable error that won't be converted by parseErrorFromResponse
      const nonRetryableError = {
        ...createInfrastructureError(ERROR_CODES.VALIDATION_COMPOSE_SYNTAX),
        retryable: false
      };
      const operation = vi.fn().mockRejectedValue(nonRetryableError);

      const retryableOp = new RetryableOperation(operation, {
        retryCondition: (error) => error.retryable === true
      });

      await expect(retryableOp.execute()).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect maxAttempts', async () => {
      const retryableError = createInfrastructureError(ERROR_CODES.NETWORK_CONNECTION_FAILED);
      const operation = vi.fn().mockRejectedValue(retryableError);

      const retryableOp = new RetryableOperation(operation, {
        maxAttempts: 3,
        baseDelay: 100
      });

      const executePromise = retryableOp.execute();
      
      // Fast-forward through all retry delays
      await vi.advanceTimersByTimeAsync(100); // First retry
      await vi.advanceTimersByTimeAsync(200); // Second retry (exponential backoff)
      
      await expect(executePromise).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff', async () => {
      const retryableError = createInfrastructureError(ERROR_CODES.NETWORK_CONNECTION_FAILED);
      const operation = vi.fn().mockRejectedValue(retryableError);

      const retryableOp = new RetryableOperation(operation, {
        maxAttempts: 3,
        baseDelay: 100,
        backoffMultiplier: 2
      });

      const executePromise = retryableOp.execute();
      
      // Check that delays increase exponentially
      await vi.advanceTimersByTimeAsync(100); // First retry: 100ms
      await vi.advanceTimersByTimeAsync(200); // Second retry: 200ms
      
      await expect(executePromise).rejects.toThrow();
    });

    it('should respect maxDelay', async () => {
      const retryableError = createInfrastructureError(ERROR_CODES.NETWORK_CONNECTION_FAILED);
      const operation = vi.fn().mockRejectedValue(retryableError);

      const retryableOp = new RetryableOperation(operation, {
        maxAttempts: 4,
        baseDelay: 1000,
        backoffMultiplier: 10,
        maxDelay: 2000
      });

      const executePromise = retryableOp.execute();
      
      // Even with high backoff multiplier, delay should be capped at maxDelay
      await vi.advanceTimersByTimeAsync(1000); // First retry: 1000ms
      await vi.advanceTimersByTimeAsync(2000); // Second retry: capped at 2000ms
      await vi.advanceTimersByTimeAsync(2000); // Third retry: capped at 2000ms
      
      await expect(executePromise).rejects.toThrow();
    });

    it('should call onRetry callback', async () => {
      const retryableError = createInfrastructureError(ERROR_CODES.NETWORK_CONNECTION_FAILED);
      const operation = vi.fn().mockRejectedValue(retryableError);
      const onRetry = vi.fn();

      const retryableOp = new RetryableOperation(operation, {
        maxAttempts: 2,
        baseDelay: 100,
        onRetry
      });

      const executePromise = retryableOp.execute();
      await vi.advanceTimersByTimeAsync(100);
      
      await expect(executePromise).rejects.toThrow();
      expect(onRetry).toHaveBeenCalledWith(1, expect.objectContaining({
        retryable: true,
        severity: 'medium'
      }));
    });

    it('should call onMaxAttemptsReached callback', async () => {
      const retryableError = createInfrastructureError(ERROR_CODES.NETWORK_CONNECTION_FAILED);
      const operation = vi.fn().mockRejectedValue(retryableError);
      const onMaxAttemptsReached = vi.fn();

      const retryableOp = new RetryableOperation(operation, {
        maxAttempts: 1,
        onMaxAttemptsReached
      });

      await expect(retryableOp.execute()).rejects.toThrow();
      expect(onMaxAttemptsReached).toHaveBeenCalledWith(expect.objectContaining({
        retryable: true,
        severity: 'medium'
      }));
    });

    it('should use custom retry condition', async () => {
      const customError = createInfrastructureError(ERROR_CODES.VALIDATION_COMPOSE_SYNTAX);
      const operation = vi.fn().mockRejectedValue(customError);
      const retryCondition = vi.fn().mockReturnValue(true);

      const retryableOp = new RetryableOperation(operation, {
        maxAttempts: 2,
        baseDelay: 100,
        retryCondition
      });

      const executePromise = retryableOp.execute();
      await vi.advanceTimersByTimeAsync(100);
      
      await expect(executePromise).rejects.toThrow();
      expect(retryCondition).toHaveBeenCalledWith(expect.objectContaining({
        severity: 'medium'
      }));
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('withRetry', () => {
    it('should work as convenience function', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('withDockerRetry', () => {
    it('should retry Docker daemon errors', async () => {
      const dockerError = createInfrastructureError(ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE);
      const operation = vi.fn()
        .mockRejectedValueOnce(dockerError)
        .mockResolvedValue('success');

      const executePromise = withDockerRetry(operation);
      await vi.advanceTimersByTimeAsync(2000); // Docker retry uses 2000ms base delay
      
      const result = await executePromise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-Docker errors', async () => {
      const validationError = createInfrastructureError(ERROR_CODES.VALIDATION_COMPOSE_SYNTAX);
      const operation = vi.fn().mockRejectedValue(validationError);

      await expect(withDockerRetry(operation)).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});