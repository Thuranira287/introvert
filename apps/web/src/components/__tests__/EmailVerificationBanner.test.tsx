import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EmailVerificationBanner } from '../EmailVerificationBanner';
import api from '@/lib/api';

jest.mock('@/lib/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
const mockedPost = api.post as jest.Mock;

describe('EmailVerificationBanner', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks the user to verify and offers to resend', () => {
    render(<EmailVerificationBanner />);

    expect(screen.getByText('Please verify your email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeInTheDocument();
  });

  it('requests a new link and confirms once it is sent', async () => {
    mockedPost.mockResolvedValue({});
    render(<EmailVerificationBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'Resend email' }));

    await waitFor(() => expect(screen.getByText(/new verification link is on its way/i)).toBeInTheDocument());
    expect(mockedPost).toHaveBeenCalledWith('/auth/resend-verification');
    expect(screen.queryByRole('button', { name: 'Resend email' })).not.toBeInTheDocument();
  });

  it('shows the server message when resending fails and keeps the button available', async () => {
    mockedPost.mockRejectedValue({ response: { data: { message: 'Too many requests' } } });
    render(<EmailVerificationBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'Resend email' }));

    await waitFor(() => expect(screen.getByText('Too many requests')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeInTheDocument();
  });
});
