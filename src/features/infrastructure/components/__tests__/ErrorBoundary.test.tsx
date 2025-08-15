import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InfrastructureErrorBoundary } from '../ErrorBoundary';
import { afterEach } from 'node:test';

// Mock window.location
const mockLocation = {
  href: ''
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

describe('InfrastructureErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
    // Suppress console.error for these tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render children when no error occurs', () => {
    render(
      <InfrastructureErrorBoundary>
        <ThrowError shouldThrow={false} />
      </InfrastructureErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render error UI when error occurs', () => {
    render(
      <InfrastructureErrorBoundary>
        <ThrowError shouldThrow={true} />
      </InfrastructureErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An error occurred in the infrastructure management interface')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('should show troubleshooting steps', () => {
    render(
      <InfrastructureErrorBoundary>
        <ThrowError shouldThrow={true} />
      </InfrastructureErrorBoundary>
    );

    expect(screen.getByText('Troubleshooting steps:')).toBeInTheDocument();
    expect(screen.getByText('• Try refreshing the page')).toBeInTheDocument();
    expect(screen.getByText('• Check your network connection')).toBeInTheDocument();
    expect(screen.getByText('• Verify Docker daemon is running')).toBeInTheDocument();
    expect(screen.getByText('• Check browser console for additional errors')).toBeInTheDocument();
  });

  it('should have Try Again button that resets error state', () => {
    const TestComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Test error message');
      }
      return <div>No error</div>;
    };

    const { rerender } = render(
      <InfrastructureErrorBoundary>
        <TestComponent shouldThrow={true} />
      </InfrastructureErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    const tryAgainButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(tryAgainButton);

    // After clicking try again, the error boundary should reset
    // We need to re-render with a component that doesn't throw
    rerender(
      <InfrastructureErrorBoundary>
        <TestComponent shouldThrow={false} />
      </InfrastructureErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should have Go Home button that navigates to home', () => {
    render(
      <InfrastructureErrorBoundary>
        <ThrowError shouldThrow={true} />
      </InfrastructureErrorBoundary>
    );

    const goHomeButton = screen.getByRole('button', { name: /go home/i });
    fireEvent.click(goHomeButton);

    expect(mockLocation.href).toBe('/');
  });

  it('should call onError callback when provided', () => {
    const onError = vi.fn();

    render(
      <InfrastructureErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </InfrastructureErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error fallback</div>;

    render(
      <InfrastructureErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </InfrastructureErrorBoundary>
    );

    expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should show debug info in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <InfrastructureErrorBoundary>
        <ThrowError shouldThrow={true} />
      </InfrastructureErrorBoundary>
    );

    expect(screen.getByText('Error Details (Development)')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should not show debug info in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <InfrastructureErrorBoundary>
        <ThrowError shouldThrow={true} />
      </InfrastructureErrorBoundary>
    );

    expect(screen.queryByText('Error Details (Development)')).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should log error in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <InfrastructureErrorBoundary>
        <ThrowError shouldThrow={true} />
      </InfrastructureErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Infrastructure Error Boundary caught an error:',
      expect.any(Error),
      expect.any(Object)
    );

    process.env.NODE_ENV = originalEnv;
  });
});