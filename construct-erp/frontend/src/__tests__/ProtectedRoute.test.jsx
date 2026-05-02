import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import useAuthStore from '../store/authStore';

// Inline the component definitions (same as App.js) for isolated testing
import LoadingScreen from '../components/common/LoadingScreen';

const ProtectedRoute = ({ children }) => {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const Wrapper = ({ initialPath = '/', children }) => (
  <QueryClientProvider client={qc}>
    <MemoryRouter initialEntries={[initialPath]}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => {
  useAuthStore.setState({
    user: null, accessToken: null, isInitialized: true,
  });
});

// ─── ProtectedRoute ───────────────────────────────────────────────────────────

describe('ProtectedRoute', () => {
  it('redirects to /login when user is not authenticated', () => {
    render(
      <Wrapper initialPath="/dashboard">
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/dashboard" element={<ProtectedRoute><div>Dashboard</div></ProtectedRoute>} />
        </Routes>
      </Wrapper>
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    useAuthStore.setState({
      user: { id: '1', role: 'admin', name: 'Admin' },
      isInitialized: true,
    });

    render(
      <Wrapper initialPath="/dashboard">
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute><div>Dashboard Content</div></ProtectedRoute>} />
        </Routes>
      </Wrapper>
    );
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('shows loading screen while isInitialized is false', () => {
    useAuthStore.setState({ user: null, isInitialized: false });

    render(
      <Wrapper initialPath="/dashboard">
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute><div>Dashboard</div></ProtectedRoute>} />
        </Routes>
      </Wrapper>
    );

    // Should render loading screen, not dashboard or login
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});

// ─── PublicRoute ──────────────────────────────────────────────────────────────

describe('PublicRoute', () => {
  it('renders children when user is not authenticated', () => {
    render(
      <Wrapper initialPath="/login">
        <Routes>
          <Route path="/login" element={<PublicRoute><div>Login Form</div></PublicRoute>} />
        </Routes>
      </Wrapper>
    );
    expect(screen.getByText('Login Form')).toBeInTheDocument();
  });

  it('redirects authenticated users to /dashboard', () => {
    useAuthStore.setState({
      user: { id: '1', role: 'admin', name: 'Admin' },
      isInitialized: true,
    });

    render(
      <Wrapper initialPath="/login">
        <Routes>
          <Route path="/login" element={<PublicRoute><div>Login Form</div></PublicRoute>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </Wrapper>
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Login Form')).not.toBeInTheDocument();
  });
});
