import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecretsManager } from '../SecretsManager';
import { SecretFormData, SecretImportData, SecretExportData } from '../../types';

// Mock the toast function
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
});

describe('SecretsManager', () => {
  const mockSecrets = [
    {
      key: 'DATABASE_URL',
      description: 'Database connection string',
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      key: 'API_KEY',
      description: 'External API key',
      created_at: '2024-01-02T00:00:00Z'
    }
  ];

  const mockProps = {
    secrets: mockSecrets,
    onCreateSecret: vi.fn().mockResolvedValue(undefined),
    onUpdateSecret: vi.fn().mockResolvedValue(undefined),
    onDeleteSecret: vi.fn().mockResolvedValue(undefined),
    onImportSecrets: vi.fn().mockResolvedValue(undefined),
    onExportSecrets: vi.fn().mockResolvedValue({
      secrets: mockSecrets,
      exported_at: '2024-01-01T00:00:00Z',
      total_count: 2
    } as SecretExportData),
    loading: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render secrets list', () => {
    render(<SecretsManager {...mockProps} />);
    
    expect(screen.getByText('Secrets Management')).toBeInTheDocument();
    expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
    expect(screen.getByText('API_KEY')).toBeInTheDocument();
    expect(screen.getByText('Database connection string')).toBeInTheDocument();
    expect(screen.getByText('External API key')).toBeInTheDocument();
  });

  it('should show empty state when no secrets exist', () => {
    render(<SecretsManager {...mockProps} secrets={[]} />);
    
    expect(screen.getByText('No secrets configured')).toBeInTheDocument();
    expect(screen.getByText('Add Your First Secret')).toBeInTheDocument();
  });

  it('should open create secret dialog', async () => {
    render(<SecretsManager {...mockProps} />);
    
    fireEvent.click(screen.getByText('Add Secret'));
    
    await waitFor(() => {
      expect(screen.getByText('Create New Secret')).toBeInTheDocument();
      expect(screen.getByLabelText('Key')).toBeInTheDocument();
      expect(screen.getByLabelText('Value')).toBeInTheDocument();
      expect(screen.getByLabelText('Description (Optional)')).toBeInTheDocument();
    });
  });

  it('should create a new secret', async () => {
    render(<SecretsManager {...mockProps} />);
    
    // Open create dialog
    fireEvent.click(screen.getByText('Add Secret'));
    
    await waitFor(() => {
      expect(screen.getByText('Create New Secret')).toBeInTheDocument();
    });
    
    // Fill form
    fireEvent.change(screen.getByLabelText('Key'), {
      target: { value: 'NEW_SECRET' }
    });
    fireEvent.change(screen.getByLabelText('Value'), {
      target: { value: 'secret-value' }
    });
    fireEvent.change(screen.getByLabelText('Description (Optional)'), {
      target: { value: 'A new test secret' }
    });
    
    // Submit form
    fireEvent.click(screen.getByText('Create Secret'));
    
    await waitFor(() => {
      expect(mockProps.onCreateSecret).toHaveBeenCalledWith({
        key: 'NEW_SECRET',
        value: 'secret-value',
        description: 'A new test secret'
      });
    });
  });

  it('should validate secret key format', async () => {
    render(<SecretsManager {...mockProps} />);
    
    // Open create dialog
    fireEvent.click(screen.getByText('Add Secret'));
    
    await waitFor(() => {
      expect(screen.getByText('Create New Secret')).toBeInTheDocument();
    });
    
    // Enter invalid key
    fireEvent.change(screen.getByLabelText('Key'), {
      target: { value: 'invalid-key' }
    });
    fireEvent.change(screen.getByLabelText('Value'), {
      target: { value: 'secret-value' }
    });
    
    // Try to submit
    fireEvent.click(screen.getByText('Create Secret'));
    
    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/Secret key must contain only uppercase letters/)).toBeInTheDocument();
    });
    
    // Should not call create function
    expect(mockProps.onCreateSecret).not.toHaveBeenCalled();
  });

  it('should prevent duplicate secret keys', async () => {
    render(<SecretsManager {...mockProps} />);
    
    // Open create dialog
    fireEvent.click(screen.getByText('Add Secret'));
    
    await waitFor(() => {
      expect(screen.getByText('Create New Secret')).toBeInTheDocument();
    });
    
    // Enter existing key
    fireEvent.change(screen.getByLabelText('Key'), {
      target: { value: 'DATABASE_URL' }
    });
    fireEvent.change(screen.getByLabelText('Value'), {
      target: { value: 'secret-value' }
    });
    
    // Try to submit
    fireEvent.click(screen.getByText('Create Secret'));
    
    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('A secret with this key already exists')).toBeInTheDocument();
    });
    
    // Should not call create function
    expect(mockProps.onCreateSecret).not.toHaveBeenCalled();
  });

  it('should toggle password visibility', async () => {
    render(<SecretsManager {...mockProps} />);
    
    // Open create dialog
    fireEvent.click(screen.getByText('Add Secret'));
    
    await waitFor(() => {
      expect(screen.getByText('Create New Secret')).toBeInTheDocument();
    });
    
    const valueInput = screen.getByLabelText('Value');
    const toggleButton = screen.getByRole('button', { name: /show|hide/i });
    
    // Initially should be password type
    expect(valueInput).toHaveAttribute('type', 'password');
    
    // Click toggle
    fireEvent.click(toggleButton);
    
    // Should now be text type
    expect(valueInput).toHaveAttribute('type', 'text');
    
    // Click toggle again
    fireEvent.click(toggleButton);
    
    // Should be password type again
    expect(valueInput).toHaveAttribute('type', 'password');
  });

  it('should open edit dialog for existing secret', async () => {
    render(<SecretsManager {...mockProps} />);
    
    // Click edit button for first secret
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Edit Secret')).toBeInTheDocument();
      expect(screen.getByDisplayValue('DATABASE_URL')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Database connection string')).toBeInTheDocument();
    });
  });

  it('should update existing secret', async () => {
    render(<SecretsManager {...mockProps} />);
    
    // Click edit button for first secret
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Edit Secret')).toBeInTheDocument();
    });
    
    // Update value and description
    fireEvent.change(screen.getByLabelText('New Value'), {
      target: { value: 'updated-secret-value' }
    });
    fireEvent.change(screen.getByLabelText('Description (Optional)'), {
      target: { value: 'Updated description' }
    });
    
    // Submit form
    fireEvent.click(screen.getByText('Update Secret'));
    
    await waitFor(() => {
      expect(mockProps.onUpdateSecret).toHaveBeenCalledWith('DATABASE_URL', {
        key: 'DATABASE_URL',
        value: 'updated-secret-value',
        description: 'Updated description'
      });
    });
  });

  it('should delete secret', async () => {
    render(<SecretsManager {...mockProps} />);
    
    // Click delete button for first secret
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(mockProps.onDeleteSecret).toHaveBeenCalledWith('DATABASE_URL');
    });
  });

  it('should copy secret key to clipboard', async () => {
    render(<SecretsManager {...mockProps} />);
    
    // Click copy button for first secret
    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    fireEvent.click(copyButtons[0]);
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('DATABASE_URL');
    });
  });

  it('should export secrets', async () => {
    render(<SecretsManager {...mockProps} />);
    
    // Mock URL.createObjectURL and related functions
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const mockRevokeObjectURL = vi.fn();
    const mockClick = vi.fn();
    const mockAppendChild = vi.fn();
    const mockRemoveChild = vi.fn();
    
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
    
    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick
    };
    
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
    
    // Click export button
    fireEvent.click(screen.getByText('Export'));
    
    await waitFor(() => {
      expect(mockProps.onExportSecrets).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  it('should open import dialog', async () => {
    render(<SecretsManager {...mockProps} />);
    
    fireEvent.click(screen.getByText('Import'));
    
    await waitFor(() => {
      expect(screen.getByText('Import Secrets')).toBeInTheDocument();
      expect(screen.getByText('Select File')).toBeInTheDocument();
    });
  });

  it('should parse JSON import file', async () => {
    render(<SecretsManager {...mockProps} />);
    
    // Open import dialog
    fireEvent.click(screen.getByText('Import'));
    
    await waitFor(() => {
      expect(screen.getByText('Import Secrets')).toBeInTheDocument();
    });
    
    // Mock file input
    const fileInput = screen.getByLabelText('Select File');
    const mockFile = new File([JSON.stringify({
      secrets: [
        { key: 'IMPORTED_SECRET_1', value: 'value1', description: 'Imported secret 1' },
        { key: 'IMPORTED_SECRET_2', value: 'value2', description: 'Imported secret 2' }
      ]
    })], 'secrets.json', { type: 'application/json' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(screen.getByText('Preview (2 secrets)')).toBeInTheDocument();
      expect(screen.getByText('IMPORTED_SECRET_1')).toBeInTheDocument();
      expect(screen.getByText('IMPORTED_SECRET_2')).toBeInTheDocument();
    });
  });

  it('should parse .env format import file', async () => {
    render(<SecretsManager {...mockProps} />);
    
    // Open import dialog
    fireEvent.click(screen.getByText('Import'));
    
    await waitFor(() => {
      expect(screen.getByText('Import Secrets')).toBeInTheDocument();
    });
    
    // Mock file input with .env format
    const fileInput = screen.getByLabelText('Select File');
    const envContent = `# Database configuration
DATABASE_URL=postgresql://localhost:5432/mydb
DATABASE_PASSWORD="secure-password"

# API configuration
API_KEY=abc123def456
API_SECRET='very-secret-key'`;
    
    const mockFile = new File([envContent], '.env', { type: 'text/plain' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(screen.getByText('Preview (4 secrets)')).toBeInTheDocument();
      expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
      expect(screen.getByText('DATABASE_PASSWORD')).toBeInTheDocument();
      expect(screen.getByText('API_KEY')).toBeInTheDocument();
      expect(screen.getByText('API_SECRET')).toBeInTheDocument();
    });
  });

  it('should import secrets with overwrite option', async () => {
    render(<SecretsManager {...mockProps} />);
    
    // Open import dialog
    fireEvent.click(screen.getByText('Import'));
    
    await waitFor(() => {
      expect(screen.getByText('Import Secrets')).toBeInTheDocument();
    });
    
    // Mock file input
    const fileInput = screen.getByLabelText('Select File');
    const mockFile = new File([JSON.stringify({
      secrets: [
        { key: 'NEW_SECRET', value: 'value1' }
      ]
    })], 'secrets.json', { type: 'application/json' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(screen.getByText('Preview (1 secrets)')).toBeInTheDocument();
    });
    
    // Toggle overwrite option
    const overwriteSwitch = screen.getByLabelText('Overwrite existing secrets');
    fireEvent.click(overwriteSwitch);
    
    // Import secrets
    fireEvent.click(screen.getByText('Import 1 Secrets'));
    
    await waitFor(() => {
      expect(mockProps.onImportSecrets).toHaveBeenCalledWith({
        secrets: [{ key: 'NEW_SECRET', value: 'value1' }],
        overwrite_existing: true
      });
    });
  });

  it('should disable export when no secrets exist', () => {
    render(<SecretsManager {...mockProps} secrets={[]} />);
    
    const exportButton = screen.getByText('Export');
    expect(exportButton).toBeDisabled();
  });

  it('should show loading state', () => {
    render(<SecretsManager {...mockProps} loading={true} />);
    
    const createButton = screen.getByText('Create Secret');
    expect(createButton).toBeDisabled();
  });
});