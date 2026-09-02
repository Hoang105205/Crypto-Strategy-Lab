import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserNavSection } from './user-nav-section';

const routerReplaceMock = vi.hoisted(() => vi.fn());
const logoutMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());

interface FakeUser {
  email?: string;
  user_metadata?: Record<string, unknown>;
}

const authState = vi.hoisted(() => ({
  current: { user: null as FakeUser | null, loading: false },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplaceMock, push: vi.fn() }),
}));

// Mocking these two modules keeps the real supabase-client (which needs env vars)
// out of the test module graph entirely.
vi.mock('../../services/api-client', () => ({
  apiClient: { logout: logoutMock },
}));

vi.mock('../../contexts/auth-context', () => ({
  useAuth: () => ({
    user: authState.current.user,
    session: null,
    loading: authState.current.loading,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: signOutMock,
  }),
}));

function setAuthed(user?: FakeUser) {
  authState.current = {
    loading: false,
    user: user ?? { email: 'trader@example.com', user_metadata: {} },
  };
}

function openMenu() {
  fireEvent.click(screen.getByTestId('user-nav-toggle'));
}

beforeEach(() => {
  routerReplaceMock.mockReset();
  logoutMock.mockReset();
  signOutMock.mockReset();
  logoutMock.mockResolvedValue({ message: 'Logged out successfully' });
  signOutMock.mockResolvedValue(undefined);
  authState.current = { user: null, loading: false };
});

describe('UserNavSection — identity display (US1)', () => {
  it('shows the display name as primary label and email as secondary', () => {
    setAuthed({
      email: 'ada@example.com',
      user_metadata: { display_name: 'Ada Lovelace' },
    });
    render(<UserNavSection />);

    expect(screen.getByTestId('user-nav-toggle')).toHaveAccessibleName(
      'Account menu for ada@example.com',
    );
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('falls back to the email when no display name exists', () => {
    setAuthed();
    render(<UserNavSection />);

    expect(screen.getByTestId('user-nav-toggle')).toHaveTextContent(
      'trader@example.com',
    );
  });

  it('renders nothing for an anonymous session', () => {
    authState.current = { user: null, loading: false };
    const { container } = render(<UserNavSection />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('user-nav-toggle')).not.toBeInTheDocument();
  });

  it('renders a placeholder with no identifying text while the session resolves', () => {
    authState.current = { user: null, loading: true };
    render(<UserNavSection />);

    expect(screen.getByTestId('user-nav-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('user-nav-toggle')).not.toBeInTheDocument();
  });

  it('truncates a long email label instead of overflowing', () => {
    setAuthed({
      email: 'a.very.long.trader.email.address@example.com',
      user_metadata: {},
    });
    render(<UserNavSection />);

    const label = screen.getByText(
      'a.very.long.trader.email.address@example.com',
    );
    expect(label.className).toMatch(/truncate/);
  });
});

describe('UserNavSection — logout (US2)', () => {
  it('calls the backend, signs out, and redirects to /login in that order', async () => {
    setAuthed();
    render(<UserNavSection />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /log out/i }));

    await waitFor(() =>
      expect(routerReplaceMock).toHaveBeenCalledWith('/login'),
    );
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(logoutMock.mock.invocationCallOrder[0]).toBeLessThan(
      signOutMock.mock.invocationCallOrder[0],
    );
    expect(signOutMock.mock.invocationCallOrder[0]).toBeLessThan(
      routerReplaceMock.mock.invocationCallOrder[0],
    );
  });

  it('still signs out and redirects when the backend logout fails (FR-009)', async () => {
    setAuthed();
    logoutMock.mockRejectedValue(new Error('network down'));
    render(<UserNavSection />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /log out/i }));

    await waitFor(() =>
      expect(routerReplaceMock).toHaveBeenCalledWith('/login'),
    );
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('disables the Log Out control and shows a pending label while in flight', async () => {
    setAuthed();
    signOutMock.mockReturnValue(new Promise<void>(() => {}));
    render(<UserNavSection />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /log out/i }));

    await waitFor(() =>
      expect(screen.getByTestId('user-nav-logout')).toBeDisabled(),
    );
    expect(screen.getByTestId('user-nav-logout')).toHaveTextContent(
      'Logging out...',
    );
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });
});

describe('UserNavSection — accessibility (US3)', () => {
  it('toggles aria-expanded and closes the menu on Escape', () => {
    setAuthed();
    render(<UserNavSection />);
    const toggle = screen.getByTestId('user-nav-toggle');

    expect(toggle).toHaveAttribute('aria-haspopup', 'menu');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('user-nav-menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('user-nav-menu')).not.toBeInTheDocument();
  });

  it('closes the menu on an outside click', () => {
    setAuthed();
    render(<UserNavSection />);
    openMenu();
    expect(screen.getByTestId('user-nav-menu')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('user-nav-menu')).not.toBeInTheDocument();
  });

  it('exposes an accessible Log Out menu item', () => {
    setAuthed();
    render(<UserNavSection />);
    openMenu();

    expect(
      screen.getByRole('menuitem', { name: /log out/i }),
    ).toBeInTheDocument();
  });
});
