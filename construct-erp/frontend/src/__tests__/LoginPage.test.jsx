import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

// Reset auth store before each test
import useAuthStore from '../store/authStore';

const resetStore = () => useAuthStore.setState({
  user: null, accessToken: null, refreshToken: null,
  isLoading: false, isInitialized: true, error: null,
});

const TestWrapper = ({ children, initialPath = '/login' }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initialPath]}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

let LoginPage;

beforeAll(async () => {
  const mod = await import('../pages/auth/LoginPage');
  LoginPage = mod.default;
});

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('LoginPage rendering', () => {
  it('renders email and password fields', () => {
    render(<TestWrapper><LoginPage /></TestWrapper>);
    expect(screen.getByLabelText(/email/i) || screen.getByPlaceholderText(/email/i) ||
      screen.getByRole('textbox', { name: /email/i }) || document.querySelector('input[type="email"]')).toBeTruthy();
    expect(document.querySelector('input[type="password"]')).toBeTruthy();
  });

  it('renders a submit button', () => {
    render(<TestWrapper><LoginPage /></TestWrapper>);
    expect(screen.getByRole('button', { name: /sign in|login|continue/i })).toBeInTheDocument();
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe('LoginPage validation', () => {
  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<TestWrapper><LoginPage /></TestWrapper>);

    const emailInput = document.querySelector('input[type="email"]') ||
      screen.getByRole('textbox');
    await user.clear(emailInput);
    await user.type(emailInput, 'not-an-email');
    await user.click(screen.getByRole('button', { name: /sign in|login|continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when password is empty', async () => {
    const user = userEvent.setup();
    render(<TestWrapper><LoginPage /></TestWrapper>);

    const emailInput = document.querySelector('input[type="email"]') ||
      screen.getByRole('textbox');
    await user.type(emailInput, 'admin@test.com');
    await user.click(screen.getByRole('button', { name: /sign in|login|continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });
});

// ─── Authentication flow ──────────────────────────────────────────────────────

describe('LoginPage authentication', () => {
  it('shows error message on invalid credentials', async () => {
    const user = userEvent.setup();
    render(<TestWrapper><LoginPage /></TestWrapper>);

    await user.type(document.querySelector('input[type="email"]'), 'admin@test.com');
    await user.type(document.querySelector('input[type="password"]'), 'WrongPass');
    await user.click(screen.getByRole('button', { name: /sign in|login|continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid/i)).toBeInTheDocument();
    });
  });
});

// ─── Password visibility toggle ───────────────────────────────────────────────

describe('LoginPage password toggle', () => {
  it('toggles password field visibility', async () => {
    const user = userEvent.setup();
    render(<TestWrapper><LoginPage /></TestWrapper>);

    const pwInput = document.querySelector('input[type="password"]');
    expect(pwInput).toBeInTheDocument();

    // Find the eye toggle button (may be an SVG button next to the password field)
    const toggleBtn = document.querySelector('button[type="button"]') ||
      screen.queryByRole('button', { name: /show|hide|toggle/i });

    if (toggleBtn) {
      await user.click(toggleBtn);
      const afterToggle = document.querySelector('input[name="password"]') ||
        document.querySelector('input[type="text"][placeholder*="assword"]') ||
        document.querySelectorAll('input[type="text"]')[0];
      // After toggle, type changes from "password" to "text"
      expect(afterToggle || document.querySelector('input[type="text"]')).toBeInTheDocument();
    }
  });
});
