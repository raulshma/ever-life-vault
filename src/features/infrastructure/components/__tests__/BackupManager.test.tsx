import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BackupManager } from '../BackupManager'

// Mock the child components
vi.mock('../BackupExport', () => ({
  BackupExport: () => <div data-testid="backup-export">Backup Export Component</div>
}))

vi.mock('../BackupImport', () => ({
  BackupImport: () => <div data-testid="backup-import">Backup Import Component</div>
}))

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

describe('BackupManager', () => {
  it('should render backup manager with tabs', () => {
    render(<BackupManager />, { wrapper: createWrapper() })

    expect(screen.getByText('Backup & Restore')).toBeInTheDocument()
    expect(screen.getByText(/Export and import your infrastructure configurations/)).toBeInTheDocument()
    
    // Check tabs
    expect(screen.getByRole('tab', { name: /Export Backup/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Import Backup/ })).toBeInTheDocument()
  })

  it('should show security warning about secrets', () => {
    render(<BackupManager />, { wrapper: createWrapper() })

    expect(screen.getByText(/For security reasons, secret values are not included in backups/)).toBeInTheDocument()
  })

  it('should show export tab by default', () => {
    render(<BackupManager />, { wrapper: createWrapper() })

    expect(screen.getByTestId('backup-export')).toBeInTheDocument()
    expect(screen.queryByTestId('backup-import')).not.toBeInTheDocument()
  })

  it('should show import tab when clicked', async () => {
    const user = userEvent.setup()
    render(<BackupManager />, { wrapper: createWrapper() })

    await user.click(screen.getByRole('tab', { name: /Import Backup/ }))

    expect(screen.getByTestId('backup-import')).toBeInTheDocument()
    expect(screen.queryByTestId('backup-export')).not.toBeInTheDocument()
  })

  it('should have proper card structure', () => {
    render(<BackupManager />, { wrapper: createWrapper() })

    expect(screen.getByText('Export Configuration Backup')).toBeInTheDocument()
    expect(screen.getByText(/Create a backup of your Docker Compose configurations/)).toBeInTheDocument()
  })
})