import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NotificationsUISettings } from '../components/NotificationsUISettings';
import { IntegrationSettings } from '../components/IntegrationSettings';
import { SecuritySettings } from '../components/SecuritySettings';

// Mock the hooks and components that these settings components depend on
vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    notificationConfig: {
      receipt_analysis_complete: true,
      budget_alerts: true,
      integration_errors: true,
      system_updates: true,
      focus_session_complete: true,
      daily_goal_achieved: true,
      toast_duration_seconds: 5,
      enable_sound_notifications: true,
      enable_browser_notifications: true
    },
    setNotificationConfig: vi.fn().mockResolvedValue(true),
    uiConfig: {
      theme_mode: 'system',
      view_transitions_enabled: true,
      auto_categorize_sidebar: true,
      reduce_motion: false,
      high_contrast: false,
      compact_ui: false,
      sidebar_collapsed_by_default: false
    },
    setUIConfig: vi.fn().mockResolvedValue(true),
    themeMode: 'system',
    setThemeMode: vi.fn(),
    integrationConfig: {
      default_timeout_seconds: 30,
      auto_refresh_tokens: true,
      oauth_callback_timeout_seconds: 300,
      enable_integration_caching: true,
      cache_duration_minutes: 30,
      max_retry_attempts: 3,
      retry_delay_seconds: 5,
      steam: {
        show_private_profile_warning: true,
        cache_duration_hours: 6
      },
      mal: {
        default_list_status: 'watching',
        auto_update_progress: true
      },
      aggregator: {
        max_items_per_feed: 50,
        refresh_interval_minutes: 60
      }
    },
    setIntegrationConfig: vi.fn().mockResolvedValue(true),
    securityConfig: {
      vault_session_timeout_minutes: 60,
      require_master_password_confirmation: true,
      auto_lock_on_idle: true,
      idle_timeout_minutes: 15,
      backup_frequency_days: 7,
      max_backup_count: 10,
      encrypt_local_storage: true,
      require_2fa: false,
      password_requirements: {
        min_length: 12,
        require_uppercase: true,
        require_lowercase: true,
        require_numbers: true,
        require_symbols: true
      }
    },
    setSecurityConfig: vi.fn().mockResolvedValue(true)
  })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock the UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div data-testid="card-content" {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <p data-testid="card-description" {...props}>{children}</p>,
  CardHeader: ({ children, ...props }: any) => <div data-testid="card-header" {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 data-testid="card-title" {...props}>{children}</h3>
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: (props: any) => <input type="checkbox" {...props} />
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: (props: any) => <input type="range" {...props} />
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: (props: any) => <hr {...props} />
}));

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div data-testid="alert" {...props}>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>
}));

describe('Settings Components', () => {
  it('renders Notifications & UI Settings component', () => {
    render(<NotificationsUISettings />);
    
    // Check that the component renders
    expect(screen.getByText('Notifications & UI Configuration')).toBeInTheDocument();
    expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    expect(screen.getByText('UI & Theme Preferences')).toBeInTheDocument();
  });

  it('renders Integration Settings component', () => {
    render(<IntegrationSettings />);
    
    // Check that the component renders
    expect(screen.getByText('Integration Configuration')).toBeInTheDocument();
    expect(screen.getByText('General Settings')).toBeInTheDocument();
    expect(screen.getByText('Steam Integration')).toBeInTheDocument();
  });

  it('renders Security Settings component', () => {
    render(<SecuritySettings />);
    
    // Check that the component renders
    expect(screen.getByText('Security & Vault Configuration')).toBeInTheDocument();
    expect(screen.getByText('Vault Security')).toBeInTheDocument();
    expect(screen.getByText('Password Requirements')).toBeInTheDocument();
  });
});