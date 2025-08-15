import { toast } from 'sonner';

export interface InfrastructureError {
  code: string;
  message: string;
  details?: string;
  troubleshooting: string[];
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export const ERROR_CODES = {
  // Docker-related errors
  DOCKER_DAEMON_UNAVAILABLE: 'DOCKER_DAEMON_UNAVAILABLE',
  DOCKER_COMPOSE_INVALID: 'DOCKER_COMPOSE_INVALID',
  DOCKER_DEPLOYMENT_FAILED: 'DOCKER_DEPLOYMENT_FAILED',
  DOCKER_CONTAINER_FAILED: 'DOCKER_CONTAINER_FAILED',
  DOCKER_PORT_CONFLICT: 'DOCKER_PORT_CONFLICT',
  DOCKER_RESOURCE_LIMIT: 'DOCKER_RESOURCE_LIMIT',
  
  // File system errors
  FILESYSTEM_PERMISSION_DENIED: 'FILESYSTEM_PERMISSION_DENIED',
  FILESYSTEM_PATH_NOT_FOUND: 'FILESYSTEM_PATH_NOT_FOUND',
  FILESYSTEM_DISK_FULL: 'FILESYSTEM_DISK_FULL',
  FILESYSTEM_PATH_TRAVERSAL: 'FILESYSTEM_PATH_TRAVERSAL',
  
  // Network errors
  NETWORK_CONNECTION_FAILED: 'NETWORK_CONNECTION_FAILED',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_DNS_RESOLUTION: 'NETWORK_DNS_RESOLUTION',
  
  // Validation errors
  VALIDATION_COMPOSE_SYNTAX: 'VALIDATION_COMPOSE_SYNTAX',
  VALIDATION_REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  
  // Authentication/Authorization errors
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  
  // Secrets management errors
  SECRETS_ENCRYPTION_FAILED: 'SECRETS_ENCRYPTION_FAILED',
  SECRETS_DECRYPTION_FAILED: 'SECRETS_DECRYPTION_FAILED',
  SECRETS_KEY_NOT_FOUND: 'SECRETS_KEY_NOT_FOUND',
  
  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  CLIENT_ERROR: 'CLIENT_ERROR',
} as const;

export const ERROR_DEFINITIONS: Record<string, Omit<InfrastructureError, 'details'>> = {
  [ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE]: {
    code: ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE,
    message: 'Docker daemon is not running or accessible',
    troubleshooting: [
      'Start Docker Desktop or Docker service',
      'Check if Docker daemon is running: docker info',
      'Verify Docker socket permissions',
      'Restart Docker service if needed'
    ],
    retryable: true,
    severity: 'critical'
  },
  
  [ERROR_CODES.DOCKER_COMPOSE_INVALID]: {
    code: ERROR_CODES.DOCKER_COMPOSE_INVALID,
    message: 'Docker Compose configuration is invalid',
    troubleshooting: [
      'Check YAML syntax and indentation',
      'Validate service names and image references',
      'Ensure all required fields are present',
      'Use docker-compose config to validate locally'
    ],
    retryable: false,
    severity: 'high'
  },
  
  [ERROR_CODES.DOCKER_DEPLOYMENT_FAILED]: {
    code: ERROR_CODES.DOCKER_DEPLOYMENT_FAILED,
    message: 'Failed to deploy Docker stack',
    troubleshooting: [
      'Check container logs for specific errors',
      'Verify image availability and tags',
      'Check port conflicts with existing services',
      'Ensure sufficient system resources'
    ],
    retryable: true,
    severity: 'high'
  },
  
  [ERROR_CODES.DOCKER_PORT_CONFLICT]: {
    code: ERROR_CODES.DOCKER_PORT_CONFLICT,
    message: 'Port conflict detected',
    troubleshooting: [
      'Check which service is using the conflicting port',
      'Use different port numbers in your configuration',
      'Stop conflicting services if not needed',
      'Use docker ps to see running containers'
    ],
    retryable: false,
    severity: 'medium'
  },
  
  [ERROR_CODES.FILESYSTEM_PERMISSION_DENIED]: {
    code: ERROR_CODES.FILESYSTEM_PERMISSION_DENIED,
    message: 'Permission denied accessing file system',
    troubleshooting: [
      'Check file/directory permissions',
      'Ensure the application has necessary access rights',
      'Consider running with appropriate user permissions',
      'Verify SELinux/AppArmor policies if applicable'
    ],
    retryable: false,
    severity: 'high'
  },
  
  [ERROR_CODES.FILESYSTEM_PATH_NOT_FOUND]: {
    code: ERROR_CODES.FILESYSTEM_PATH_NOT_FOUND,
    message: 'Specified path does not exist',
    troubleshooting: [
      'Verify the path exists on the host system',
      'Check for typos in the path specification',
      'Create the directory if it should exist',
      'Use absolute paths when possible'
    ],
    retryable: false,
    severity: 'medium'
  },
  
  [ERROR_CODES.NETWORK_CONNECTION_FAILED]: {
    code: ERROR_CODES.NETWORK_CONNECTION_FAILED,
    message: 'Network connection failed',
    troubleshooting: [
      'Check internet connectivity',
      'Verify server is running and accessible',
      'Check firewall settings',
      'Try refreshing the page'
    ],
    retryable: true,
    severity: 'medium'
  },
  
  [ERROR_CODES.NETWORK_TIMEOUT]: {
    code: ERROR_CODES.NETWORK_TIMEOUT,
    message: 'Request timed out',
    troubleshooting: [
      'Check network connection stability',
      'Try the operation again',
      'Verify server is responding',
      'Consider increasing timeout if possible'
    ],
    retryable: true,
    severity: 'medium'
  },
  
  [ERROR_CODES.VALIDATION_COMPOSE_SYNTAX]: {
    code: ERROR_CODES.VALIDATION_COMPOSE_SYNTAX,
    message: 'Docker Compose syntax error',
    troubleshooting: [
      'Check YAML indentation and structure',
      'Validate quotes and special characters',
      'Ensure all required fields are present',
      'Use a YAML validator to check syntax'
    ],
    retryable: false,
    severity: 'medium'
  },
  
  [ERROR_CODES.AUTH_UNAUTHORIZED]: {
    code: ERROR_CODES.AUTH_UNAUTHORIZED,
    message: 'Authentication required',
    troubleshooting: [
      'Please log in to continue',
      'Check if your session has expired',
      'Verify your credentials',
      'Try refreshing the page'
    ],
    retryable: false,
    severity: 'high'
  },
  
  [ERROR_CODES.AUTH_FORBIDDEN]: {
    code: ERROR_CODES.AUTH_FORBIDDEN,
    message: 'Access forbidden',
    troubleshooting: [
      'Check if you have the required permissions',
      'Contact administrator for access',
      'Verify your user role',
      'Try logging out and back in'
    ],
    retryable: false,
    severity: 'high'
  },
  
  [ERROR_CODES.SECRETS_ENCRYPTION_FAILED]: {
    code: ERROR_CODES.SECRETS_ENCRYPTION_FAILED,
    message: 'Failed to encrypt secret',
    troubleshooting: [
      'Check if encryption service is available',
      'Verify secret value format',
      'Try again with a different secret',
      'Contact administrator if problem persists'
    ],
    retryable: true,
    severity: 'high'
  },
  
  [ERROR_CODES.UNKNOWN_ERROR]: {
    code: ERROR_CODES.UNKNOWN_ERROR,
    message: 'An unexpected error occurred',
    troubleshooting: [
      'Try refreshing the page',
      'Check browser console for more details',
      'Try the operation again',
      'Contact support if the problem persists'
    ],
    retryable: true,
    severity: 'medium'
  }
};

export function createInfrastructureError(
  code: string,
  details?: string,
  originalError?: Error
): InfrastructureError {
  const definition = ERROR_DEFINITIONS[code] || ERROR_DEFINITIONS[ERROR_CODES.UNKNOWN_ERROR];
  
  return {
    ...definition,
    details: details || originalError?.message,
  };
}

export function parseErrorFromResponse(error: any): InfrastructureError {
  // Handle API error responses
  if (error?.response?.data?.error) {
    const apiError = error.response.data.error;
    return createInfrastructureError(
      apiError.code || ERROR_CODES.SERVER_ERROR,
      apiError.message || apiError.details
    );
  }
  
  // Handle network errors
  if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
    return createInfrastructureError(ERROR_CODES.NETWORK_CONNECTION_FAILED);
  }
  
  // Handle timeout errors
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return createInfrastructureError(ERROR_CODES.NETWORK_TIMEOUT);
  }
  
  // Handle Docker-specific errors
  if (error?.message?.includes('docker daemon') || error?.message?.includes('Docker daemon')) {
    return createInfrastructureError(ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE);
  }
  
  if (error?.message?.includes('port') && error?.message?.includes('already in use')) {
    return createInfrastructureError(ERROR_CODES.DOCKER_PORT_CONFLICT);
  }
  
  // Handle file system errors
  if (error?.code === 'EACCES' || error?.message?.includes('permission denied')) {
    return createInfrastructureError(ERROR_CODES.FILESYSTEM_PERMISSION_DENIED);
  }
  
  if (error?.code === 'ENOENT' || error?.message?.includes('no such file')) {
    return createInfrastructureError(ERROR_CODES.FILESYSTEM_PATH_NOT_FOUND);
  }
  
  // Handle authentication errors
  if (error?.response?.status === 401) {
    return createInfrastructureError(ERROR_CODES.AUTH_UNAUTHORIZED);
  }
  
  if (error?.response?.status === 403) {
    return createInfrastructureError(ERROR_CODES.AUTH_FORBIDDEN);
  }
  
  // Default to unknown error
  return createInfrastructureError(ERROR_CODES.UNKNOWN_ERROR, error?.message, error);
}

export function showErrorToast(error: InfrastructureError) {
  const toastId = `error-${error.code}-${Date.now()}`;
  
  toast.error(error.message, {
    id: toastId,
    description: error.details,
    duration: error.severity === 'critical' ? 10000 : 5000,
    action: error.retryable ? {
      label: 'Troubleshoot',
      onClick: () => showTroubleshootingToast(error)
    } : undefined,
  });
}

export function showTroubleshootingToast(error: InfrastructureError) {
  const troubleshootingText = error.troubleshooting
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n');
    
  toast.info('Troubleshooting Steps', {
    description: troubleshootingText,
    duration: 8000,
  });
}

export function showSuccessToast(message: string, description?: string) {
  toast.success(message, {
    description,
    duration: 3000,
  });
}

export function showInfoToast(message: string, description?: string) {
  toast.info(message, {
    description,
    duration: 4000,
  });
}

export function showWarningToast(message: string, description?: string) {
  toast.warning(message, {
    description,
    duration: 5000,
  });
}