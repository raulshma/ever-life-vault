import { render, screen, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';
import { Turnstile } from '../Turnstile';

// Mock the global turnstile object
const mockTurnstile = {
  render: vi.fn().mockReturnValue('test-widget-id'),
  reset: vi.fn(),
  getResponse: vi.fn(),
  isExpired: vi.fn(),
  remove: vi.fn(),
  ready: vi.fn(),
};

// Mock the script loading
const mockScript = {
  src: '',
  async: false,
  defer: false,
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
};

Object.defineProperty(document, 'createElement', {
  value: vi.fn().mockReturnValue(mockScript),
});

Object.defineProperty(document.head, 'appendChild', {
  value: vi.fn(),
});

Object.defineProperty(document.head, 'removeChild', {
  value: vi.fn(),
});

describe('Turnstile Component', () => {
  const defaultProps = {
    siteKey: 'test-site-key',
    onVerify: vi.fn(),
    onError: vi.fn(),
    onExpire: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global turnstile
    (global as any).window.turnstile = undefined;
    // Reset script mock
    mockScript.onload = null;
    mockScript.onerror = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    render(<Turnstile {...defaultProps} />);
    expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument();
  });

  it('loads Turnstile script when not available', async () => {
    const appendChildSpy = vi.spyOn(document.head, 'appendChild');
    
    render(<Turnstile {...defaultProps} />);
    
    expect(appendChildSpy).toHaveBeenCalledWith(mockScript);
    expect(mockScript.src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js');
    expect(mockScript.async).toBe(true);
    expect(mockScript.defer).toBe(true);
  });

  it('renders widget when script loads successfully', async () => {
    const appendChildSpy = vi.spyOn(document.head, 'appendChild');
    
    render(<Turnstile {...defaultProps} />);
    
    // Simulate script load
    if (mockScript.onload) {
      mockScript.onload();
    }
    
    await waitFor(() => {
      expect(appendChildSpy).toHaveBeenCalled();
    });
  });

  it('handles script load error', async () => {
    const appendChildSpy = vi.spyOn(document.head, 'appendChild');
    
    render(<Turnstile {...defaultProps} />);
    
    // Simulate script error
    if (mockScript.onerror) {
      mockScript.onerror();
    }
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load Turnstile script')).toBeInTheDocument();
    });
  });

  it('uses existing turnstile when available', async () => {
    (global as any).window.turnstile = mockTurnstile;
    
    render(<Turnstile {...defaultProps} />);
    
    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          sitekey: 'test-site-key',
          callback: expect.any(Function),
          'error-callback': expect.any(Function),
          'expired-callback': expect.any(Function),
          'timeout-callback': expect.any(Function),
        })
      );
    });
  });

  it('calls onVerify when widget verification succeeds', async () => {
    (global as any).window.turnstile = mockTurnstile;
    
    render(<Turnstile {...defaultProps} />);
    
    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalled();
    });
    
    // Get the callback function that was passed to render
    const renderCall = mockTurnstile.render.mock.calls[0];
    const options = renderCall[1];
    const callback = options.callback;
    
    // Simulate successful verification
    callback('test-token');
    
    expect(defaultProps.onVerify).toHaveBeenCalledWith('test-token');
  });

  it('calls onError when widget verification fails', async () => {
    (global as any).window.turnstile = mockTurnstile;
    
    render(<Turnstile {...defaultProps} />);
    
    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalled();
    });
    
    // Get the error callback function
    const renderCall = mockTurnstile.render.mock.calls[0];
    const options = renderCall[1];
    const errorCallback = options['error-callback'];
    
    // Simulate verification error
    errorCallback();
    
    expect(defaultProps.onError).toHaveBeenCalled();
  });

  it('calls onExpire when widget token expires', async () => {
    (global as any).window.turnstile = mockTurnstile;
    
    render(<Turnstile {...defaultProps} />);
    
    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalled();
    });
    
    // Get the expire callback function
    const renderCall = mockTurnstile.render.mock.calls[0];
    const options = renderCall[1];
    const expireCallback = options['expired-callback'];
    
    // Simulate token expiration
    expireCallback();
    
    expect(defaultProps.onExpire).toHaveBeenCalled();
  });

  it('shows disabled state when disabled prop is true', () => {
    render(<Turnstile {...defaultProps} disabled={true} />);
    expect(screen.getByText('Verification disabled')).toBeInTheDocument();
  });

  it('removes widget when disabled changes to true', async () => {
    (global as any).window.turnstile = mockTurnstile;
    
    const { rerender } = render(<Turnstile {...defaultProps} disabled={false} />);
    
    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalled();
    });
    
    // Change to disabled
    rerender(<Turnstile {...defaultProps} disabled={true} />);
    
    expect(screen.getByText('Verification disabled')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Turnstile {...defaultProps} className="custom-class" />);
    const widget = screen.getByTestId('turnstile-widget');
    expect(widget).toHaveClass('custom-class');
  });

  it('renders with different themes', async () => {
    (global as any).window.turnstile = mockTurnstile;
    
    render(<Turnstile {...defaultProps} theme="dark" />);
    
    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          theme: 'dark',
        })
      );
    });
  });

  it('renders with different sizes', async () => {
    (global as any).window.turnstile = mockTurnstile;
    
    render(<Turnstile {...defaultProps} size="compact" />);
    
    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          size: 'compact',
        })
      );
    });
  });

  it('renders with different appearances', async () => {
    (global as any).window.turnstile = mockTurnstile;
    
    render(<Turnstile {...defaultProps} appearance="interaction-only" />);
    
    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          appearance: 'interaction-only',
        })
      );
    });
  });
});
