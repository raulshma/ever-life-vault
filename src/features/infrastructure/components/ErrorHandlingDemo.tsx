import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InfrastructureErrorBoundary } from './ErrorBoundary';
import { ErrorDisplay, ErrorList, useErrorState } from './ErrorDisplay';
import { useErrorHandling } from '../hooks/useErrorHandling';
import { createInfrastructureError, ERROR_CODES } from '../utils/errorHandling';

// Component that demonstrates error boundary
const ErrorProneComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('This is a test error from ErrorProneComponent');
  }
  return <div className="p-4 bg-green-100 rounded">Component working normally!</div>;
};

// Main demo component
export function ErrorHandlingDemo() {
  const [shouldThrow, setShouldThrow] = useState(false);
  const { errors, addError, removeError, clearErrors } = useErrorState();
  const { 
    executeWithErrorHandling, 
    executeWithRetryAndErrorHandling,
    showSuccess, 
    showError, 
    showWarning, 
    showInfo 
  } = useErrorHandling();

  const simulateNetworkError = async () => {
    try {
      await executeWithRetryAndErrorHandling(
        async () => {
          // Simulate network failure
          throw new Error('Network connection failed');
        },
        'Network operation completed successfully'
      );
    } catch (error) {
      // Error is already handled by the hook
    }
  };

  const simulateDockerError = async () => {
    try {
      await executeWithErrorHandling(
        async () => {
          // Simulate Docker daemon error
          const error = new Error('Cannot connect to the Docker daemon at unix:///var/run/docker.sock');
          throw error;
        },
        'Docker operation completed successfully'
      );
    } catch (error) {
      // Error is already handled by the hook
    }
  };

  const simulateValidationError = () => {
    const error = createInfrastructureError(
      ERROR_CODES.VALIDATION_COMPOSE_SYNTAX,
      'Invalid YAML indentation on line 15'
    );
    addError(error);
  };

  const simulateSuccess = () => {
    showSuccess('Operation completed successfully', 'All services are now running');
  };

  const simulateWarning = () => {
    showWarning('Resource usage is high', 'Consider scaling down some services');
  };

  const simulateInfo = () => {
    showInfo('Deployment in progress', 'This may take a few minutes');
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Error Handling Demo</CardTitle>
          <CardDescription>
            Demonstration of comprehensive error handling features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Error Boundary Demo */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Error Boundary</h3>
            <p className="text-sm text-muted-foreground">
              Error boundaries catch JavaScript errors anywhere in the component tree
            </p>
            
            <InfrastructureErrorBoundary>
              <ErrorProneComponent shouldThrow={shouldThrow} />
            </InfrastructureErrorBoundary>
            
            <Button 
              onClick={() => setShouldThrow(!shouldThrow)}
              variant={shouldThrow ? "destructive" : "default"}
            >
              {shouldThrow ? 'Fix Component' : 'Break Component'}
            </Button>
          </div>

          {/* Toast Notifications Demo */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Toast Notifications</h3>
            <p className="text-sm text-muted-foreground">
              Different types of toast notifications with retry mechanisms
            </p>
            
            <div className="flex flex-wrap gap-2">
              <Button onClick={simulateNetworkError} variant="outline">
                Network Error (with Retry)
              </Button>
              <Button onClick={simulateDockerError} variant="outline">
                Docker Error
              </Button>
              <Button onClick={simulateSuccess} variant="outline">
                Success Toast
              </Button>
              <Button onClick={simulateWarning} variant="outline">
                Warning Toast
              </Button>
              <Button onClick={simulateInfo} variant="outline">
                Info Toast
              </Button>
            </div>
          </div>

          {/* Error Display Demo */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Error Display Components</h3>
            <p className="text-sm text-muted-foreground">
              Inline error displays with troubleshooting steps
            </p>
            
            <div className="flex gap-2 mb-4">
              <Button onClick={simulateValidationError} variant="outline">
                Add Validation Error
              </Button>
              <Button onClick={clearErrors} variant="outline" disabled={errors.length === 0}>
                Clear All Errors
              </Button>
            </div>

            <ErrorList
              errors={errors}
              onRetry={(error) => {
                showInfo('Retrying operation...', 'Please wait');
                removeError(error);
              }}
              onDismiss={removeError}
              onDismissAll={clearErrors}
            />
          </div>

          {/* Single Error Display Demo */}
          {errors.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Single Error Display (Compact)</h3>
              <ErrorDisplay
                error={errors[0]}
                compact={true}
                onRetry={() => {
                  showInfo('Retrying...', 'Operation will be attempted again');
                  removeError(errors[0]);
                }}
                onDismiss={() => removeError(errors[0])}
              />
            </div>
          )}

          {/* Usage Instructions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Usage Instructions</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>Error Boundary:</strong> Wrap components that might throw errors</p>
              <p><strong>Toast Notifications:</strong> Automatic error parsing and user-friendly messages</p>
              <p><strong>Retry Mechanisms:</strong> Automatic retries for transient failures</p>
              <p><strong>Error Display:</strong> Inline error components with troubleshooting</p>
              <p><strong>Error State Management:</strong> Centralized error collection and management</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}