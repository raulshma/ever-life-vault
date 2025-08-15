import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BackupExport } from '../BackupExport'
import type { DockerComposeConfig } from '../../types'

// Mock fetch
global.fetch = vi.fn()

const mockConfigurations: DockerComposeConfig[] = [
  {
    id: 'config-1',
    user_id: 'user-1',
    name: 'Test Config 1',
    description: 'First test configuration',
    compose_content: 'version: "3.8"\nservices:\n  app:\n    image: nginx',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    metadata: {
      services: [{ name: 'app', image: 'nginx', ports: [], environment: [], volumes: [] }],
      volumes: [],
      networks: []
    }
  },
  {
    id: 'config-2',
    user_id: 'user-1',
    name: 'Test Config 2',
    description: 'Second test configuration',
    compose_content: 'version: "3.8"\nservices:\n  db:\n    image: postgres',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    metadata: {
      services: [{ name: 'db', image: 'postgres', ports: [], environment: [], volumes: [] }],
      volumes: [],
      networks: []
    }
  }
]

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('BackupExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful configurations fetch
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/infrastructure/configs') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ configurations: mockConfigurations })
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })
  })

  it('should render configuration selection', async () => {
    render(<BackupExport />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Select Configurations')).toBeInTheDocument()
      expect(screen.getByText('Test Config 1')).toBeInTheDocument()
      expect(screen.getByText('Test Config 2')).toBeInTheDocument()
    })
  })

  it('should show loading state while fetching configurations', () => {
    render(<BackupExport />, { wrapper: createWrapper() })

    expect(screen.getByText('Loading configurations...')).toBeInTheDocument()
  })

  it('should allow selecting individual configurations', async () => {
    const user = userEvent.setup()
    render(<BackupExport />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Test Config 1')).toBeInTheDocument()
    })

    const checkbox1 = screen.getByLabelText('Test Config 1')
    await user.click(checkbox1)

    expect(checkbox1).toBeChecked()
  })

  it('should allow selecting all configurations', async () => {
    const user = userEvent.setup()
    render(<BackupExport />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Select All (2)')).toBeInTheDocument()
    })

    const selectAllCheckbox = screen.getByLabelText('Select All (2)')
    await user.click(selectAllCheckbox)

    expect(selectAllCheckbox).toBeChecked()
    expect(screen.getByLabelText('Test Config 1')).toBeChecked()
    expect(screen.getByLabelText('Test Config 2')).toBeChecked()
  })

  it('should show export options', async () => {
    render(<BackupExport />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Export Options')).toBeInTheDocument()
    })

    expect(screen.getByLabelText(/Include secret keys/)).toBeInTheDocument()
    expect(screen.getByLabelText('JSON (.json)')).toBeInTheDocument()
    expect(screen.getByLabelText('YAML (.yaml)')).toBeInTheDocument()
  })

  it('should allow changing export format', async () => {
    const user = userEvent.setup()
    render(<BackupExport />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText('YAML (.yaml)')).toBeInTheDocument()
    })

    const yamlRadio = screen.getByLabelText('YAML (.yaml)')
    await user.click(yamlRadio)

    expect(yamlRadio).toBeChecked()
  })

  it('should show export summary', async () => {
    const user = userEvent.setup()
    render(<BackupExport />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Export Summary')).toBeInTheDocument()
    })

    // Initially no configurations selected
    expect(screen.getByText('0 selected')).toBeInTheDocument()

    // Select all configurations
    const selectAllCheckbox = screen.getByLabelText('Select All (2)')
    await user.click(selectAllCheckbox)

    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it('should disable export button when no configurations selected', async () => {
    render(<BackupExport />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export Backup/ })).toBeDisabled()
    })
  })

  it('should enable export button when configurations selected', async () => {
    const user = userEvent.setup()
    render(<BackupExport />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Test Config 1')).toBeInTheDocument()
    })

    const checkbox1 = screen.getByLabelText('Test Config 1')
    await user.click(checkbox1)

    expect(screen.getByRole('button', { name: /Export Backup/ })).toBeEnabled()
  })

  it('should handle export request', async () => {
    const user = userEvent.setup()
    
    // Mock successful export
    const mockBlob = new Blob(['{"test": "data"}'], { type: 'application/json' })
    ;(global.fetch as any).mockImplementation((url: string, options: any) => {
      if (url === '/api/infrastructure/configs') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ configurations: mockConfigurations })
        })
      }
      if (url === '/api/infrastructure/backup/export') {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(mockBlob),
          headers: {
            get: (name: string) => {
              if (name === 'Content-Disposition') {
                return 'attachment; filename="test-backup.json"'
              }
              return null
            }
          }
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    // Mock URL.createObjectURL and related methods
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url')
    global.URL.revokeObjectURL = vi.fn()

    render(<BackupExport />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Test Config 1')).toBeInTheDocument()
    })

    // Select a configuration
    const checkbox1 = screen.getByLabelText('Test Config 1')
    await user.click(checkbox1)

    // Click export button
    const exportButton = screen.getByRole('button', { name: /Export Backup/ })
    await user.click(exportButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/infrastructure/backup/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          config_ids: ['config-1'],
          include_secrets: false,
          format: 'json'
        })
      })
    })
  })

  it('should handle export error', async () => {
    const user = userEvent.setup()
    
    // Mock failed export
    ;(global.fetch as any).mockImplementation((url: string, options: any) => {
      if (url === '/api/infrastructure/configs') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ configurations: mockConfigurations })
        })
      }
      if (url === '/api/infrastructure/backup/export') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Export failed' })
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    render(<BackupExport />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Test Config 1')).toBeInTheDocument()
    })

    // Select a configuration
    const checkbox1 = screen.getByLabelText('Test Config 1')
    await user.click(checkbox1)

    // Click export button
    const exportButton = screen.getByRole('button', { name: /Export Backup/ })
    await user.click(exportButton)

    // Should show error state (button should be enabled again after error)
    await waitFor(() => {
      expect(exportButton).toBeEnabled()
    })
  })

  it('should show empty state when no configurations exist', async () => {
    // Mock empty configurations response
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/infrastructure/configs') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ configurations: [] })
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    render(<BackupExport />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('No configurations found. Create some configurations first.')).toBeInTheDocument()
    })
  })
})