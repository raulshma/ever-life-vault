import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ClipNew from '../ClipNew';

// Mock the dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

vi.mock('@/lib/crypto', () => ({
  arrayBufferToBase64: vi.fn(() => 'mocked-salt'),
  generateSalt: vi.fn(() => ({ buffer: new ArrayBuffer(16) }))
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn()
  }
});

// Mock window.confirm
Object.assign(window, {
  confirm: vi.fn(() => true)
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('ClipNew', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with all fields', () => {
    renderWithRouter(<ClipNew />);
    
    expect(screen.getByText('New Clip')).toBeInTheDocument();
    expect(screen.getByLabelText(/ID/)).toBeInTheDocument();
    expect(screen.getByText(/Expires/)).toBeInTheDocument();
    expect(screen.getByText(/Password protect/)).toBeInTheDocument();
    expect(screen.getByText(/One-time view only/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Content/)).toBeInTheDocument();
  });

  it('shows one-time view info when enabled', () => {
    renderWithRouter(<ClipNew />);
    
    // Find all switches and click the one-time view one
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2); // Password protect and one-time view
    
    // Click the second switch (one-time view)
    fireEvent.click(switches[1]);
    
    expect(screen.getByText(/This clip will be automatically deleted after the first person views it/)).toBeInTheDocument();
  });

  it('shows warning when both password and one-time view are enabled', () => {
    renderWithRouter(<ClipNew />);
    
    // Find all switches
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
    
    // Enable password protection (first switch)
    fireEvent.click(switches[0]);
    
    // Enable one-time view (second switch)
    fireEvent.click(switches[1]);
    
    expect(screen.getByText(/One-time view \+ password protection means the clip will be deleted after the first successful password unlock/)).toBeInTheDocument();
  });

  it('shows one-time view indicator in URL preview', () => {
    renderWithRouter(<ClipNew />);
    
    // Find all switches and click the one-time view one
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
    
    // Click the second switch (one-time view)
    fireEvent.click(switches[1]);
    
    // Look for the specific indicator in the URL preview
    expect(screen.getByText(/• One-time view/)).toBeInTheDocument();
  });

  it('requires confirmation when creating one-time view clip', async () => {
    const mockConfirm = vi.fn(() => true);
    window.confirm = mockConfirm;
    
    renderWithRouter(<ClipNew />);
    
    // Enable one-time view
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
    
    // Click the second switch (one-time view)
    fireEvent.click(switches[1]);
    
    // Fill in required fields
    const contentField = screen.getByLabelText(/Content/);
    fireEvent.change(contentField, { target: { value: 'Test content' } });
    
    // Try to create
    const createButton = screen.getByText('Create');
    fireEvent.click(createButton);
    
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.stringContaining('Are you sure you want to create a one-time view clip?')
    );
  });

  it('prevents creation without confirmation for one-time view', async () => {
    const mockConfirm = vi.fn(() => false);
    window.confirm = mockConfirm;
    
    renderWithRouter(<ClipNew />);
    
    // Enable one-time view
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
    
    // Click the second switch (one-time view)
    fireEvent.click(switches[1]);
    
    // Fill in required fields
    const contentField = screen.getByLabelText(/Content/);
    fireEvent.change(contentField, { target: { value: 'Test content' } });
    
    // Try to create
    const createButton = screen.getByText('Create');
    fireEvent.click(createButton);
    
    expect(mockConfirm).toHaveBeenCalled();
    // Should not proceed with creation
    expect(screen.getByText('Create')).toBeInTheDocument();
  });
});
