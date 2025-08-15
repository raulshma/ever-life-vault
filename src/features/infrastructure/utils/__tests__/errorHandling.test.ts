import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  createInfrastructureError, 
  parseErrorFromResponse, 
  showErrorToast,
  showSuccessToast,
  ERROR_CODES 
} from '../errorHandling';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }
}));

describe('errorHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createInfrastructureError', () => {
    it('should create error with known code', () => {
      const error = createInfrastructureError(ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE, 'Test details');
      
      expect(error.code).toBe(ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE);
      expect(error.message).toBe('Docker daemon is not running or accessible');
      expect(error.details).toBe('Test details');
      expect(error.retryable).toBe(true);
      expect(error.severity).toBe('critical');
      expect(error.troubleshooting).toContain('Start Docker Desktop or Docker service');
    });

    it('should fallback to unknown error for invalid code', () => {
      const error = createInfrastructureError('INVALID_CODE');
      
      expect(error.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(error.message).toBe('An unexpected error occurred');
      expect(error.retryable).toBe(true);
    });
  });

  describe('parseErrorFromResponse', () => {
    it('should parse API error response', () => {
      const apiError = {
        response: {
          data: {
            error: {
              code: ERROR_CODES.DOCKER_COMPOSE_INVALID,
              message: 'Invalid YAML syntax'
            }
          }
        }
      };

      const error = parseErrorFromResponse(apiError);
      expect(error.code).toBe(ERROR_CODES.DOCKER_COMPOSE_INVALID);
      expect(error.details).toBe('Invalid YAML syntax');
    });

    it('should parse network error', () => {
      const networkError = {
        code: 'NETWORK_ERROR',
        message: 'Network Error'
      };

      const error = parseErrorFromResponse(networkError);
      expect(error.code).toBe(ERROR_CODES.NETWORK_CONNECTION_FAILED);
    });

    it('should parse timeout error', () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded'
      };

      const error = parseErrorFromResponse(timeoutError);
      expect(error.code).toBe(ERROR_CODES.NETWORK_TIMEOUT);
    });

    it('should parse Docker daemon error', () => {
      const dockerError = {
        message: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock'
      };

      const error = parseErrorFromResponse(dockerError);
      expect(error.code).toBe(ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE);
    });

    it('should parse port conflict error', () => {
      const portError = {
        message: 'port 8080 is already in use'
      };

      const error = parseErrorFromResponse(portError);
      expect(error.code).toBe(ERROR_CODES.DOCKER_PORT_CONFLICT);
    });

    it('should parse file system permission error', () => {
      const permissionError = {
        code: 'EACCES',
        message: 'permission denied'
      };

      const error = parseErrorFromResponse(permissionError);
      expect(error.code).toBe(ERROR_CODES.FILESYSTEM_PERMISSION_DENIED);
    });

    it('should parse file not found error', () => {
      const notFoundError = {
        code: 'ENOENT',
        message: 'no such file or directory'
      };

      const error = parseErrorFromResponse(notFoundError);
      expect(error.code).toBe(ERROR_CODES.FILESYSTEM_PATH_NOT_FOUND);
    });

    it('should parse 401 authentication error', () => {
      const authError = {
        response: {
          status: 401
        }
      };

      const error = parseErrorFromResponse(authError);
      expect(error.code).toBe(ERROR_CODES.AUTH_UNAUTHORIZED);
    });

    it('should parse 403 authorization error', () => {
      const forbiddenError = {
        response: {
          status: 403
        }
      };

      const error = parseErrorFromResponse(forbiddenError);
      expect(error.code).toBe(ERROR_CODES.AUTH_FORBIDDEN);
    });

    it('should default to unknown error', () => {
      const unknownError = {
        message: 'Something went wrong'
      };

      const error = parseErrorFromResponse(unknownError);
      expect(error.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(error.details).toBe('Something went wrong');
    });
  });

  describe('toast functions', () => {
    it('should show error toast with troubleshooting action for retryable errors', async () => {
      const { toast } = await import('sonner');
      const error = createInfrastructureError(ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE);
      
      showErrorToast(error);
      
      expect(toast.error).toHaveBeenCalledWith(
        error.message,
        expect.objectContaining({
          description: error.details,
          duration: 10000, // Critical error duration
          action: expect.objectContaining({
            label: 'Troubleshoot'
          })
        })
      );
    });

    it('should show error toast without action for non-retryable errors', async () => {
      const { toast } = await import('sonner');
      const error = createInfrastructureError(ERROR_CODES.VALIDATION_COMPOSE_SYNTAX);
      
      showErrorToast(error);
      
      expect(toast.error).toHaveBeenCalledWith(
        error.message,
        expect.objectContaining({
          duration: 5000, // Medium severity duration
          action: undefined
        })
      );
    });

    it('should show success toast', async () => {
      const { toast } = await import('sonner');
      
      showSuccessToast('Operation completed', 'Details here');
      
      expect(toast.success).toHaveBeenCalledWith(
        'Operation completed',
        expect.objectContaining({
          description: 'Details here',
          duration: 3000
        })
      );
    });
  });
});