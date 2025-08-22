import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, X } from 'lucide-react';
import type { ValidationError, ValidationWarning } from '../validation/schemas';

interface ValidationDisplayProps {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  onDismissWarning?: (index: number) => void;
  className?: string;
}

export const ValidationDisplay: React.FC<ValidationDisplayProps> = ({
  errors,
  warnings,
  onDismissWarning,
  className = ''
}) => {
  const [showDetails, setShowDetails] = React.useState(false);
  
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Error Summary */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                {errors.length} validation error{errors.length !== 1 ? 's' : ''} found
              </span>
              <Badge variant="destructive" className="ml-2">
                {errors.length}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning Summary */}
      {warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                {warnings.length} warning{warnings.length !== 1 ? 's' : ''} found
              </span>
              <Badge variant="secondary" className="ml-2">
                {warnings.length}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed View Toggle */}
      {(errors.length > 0 || warnings.length > 0) && (
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center gap-2 p-0 h-auto">
              {showDetails ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              View Details
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-2 mt-3">
            {/* Detailed Errors */}
            {errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Errors
                </h4>
                {errors.map((error, index) => (
                  <ValidationErrorItem key={index} error={error} />
                ))}
              </div>
            )}

            {/* Detailed Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-warning flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </h4>
                {warnings.map((warning, index) => (
                  <ValidationWarningItem 
                    key={index} 
                    warning={warning} 
                    onDismiss={onDismissWarning ? () => onDismissWarning(index) : undefined}
                  />
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

// Individual error item component
const ValidationErrorItem: React.FC<{ error: ValidationError }> = ({ error }) => {
  return (
    <div className="flex items-start gap-3 p-3 border border-destructive/20 rounded-lg bg-destructive/5">
      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs border-destructive/20">
            {error.field}
          </Badge>
        </div>
        <p className="text-sm text-destructive">{error.message}</p>
        {error.path && error.path.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Path: {error.path.join(' → ')}
          </p>
        )}
      </div>
    </div>
  );
};

// Individual warning item component
const ValidationWarningItem: React.FC<{ 
  warning: ValidationWarning; 
  onDismiss?: () => void;
}> = ({ warning, onDismiss }) => {
  return (
    <div className="flex items-start gap-3 p-3 border border-warning/20 rounded-lg bg-warning/5">
      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs border-orange-200">
            {warning.field}
          </Badge>
        </div>
        <p className="text-sm text-orange-800">{warning.message}</p>
        {warning.path && warning.path.length > 0 && (
          <p className="text-xs text-orange-600 mt-1">
            Path: {warning.path.join(' → ')}
          </p>
        )}
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-6 w-6 p-0 text-orange-600 hover:text-orange-800"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

// Inline field validation component
interface FieldValidationProps {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  className?: string;
}

export const FieldValidation: React.FC<FieldValidationProps> = ({
  errors,
  warnings,
  className = ''
}) => {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {errors.map((error, index) => (
        <div key={`error-${index}`} className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      ))}
      {warnings.map((warning, index) => (
        <div key={`warning-${index}`} className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span>{warning.message}</span>
        </div>
      ))}
    </div>
  );
};

// Validation status indicator
interface ValidationStatusProps {
  hasErrors: boolean;
  hasWarnings: boolean;
  isValidating?: boolean;
  className?: string;
}

export const ValidationStatus: React.FC<ValidationStatusProps> = ({
  hasErrors,
  hasWarnings,
  isValidating = false,
  className = ''
}) => {
  if (isValidating) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <div className="h-3 w-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
        <span>Validating...</span>
      </div>
    );
  }

  if (hasErrors) {
    return (
      <div className={`flex items-center gap-2 text-sm text-destructive ${className}`}>
        <AlertCircle className="h-3 w-3" />
        <span>Has errors</span>
      </div>
    );
  }

  if (hasWarnings) {
    return (
      <div className={`flex items-center gap-2 text-sm text-warning ${className}`}>
        <AlertTriangle className="h-3 w-3" />
        <span>Has warnings</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-sm text-success ${className}`}>
      <div className="h-3 w-3 rounded-full bg-success" />
      <span>Valid</span>
    </div>
  );
};

// Common validation error messages component
export const ValidationHelp: React.FC<{ field: string }> = ({ field }) => {
  const getHelpText = (fieldName: string): string => {
    switch (fieldName) {
      case 'serviceName':
        return 'Service names must be lowercase, contain only letters, numbers, underscores, and hyphens, and cannot start or end with a hyphen.';
      case 'dockerImage':
        return 'Docker images should follow the format: [registry/]name[:tag]. Examples: nginx:latest, redis:alpine, myregistry.com/myapp:v1.0';
      case 'hostPort':
        return 'Host ports must be between 1-65535. Ports below 1024 require root privileges. Avoid using port 22 (SSH).';
      case 'containerPort':
        return 'Container ports must be between 1-65535 and should match the port your application listens on.';
      case 'environmentKey':
        return 'Environment variable keys can use letters, numbers, and underscores. Avoid overriding system variables like PATH, HOME, USER.';
      case 'hostPath':
        return 'Host paths must be absolute paths (Unix: /path, Windows: C:\\path or \\\\server\\share). Avoid relative paths (..) for security.';
      case 'containerPath':
        return 'Container paths must be absolute paths. Avoid mounting to system directories like /etc, /usr, /bin for security.';
      case 'volumeMount':
        return 'Volume mounts should avoid system paths and use read-only mode when possible. Format: host_path:container_path:mode';
      case 'portMapping':
        return 'Port mappings support formats like "8080", "8080:8080", "127.0.0.1:8080:8080", or with /tcp or /udp protocol.';
      default:
        return '';
    }
  };

  const helpText = getHelpText(field);
  
  if (!helpText) {
    return null;
  }

  return (
    <p className="text-xs text-muted-foreground mt-1">
      {helpText}
    </p>
  );
};