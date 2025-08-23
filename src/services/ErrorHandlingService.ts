/**
 * Error Handling Service
 * Provides comprehensive error handling, logging, and user-friendly error messages
 * throughout the receipt management system.
 */

import { toast } from '@/hooks/use-toast';

// Error types and interfaces
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  FILE_UPLOAD = 'FILE_UPLOAD',
  AI_ANALYSIS = 'AI_ANALYSIS',
  DATABASE = 'DATABASE',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  code: string;
  timestamp: Date;
  stack?: string;
  context?: Record<string, any>;
  isRetryable: boolean;
  suggestedActions: string[];
  metadata?: {
    userId?: string;
    sessionId?: string;
    component?: string;
    operation?: string;
  };
}

export interface ErrorHandlingConfig {
  enableLogging: boolean;
  enableToasts: boolean;
  enableReporting: boolean;
  maxRetries: number;
  retryDelay: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// Pre-defined error messages
const ERROR_MESSAGES = {
  // Validation errors
  INVALID_RECEIPT_DATA: {
    user: 'The receipt data is invalid. Please check your input and try again.',
    dev: 'Receipt data validation failed',
    actions: ['Check required fields', 'Verify data format', 'Review validation errors']
  },
  INVALID_FILE_FORMAT: {
    user: 'This file format is not supported. Please upload a JPEG, PNG, WebP, or PDF file.',
    dev: 'Unsupported file format provided',
    actions: ['Use supported file formats', 'Check file extension', 'Verify file is not corrupted']
  },
  FILE_TOO_LARGE: {
    user: 'The file is too large. Please compress the image or choose a smaller file.',
    dev: 'File size exceeds maximum allowed size',
    actions: ['Compress the image', 'Choose a smaller file', 'Check file size limits']
  },

  // Network errors
  NETWORK_ERROR: {
    user: 'Unable to connect to the server. Please check your internet connection and try again.',
    dev: 'Network request failed',
    actions: ['Check internet connection', 'Retry the operation', 'Try again later']
  },
  REQUEST_TIMEOUT: {
    user: 'The request timed out. Please try again.',
    dev: 'Request exceeded timeout limit',
    actions: ['Retry the operation', 'Check network speed', 'Try again later']
  },
  SERVER_ERROR: {
    user: 'Something went wrong on our end. Please try again in a few moments.',
    dev: 'Server returned error response',
    actions: ['Retry the operation', 'Contact support if issue persists', 'Try again later']
  },

  // Authentication errors
  AUTH_TOKEN_EXPIRED: {
    user: 'Your session has expired. Please log in again.',
    dev: 'Authentication token has expired',
    actions: ['Log in again', 'Refresh the page', 'Clear browser cache']
  },
  INSUFFICIENT_PERMISSIONS: {
    user: 'You don\'t have permission to perform this action.',
    dev: 'User lacks required permissions',
    actions: ['Contact administrator', 'Check user permissions', 'Log in with correct account']
  },

  // AI Analysis errors
  AI_ANALYSIS_FAILED: {
    user: 'We couldn\'t analyze this receipt automatically. You can still add it manually.',
    dev: 'AI analysis service returned error',
    actions: ['Add receipt manually', 'Try with different image', 'Contact support']
  },
  AI_SERVICE_UNAVAILABLE: {
    user: 'Receipt analysis is temporarily unavailable. You can add receipts manually.',
    dev: 'AI analysis service is unavailable',
    actions: ['Add receipt manually', 'Try again later', 'Check service status']
  },

  // Database errors
  DATABASE_CONNECTION_ERROR: {
    user: 'Unable to save your data right now. Please try again.',
    dev: 'Database connection failed',
    actions: ['Retry the operation', 'Check database status', 'Contact support']
  },
  DUPLICATE_ENTRY: {
    user: 'This receipt appears to already exist. Would you like to update it instead?',
    dev: 'Duplicate entry detected',
    actions: ['Update existing receipt', 'Check for duplicates', 'Use different data']
  },

  // Business logic errors
  BUDGET_EXCEEDED: {
    user: 'This expense would exceed your budget limit. Do you want to continue?',
    dev: 'Operation would exceed budget constraints',
    actions: ['Adjust budget limits', 'Review expense amount', 'Continue anyway']
  },
  INVALID_CATEGORY: {
    user: 'The selected category is not valid. Please choose a different category.',
    dev: 'Invalid category provided',
    actions: ['Choose valid category', 'Check category list', 'Use default category']
  }
};

export class ErrorHandlingService {
  private config: ErrorHandlingConfig;
  private retryConfig: RetryConfig;
  private errorLog: AppError[] = [];
  private errorReporters: ((error: AppError) => void)[] = [];

  constructor(
    config: Partial<ErrorHandlingConfig> = {},
    retryConfig: Partial<RetryConfig> = {}
  ) {
    this.config = {
      enableLogging: true,
      enableToasts: true,
      enableReporting: false,
      maxRetries: 3,
      retryDelay: 1000,
      logLevel: 'error',
      ...config
    };

    this.retryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: [
        'NETWORK_ERROR',
        'REQUEST_TIMEOUT',
        'SERVER_ERROR',
        'DATABASE_CONNECTION_ERROR'
      ],
      ...retryConfig
    };
  }

  /**
   * Handle error with comprehensive processing
   */
  handleError(error: Error | AppError | any, context?: Record<string, any>): AppError {
    const appError = this.normalizeError(error, context);
    
    // Log error
    if (this.config.enableLogging) {
      this.logError(appError);
    }

    // Store in error log
    this.errorLog.push(appError);
    this.trimErrorLog();

    // Show user notification
    if (this.config.enableToasts) {
      this.showErrorToast(appError);
    }

    // Report error
    if (this.config.enableReporting) {
      this.reportError(appError);
    }

    return appError;
  }

  /**
   * Normalize various error types to AppError
   */
  private normalizeError(error: any, context?: Record<string, any>): AppError {
    // If already an AppError, return as is
    if (this.isAppError(error)) {
      return error;
    }

    // Determine error type and code
    const { type, code, severity } = this.classifyError(error);
    const errorDefinition = ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES];

    return {
      id: this.generateErrorId(),
      type,
      severity,
      code,
      message: error.message || error.toString(),
      userMessage: errorDefinition?.user || 'An unexpected error occurred. Please try again.',
      timestamp: new Date(),
      stack: error.stack,
      context: context || {},
      isRetryable: this.isRetryableError(code),
      suggestedActions: errorDefinition?.actions || ['Try again', 'Contact support if issue persists'],
      metadata: {
        userId: this.getCurrentUserId(),
        sessionId: this.getSessionId(),
        component: context?.component,
        operation: context?.operation
      }
    };
  }

  /**
   * Classify error to determine type, code, and severity
   */
  private classifyError(error: any): { type: ErrorType; code: string; severity: ErrorSeverity } {
    // Network errors
    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERR') {
      return { type: ErrorType.NETWORK, code: 'NETWORK_ERROR', severity: ErrorSeverity.MEDIUM };
    }

    if (error.name === 'TimeoutError' || error.code === 'TIMEOUT') {
      return { type: ErrorType.NETWORK, code: 'REQUEST_TIMEOUT', severity: ErrorSeverity.MEDIUM };
    }

    // HTTP errors
    if (error.response) {
      const status = error.response.status;
      
      if (status === 401) {
        return { type: ErrorType.AUTH, code: 'AUTH_TOKEN_EXPIRED', severity: ErrorSeverity.HIGH };
      }
      
      if (status === 403) {
        return { type: ErrorType.AUTH, code: 'INSUFFICIENT_PERMISSIONS', severity: ErrorSeverity.HIGH };
      }
      
      if (status >= 500) {
        return { type: ErrorType.NETWORK, code: 'SERVER_ERROR', severity: ErrorSeverity.HIGH };
      }
      
      if (status === 413) {
        return { type: ErrorType.FILE_UPLOAD, code: 'FILE_TOO_LARGE', severity: ErrorSeverity.MEDIUM };
      }
    }

    // Validation errors
    if (error.name === 'ValidationError' || error.code?.startsWith('VALIDATION_')) {
      return { type: ErrorType.VALIDATION, code: 'INVALID_RECEIPT_DATA', severity: ErrorSeverity.LOW };
    }

    // File errors
    if (error.name === 'FileError' || error.code?.includes('FILE_')) {
      return { type: ErrorType.FILE_UPLOAD, code: 'INVALID_FILE_FORMAT', severity: ErrorSeverity.MEDIUM };
    }

    // AI errors
    if (error.code?.includes('AI_') || error.message?.includes('analysis')) {
      return { type: ErrorType.AI_ANALYSIS, code: 'AI_ANALYSIS_FAILED', severity: ErrorSeverity.MEDIUM };
    }

    // Database errors
    if (error.code === 'ECONNREFUSED' || error.code?.includes('DB_')) {
      return { type: ErrorType.DATABASE, code: 'DATABASE_CONNECTION_ERROR', severity: ErrorSeverity.HIGH };
    }

    // Default to unknown
    return { type: ErrorType.UNKNOWN, code: 'UNKNOWN_ERROR', severity: ErrorSeverity.MEDIUM };
  }

  /**
   * Execute operation with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context?: Record<string, any>,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig };
    let lastError: any;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        const appError = this.normalizeError(error, { ...context, attempt });
        
        // Don't retry if error is not retryable or this is the last attempt
        if (!appError.isRetryable || attempt === config.maxAttempts) {
          throw this.handleError(error, context);
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        console.warn(`Operation failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${delay}ms:`, error.message);
        
        await this.delay(delay);
      }
    }
    
    throw this.handleError(lastError, context);
  }

  /**
   * Create error boundary wrapper for React components
   */
  createErrorBoundary() {
    return (error: Error, errorInfo: any) => {
      this.handleError(error, {
        component: 'ErrorBoundary',
        errorInfo,
        operation: 'render'
      });
    };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): AppError[] {
    return this.errorLog.slice(-limit);
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: ErrorType): AppError[] {
    return this.errorLog.filter(error => error.type === type);
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Add error reporter
   */
  addErrorReporter(reporter: (error: AppError) => void): void {
    this.errorReporters.push(reporter);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recentTrends: Array<{ date: string; count: number }>;
  } {
    const total = this.errorLog.length;
    
    const byType = Object.values(ErrorType).reduce((acc, type) => {
      acc[type] = this.errorLog.filter(error => error.type === type).length;
      return acc;
    }, {} as Record<ErrorType, number>);

    const bySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
      acc[severity] = this.errorLog.filter(error => error.severity === severity).length;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    // Recent trends (last 7 days)
    const recentTrends = this.getErrorTrends(7);

    return { total, byType, bySeverity, recentTrends };
  }

  // Private helper methods
  private isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'type' in error && 'severity' in error;
  }

  private isRetryableError(code: string): boolean {
    return this.retryConfig.retryableErrors.includes(code);
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logError(error: AppError): void {
    const logLevel = this.config.logLevel;
    const message = `[${error.type}] ${error.code}: ${error.message}`;
    
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        console.error(message, error);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(message, error);
        break;
      case ErrorSeverity.LOW:
        if (logLevel === 'info' || logLevel === 'debug') {
          console.info(message, error);
        }
        break;
    }
  }

  private showErrorToast(error: AppError): void {
    const variant = error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL 
      ? 'destructive' : 'default';

    toast({
      title: this.getToastTitle(error.type),
      description: error.userMessage,
      variant,
      duration: error.severity === ErrorSeverity.HIGH ? 10000 : 5000
    });
  }

  private getToastTitle(type: ErrorType): string {
    const titles = {
      [ErrorType.VALIDATION]: 'Validation Error',
      [ErrorType.NETWORK]: 'Connection Error',
      [ErrorType.AUTH]: 'Authentication Error',
      [ErrorType.FILE_UPLOAD]: 'File Error',
      [ErrorType.AI_ANALYSIS]: 'Analysis Error',
      [ErrorType.DATABASE]: 'Data Error',
      [ErrorType.BUSINESS_LOGIC]: 'Business Rule Error',
      [ErrorType.UNKNOWN]: 'Unexpected Error'
    };
    
    return titles[type] || 'Error';
  }

  private reportError(error: AppError): void {
    this.errorReporters.forEach(reporter => {
      try {
        reporter(error);
      } catch (reporterError) {
        console.error('Error reporter failed:', reporterError);
      }
    });
  }

  private trimErrorLog(): void {
    const maxLogSize = 1000;
    if (this.errorLog.length > maxLogSize) {
      this.errorLog = this.errorLog.slice(-maxLogSize);
    }
  }

  private getCurrentUserId(): string | undefined {
    // This would integrate with your auth system
    return undefined;
  }

  private getSessionId(): string | undefined {
    // This would generate or retrieve session ID
    return undefined;
  }

  private getErrorTrends(days: number): Array<{ date: string; count: number }> {
    const trends: Array<{ date: string; count: number }> = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = this.errorLog.filter(error => 
        error.timestamp.toISOString().split('T')[0] === dateStr
      ).length;
      
      trends.push({ date: dateStr, count });
    }
    
    return trends;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const errorHandlingService = new ErrorHandlingService();

// Utility functions for common error handling patterns
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw errorHandlingService.handleError(error, {
        operation: fn.name,
        args: args.length > 0 ? 'provided' : 'none'
      });
    }
  };
};

export const createAsyncHandler = (handler: Function, context?: Record<string, any>) => {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      errorHandlingService.handleError(error, context);
    }
  };
};