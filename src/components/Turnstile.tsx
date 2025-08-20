import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          'timeout-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'invisible';
          appearance?: 'always' | 'execute' | 'interaction-only';
          execution?: 'render' | 'execute';
          refresh?: 'auto' | 'manual' | 'never';
          'refresh-expired'?: 'auto' | 'manual' | 'never';
          'refresh-timeout'?: 'auto' | 'manual' | 'never';
          'before-interactive-callback'?: () => void;
          'after-interactive-callback'?: () => void;
          'unsupported-callback'?: () => void;
          'response-field'?: boolean;
          'response-field-name'?: string;
          'tabindex'?: number;
          'retry'?: 'auto' | 'never';
          'retry-interval'?: number;
        }
      ) => string;
      reset: (widgetId: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
      isExpired: (widgetId?: string) => boolean;
      remove: (widgetId: string) => void;
      ready: (callback: () => void) => void;
    };
  }
}

interface TurnstileProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'invisible';
  appearance?: 'always' | 'execute' | 'interaction-only';
  className?: string;
  disabled?: boolean;
}

export const Turnstile: React.FC<TurnstileProps> = ({
  siteKey,
  onVerify,
  onError,
  onExpire,
  theme = 'auto',
  size = 'normal',
  appearance = 'always',
  className = '',
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load Turnstile script if not already loaded
    if (!window.turnstile) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => setIsLoaded(true);
      script.onerror = () => setError('Failed to load Turnstile script');
      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    } else {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !containerRef.current || disabled) return;

    try {
      const id = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          onVerify(token);
        },
        'error-callback': () => {
          setError('Turnstile verification failed');
          onError?.();
        },
        'expired-callback': () => {
          setError('Turnstile token expired');
          onExpire?.();
        },
        'timeout-callback': () => {
          setError('Turnstile verification timed out');
          onError?.();
        },
        theme,
        size,
        appearance,
        'refresh-expired': 'auto',
        'refresh-timeout': 'auto',
      });
      setWidgetId(id);
      setError(null);
    } catch (err) {
      setError('Failed to render Turnstile widget');
      console.error('Turnstile render error:', err);
    }
  }, [isLoaded, siteKey, onVerify, onError, onExpire, theme, size, appearance, disabled]);

  useEffect(() => {
    // Reset widget when disabled changes
    if (widgetId && window.turnstile) {
      if (disabled) {
        window.turnstile.remove(widgetId);
        setWidgetId(null);
      }
    }
  }, [disabled, widgetId]);

  if (error) {
    return (
      <div className={`text-center p-4 border border-destructive/20 rounded-md bg-destructive/5 ${className}`}>
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
        >
          Reload page
        </button>
      </div>
    );
  }

  if (disabled) {
    return (
      <div className={`text-center p-4 border border-muted rounded-md bg-muted/20 ${className}`}>
        <p className="text-sm text-muted-foreground">Verification disabled</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex justify-center ${className}`}
      data-testid="turnstile-widget"
    />
  );
};

export default Turnstile;
