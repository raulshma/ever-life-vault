import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorDisplay, ErrorList, useErrorState } from '../ErrorDisplay';
import { createInfrastructureError, ERROR_CODES } from '../../utils/errorHandling';
import { renderHook, act } from '@testing-library/react';

describe('ErrorDisplay', () => {
  const mockError = createInfrastructureError(
    ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE,
    'Docker daemon connection failed'
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render error message and details', () => {
    render(<ErrorDisplay error={mockError} />);

    expect(screen.getByText(mockError.message)).toBeInTheDocument();
    expect(screen.getByText(`Details: ${mockError.details}`)).toBeInTheDocument();
  });

  it('should show severity badge', () => {
    render(<ErrorDisplay error={mockError} />);

    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('should show retry button for retryable errors', () => {
    const onRetry = vi.fn();
    render(<ErrorDisplay error={mockError} onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should not show retry button for non-retryable errors', () => {
    const nonRetryableError = createInfrastructureError(ERROR_CODES.VALIDATION_COMPOSE_SYNTAX);
    render(<ErrorDisplay error={nonRetryableError} />);

    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('should show dismiss button when onDismiss provided', () => {
    const onDismiss = vi.fn();
    render(<ErrorDisplay error={mockError} onDismiss={onDismiss} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    expect(dismissButton).toBeInTheDocument();

    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should show troubleshooting steps by default', () => {
    render(<ErrorDisplay error={mockError} />);

    const troubleshootingButton = screen.getByRole('button', { name: /troubleshooting steps/i });
    expect(troubleshootingButton).toBeInTheDocument();

    fireEvent.click(troubleshootingButton);
    
    mockError.troubleshooting.forEach(step => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });
  });

  it('should hide troubleshooting when showTroubleshooting is false', () => {
    render(<ErrorDisplay error={mockError} showTroubleshooting={false} />);

    expect(screen.queryByRole('button', { name: /troubleshooting steps/i })).not.toBeInTheDocument();
  });

  it('should render in compact mode', () => {
    render(<ErrorDisplay error={mockError} compact={true} />);

    // In compact mode, the structure is simpler
    expect(screen.getByText(mockError.message)).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('should show debug info in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(<ErrorDisplay error={mockError} />);

    const debugButton = screen.getByRole('button', { name: /debug info/i });
    expect(debugButton).toBeInTheDocument();

    fireEvent.click(debugButton);
    expect(screen.getByText(`Error Code: ${mockError.code}`)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should not show debug info in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(<ErrorDisplay error={mockError} />);

    expect(screen.queryByRole('button', { name: /debug info/i })).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});

describe('ErrorList', () => {
  const errors = [
    createInfrastructureError(ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE),
    createInfrastructureError(ERROR_CODES.NETWORK_CONNECTION_FAILED),
    createInfrastructureError(ERROR_CODES.VALIDATION_COMPOSE_SYNTAX)
  ];

  it('should render nothing when no errors', () => {
    const { container } = render(<ErrorList errors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render all errors', () => {
    render(<ErrorList errors={errors} />);

    errors.forEach(error => {
      expect(screen.getByText(error.message)).toBeInTheDocument();
    });
  });

  it('should show error count and dismiss all button for multiple errors', () => {
    const onDismissAll = vi.fn();
    render(<ErrorList errors={errors} onDismissAll={onDismissAll} />);

    expect(screen.getByText('3 Errors Occurred')).toBeInTheDocument();
    
    const dismissAllButton = screen.getByRole('button', { name: /dismiss all/i });
    expect(dismissAllButton).toBeInTheDocument();

    fireEvent.click(dismissAllButton);
    expect(onDismissAll).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry for individual errors', () => {
    const onRetry = vi.fn();
    render(<ErrorList errors={[errors[0]]} onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledWith(errors[0]);
  });

  it('should call onDismiss for individual errors', () => {
    const onDismiss = vi.fn();
    render(<ErrorList errors={[errors[0]]} onDismiss={onDismiss} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledWith(errors[0]);
  });

  it('should render errors in compact mode when many errors', () => {
    const manyErrors = Array(5).fill(null).map((_, i) => 
      createInfrastructureError(ERROR_CODES.UNKNOWN_ERROR, `Error ${i}`)
    );

    render(<ErrorList errors={manyErrors} />);

    // With more than 3 errors, they should be rendered in compact mode
    // We can verify this by checking that the structure is simpler
    expect(screen.getAllByText('An unexpected error occurred')).toHaveLength(5);
  });
});

describe('useErrorState', () => {
  it('should initialize with empty errors', () => {
    const { result } = renderHook(() => useErrorState());

    expect(result.current.errors).toEqual([]);
    expect(result.current.hasErrors).toBe(false);
    expect(result.current.hasCriticalErrors).toBe(false);
  });

  it('should add errors', () => {
    const { result } = renderHook(() => useErrorState());
    const error = createInfrastructureError(ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE);

    act(() => {
      result.current.addError(error);
    });

    expect(result.current.errors).toContain(error);
    expect(result.current.hasErrors).toBe(true);
    expect(result.current.hasCriticalErrors).toBe(true);
  });

  it('should remove errors', () => {
    const { result } = renderHook(() => useErrorState());
    const error = createInfrastructureError(ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE);

    act(() => {
      result.current.addError(error);
    });

    expect(result.current.errors).toContain(error);

    act(() => {
      result.current.removeError(error);
    });

    expect(result.current.errors).not.toContain(error);
    expect(result.current.hasErrors).toBe(false);
  });

  it('should clear all errors', () => {
    const { result } = renderHook(() => useErrorState());
    const error1 = createInfrastructureError(ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE);
    const error2 = createInfrastructureError(ERROR_CODES.NETWORK_CONNECTION_FAILED);

    act(() => {
      result.current.addError(error1);
      result.current.addError(error2);
    });

    expect(result.current.errors).toHaveLength(2);

    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.errors).toEqual([]);
    expect(result.current.hasErrors).toBe(false);
  });

  it('should detect critical errors', () => {
    const { result } = renderHook(() => useErrorState());
    const criticalError = createInfrastructureError(ERROR_CODES.DOCKER_DAEMON_UNAVAILABLE);
    const mediumError = createInfrastructureError(ERROR_CODES.NETWORK_CONNECTION_FAILED);

    act(() => {
      result.current.addError(mediumError);
    });

    expect(result.current.hasCriticalErrors).toBe(false);

    act(() => {
      result.current.addError(criticalError);
    });

    expect(result.current.hasCriticalErrors).toBe(true);
  });
});