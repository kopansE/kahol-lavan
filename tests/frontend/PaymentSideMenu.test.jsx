import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PaymentSideMenu from '../../frontend/src/components/PaymentSideMenu';
import { supabase } from '../../frontend/src/supabaseClient';

// Mock the supabase client
vi.mock('../../frontend/src/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn()
    }
  }
}));

describe('PaymentSideMenu Component', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: {
      avatar_url: null,
      full_name: 'Test User'
    }
  };

  const mockOnClose = vi.fn();
  const mockOnSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = '';
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <PaymentSideMenu 
        isOpen={false} 
        onClose={mockOnClose} 
        user={mockUser} 
        onSignOut={mockOnSignOut} 
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders menu when isOpen is true', () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { rapyd_customer_id: null, rapyd_wallet_id: null },
            error: null
          })
        })
      })
    });

    render(
      <PaymentSideMenu 
        isOpen={true} 
        onClose={mockOnClose} 
        user={mockUser} 
        onSignOut={mockOnSignOut} 
      />
    );

    expect(screen.getByText('Payment Settings')).toBeInTheDocument();
    expect(screen.getByText('Update Payment Details')).toBeInTheDocument();
  });

  it('displays user email', () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { rapyd_customer_id: null, rapyd_wallet_id: null },
            error: null
          })
        })
      })
    });

    render(
      <PaymentSideMenu 
        isOpen={true} 
        onClose={mockOnClose} 
        user={mockUser} 
        onSignOut={mockOnSignOut} 
      />
    );

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('shows wallet balance section when payment setup is completed', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { 
              rapyd_customer_id: 'cus_123', 
              rapyd_wallet_id: 'ewallet_123' 
            },
            error: null
          })
        })
      })
    });

    render(
      <PaymentSideMenu 
        isOpen={true} 
        onClose={mockOnClose} 
        user={mockUser} 
        onSignOut={mockOnSignOut} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Wallet Balance')).toBeInTheDocument();
      expect(screen.getByText('Withdraw to Bank Account')).toBeInTheDocument();
    });
  });

  it('shows setup message when payment is not completed', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { rapyd_customer_id: null, rapyd_wallet_id: null },
            error: null
          })
        })
      })
    });

    render(
      <PaymentSideMenu 
        isOpen={true} 
        onClose={mockOnClose} 
        user={mockUser} 
        onSignOut={mockOnSignOut} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Complete payment setup/)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { rapyd_customer_id: null, rapyd_wallet_id: null },
            error: null
          })
        })
      })
    });

    render(
      <PaymentSideMenu 
        isOpen={true} 
        onClose={mockOnClose} 
        user={mockUser} 
        onSignOut={mockOnSignOut} 
      />
    );

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onSignOut when sign out button is clicked', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { rapyd_customer_id: null, rapyd_wallet_id: null },
            error: null
          })
        })
      })
    });

    render(
      <PaymentSideMenu 
        isOpen={true} 
        onClose={mockOnClose} 
        user={mockUser} 
        onSignOut={mockOnSignOut} 
      />
    );

    const signOutButton = screen.getByText('Sign Out');
    fireEvent.click(signOutButton);
    expect(mockOnSignOut).toHaveBeenCalled();
  });

  it('handles update payment details button click', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { rapyd_customer_id: null, rapyd_wallet_id: null },
            error: null
          })
        })
      })
    });

    render(
      <PaymentSideMenu 
        isOpen={true} 
        onClose={mockOnClose} 
        user={mockUser} 
        onSignOut={mockOnSignOut} 
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const updateButton = screen.getByText('Update Payment Details');
    expect(updateButton).toBeInTheDocument();
  });
});

