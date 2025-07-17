import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../client/src/contexts/AuthContext';
import AdminGoalValidation from '../../client/src/components/league/AdminGoalValidation';

vi.mock('../../client/src/lib/queryClient', () => ({ apiRequest: vi.fn() }));
vi.mock('../../client/src/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const createTestWrapper = (user = { id: 1 }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

describe('AdminGoalValidation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders input, button, and reported goals', () => {
    const TestWrapper = createTestWrapper();
    const match = { id: 1, status: 'completed' };
    const statReports = [ { userId: 1, goals: 2 }, { userId: 2, goals: 1 } ];
    const league = { createdBy: 1 };
    const user = { id: 1 };

    render(
      <TestWrapper>
        <AdminGoalValidation match={match} statReports={statReports} user={user} league={league} />
      </TestWrapper>
    );

    expect(screen.getByRole('spinbutton')).toBeTruthy();
    expect(screen.getByRole('button', { name: /validate/i })).toBeTruthy();
    expect(screen.getByText('Reported Goals')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy(); // 2+1
    // Quick stats badges
    expect(screen.getAllByText(/g/).length).toBe(statReports.length);
  });

  it('shows mismatch warning when final score does not match sum of goals', async () => {
    const TestWrapper = createTestWrapper();
    const match = { id: 1, status: 'completed' };
    const statReports = [ { userId: 1, goals: 2 }, { userId: 2, goals: 1 } ];
    const league = { createdBy: 1 };
    const user = { id: 1 };

    render(
      <TestWrapper>
        <AdminGoalValidation match={match} statReports={statReports} user={user} league={league} />
      </TestWrapper>
    );

    // Enter a mismatched final score
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10' } });
    const validateButton = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText(/mismatch|goal mismatch|difference/i)).toBeTruthy();
    });
  });

  it('shows success alert when final score matches reported goals', async () => {
    const TestWrapper = createTestWrapper();
    const match = { id: 1, status: 'completed' };
    const statReports = [ { userId: 1, goals: 2 }, { userId: 2, goals: 1 } ];
    const league = { createdBy: 1 };
    const user = { id: 1 };

    render(
      <TestWrapper>
        <AdminGoalValidation match={match} statReports={statReports} user={user} league={league} />
      </TestWrapper>
    );

    // Enter a matching final score
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '3' } });
    const validateButton = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText(/validated successfully|reported total matches final score/i)).toBeTruthy();
    });
  });
}); 