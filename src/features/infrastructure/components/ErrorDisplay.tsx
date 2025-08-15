import React from 'react';
import { AlertTriangle, RefreshCw, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { InfrastructureError } from '../utils/errorHandling';
import { useState } from 'react';

interface ErrorDisplayProps {
  error: InfrastructureError;
  onRetry?: () => void;
  onDismiss?: () => void;
  showTroubleshooting?: boolean;
  compact?: boolean;
  className?: string;
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  showTroubleshooting = true,
  compact = false,
  className = '',
}: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <HelpCircle className="h-4 w-4" />;
    }
  };

  if (compact) {
    return (
      <Alert className={`border-destructive/50 ${className}`}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>{error.message}</span>
          <div className="flex items-center gap-2">
            <Badge variant={getSeverityColor(error.severity)}>
              {error.severity}
            </Badge>
            {error.retryable && onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </AlertTitle>
        {error.details && (
          <AlertDescription className="text-sm text-muted-foreground">
            {error.details}
          </AlertDescription>
        )}
      </Alert>
    );
  }

  return (
    <Alert className={`border-destructive/50 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getSeverityIcon(error.severity)}
        </div>
        
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <AlertTitle className="flex items-center gap-2">
              {error.message}
              <Badge variant={getSeverityColor(error.severity)}>
                {error.severity}
              </Badge>
            </AlertTitle>
            
            <div className="flex items-center gap-2">
              {error.retryable && onRetry && (
                <Button size="sm" variant="outline" onClick={onRetry}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
              {onDismiss && (
                <Button size="sm" variant="ghost" onClick={onDismiss}>
                  Dismiss
                </Button>
              )}
            </div>
          </div>

          {error.details && (
            <AlertDescription className="text-sm">
              <strong>Details:</strong> {error.details}
            </AlertDescription>
          )}

          {showTroubleshooting && error.troubleshooting.length > 0 && (
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-auto font-normal">
                  <div className="flex items-center gap-1">
                    {showDetails ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    Troubleshooting Steps
                  </div>
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-2">
                <div className="bg-muted/50 rounded-md p-3">
                  <h4 className="text-sm font-medium mb-2">Try these steps:</h4>
                  <ul className="space-y-1">
                    {error.troubleshooting.map((step, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary font-medium min-w-[1.5rem]">
                          {index + 1}.
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {process.env.NODE_ENV === 'development' && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-auto font-normal text-xs">
                  <div className="flex items-center gap-1">
                    <ChevronDown className="h-3 w-3" />
                    Debug Info
                  </div>
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-2">
                <div className="bg-muted/30 rounded-md p-2">
                  <pre className="text-xs text-muted-foreground overflow-auto">
                    Error Code: {error.code}
                    {error.details && `\nDetails: ${error.details}`}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </Alert>
  );
}

// Component for displaying multiple errors
interface ErrorListProps {
  errors: InfrastructureError[];
  onRetry?: (error: InfrastructureError) => void;
  onDismiss?: (error: InfrastructureError) => void;
  onDismissAll?: () => void;
  className?: string;
}

export function ErrorList({
  errors,
  onRetry,
  onDismiss,
  onDismissAll,
  className = '',
}: ErrorListProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {errors.length > 1 && onDismissAll && (
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-destructive">
            {errors.length} Error{errors.length > 1 ? 's' : ''} Occurred
          </h3>
          <Button size="sm" variant="outline" onClick={onDismissAll}>
            Dismiss All
          </Button>
        </div>
      )}
      
      {errors.map((error, index) => (
        <ErrorDisplay
          key={`${error.code}-${index}`}
          error={error}
          onRetry={() => onRetry?.(error)}
          onDismiss={() => onDismiss?.(error)}
          compact={errors.length > 3}
        />
      ))}
    </div>
  );
}

// Hook for managing error state
export function useErrorState() {
  const [errors, setErrors] = useState<InfrastructureError[]>([]);

  const addError = (error: InfrastructureError) => {
    setErrors(prev => [...prev, error]);
  };

  const removeError = (error: InfrastructureError) => {
    setErrors(prev => prev.filter(e => e !== error));
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const hasErrors = errors.length > 0;
  const hasCriticalErrors = errors.some(e => e.severity === 'critical');

  return {
    errors,
    addError,
    removeError,
    clearErrors,
    hasErrors,
    hasCriticalErrors,
  };
}