import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ClipPage from '../ClipPage';

// Mock the dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

vi.mock('@/lib/crypto', () => ({
  arrayBufferToBase64: vi.fn(() => 'mocked-proof')
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'test-clip' })
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('ClipPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the clip page with title', () => {
    renderWithRouter(<ClipPage />);
    
    expect(screen.getByText('Clip: test-clip')).toBeInTheDocument();
  });

  it('shows one-time view warning when clip is one-time', async () => {
    const mockSupabase = vi.mocked(require('@/integrations/supabase/client').supabase);
    
    // Mock the meta call
    mockSupabase.rpc.mockImplementationOnce(() => ({
      data: [{
        has_password: false,
        expires_at: null,
        updated_at: new Date().toISOString(),
        password_salt: null
      }],
      error: null
    }));
    
    // Mock the get_clip_one_time call
    mockSupabase.rpc.mockImplementationOnce(() => ({
      data: [{
        content: 'Test content',
        has_password: false,
        expires_at: null,
        updated_at: new Date().toISOString(),
        one_time_view: true,
        view_count: 0
      }],
      error: null
    }));
    
    renderWithRouter(<ClipPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/This is a one-time view clip/)).toBeInTheDocument();
    });
  });

  it('shows view count for one-time clips', async () => {
    const mockSupabase = require('@/integrations/supabase/client').supabase;
    
    // Mock the meta call
    mockSupabase.rpc.mockImplementationOnce(() => ({
      data: [{
        has_password: false,
        expires_at: null,
        updated_at: new Date().toISOString(),
        password_salt: null
      }],
      error: null
    }));
    
    // Mock the get_clip_one_time call with view count > 0
    mockSupabase.rpc.mockImplementationOnce(() => ({
      data: [{
        content: 'Test content',
        has_password: false,
        expires_at: null,
        updated_at: new Date().toISOString(),
        one_time_view: true,
        view_count: 1
      }],
      error: null
    }));
    
    renderWithRouter(<ClipPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/This clip has been viewed 1 time\(s\) and will be deleted/)).toBeInTheDocument();
    });
  });

  it('disables editing for viewed one-time clips', async () => {
    const mockSupabase = require('@/integrations/supabase/client').supabase;
    
    // Mock the meta call
    mockSupabase.rpc.mockImplementationOnce(() => ({
      data: [{
        has_password: false,
        expires_at: null,
        updated_at: new Date().toISOString(),
        password_salt: null
      }],
      error: null
    }));
    
    // Mock the get_clip_one_time call with view count > 0
    mockSupabase.rpc.mockImplementationOnce(() => ({
      data: [{
        content: 'Test content',
        has_password: false,
        expires_at: null,
        updated_at: new Date().toISOString(),
        one_time_view: true,
        view_count: 1
      }],
      error: null
    }));
    
    renderWithRouter(<ClipPage />);
    
    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('readonly');
      
      const saveButton = screen.getByText('Save');
      expect(saveButton).toBeDisabled();
    });
  });

  it('allows editing for unviewed one-time clips', async () => {
    const mockSupabase = require('@/integrations/supabase/client').supabase;
    
    // Mock the meta call
    mockSupabase.rpc.mockImplementationOnce(() => ({
      data: [{
        has_password: false,
        expires_at: null,
        updated_at: new Date().toISOString(),
        password_salt: null
      }],
      error: null
    }));
    
    // Mock the get_clip_one_time call with view count = 0
    mockSupabase.rpc.mockImplementationOnce(() => ({
      data: [{
        content: 'Test content',
        has_password: false,
        expires_at: null,
        updated_at: new Date().toISOString(),
        one_time_view: true,
        view_count: 0
      }],
      error: null
    }));
    
    renderWithRouter(<ClipPage />);
    
    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toHaveAttribute('readonly');
      
      const saveButton = screen.getByText('Save');
      expect(saveButton).not.toBeDisabled();
      
      expect(screen.getByText(/You can still edit this one-time clip until it's viewed for the first time/)).toBeInTheDocument();
    });
  });

  it('shows one-time view status in description', async () => {
    const mockSupabase = require('@/integrations/supabase/client').supabase;
    
    // Mock the meta call
    mockSupabase.rpc.mockImplementationOnce(() => ({
      data: [{
        has_password: false,
        expires_at: null,
        updated_at: new Date().toISOString(),
        password_salt: null
      }],
      error: null
    }));
    
    // Mock the get_clip_one_time call
    mockSupabase.rpc.mockImplementationOnce(() => ({
      data: [{
        content: 'Test content',
        has_password: false,
        expires_at: null,
        updated_at: new Date().toISOString(),
        one_time_view: true,
        view_count: 0
      }],
      error: null
    }));
    
    renderWithRouter(<ClipPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/One-time view only/)).toBeInTheDocument();
    });
  });
});
