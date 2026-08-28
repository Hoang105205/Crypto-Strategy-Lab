import { beforeEach, describe, expect, it, vi } from 'vitest';

const createServerClientMock = vi.hoisted(() => vi.fn());
const nextMock = vi.hoisted(() => vi.fn(() => ({ kind: 'next' })));
const redirectMock = vi.hoisted(() => vi.fn((url: URL) => ({ kind: 'redirect', url })));

vi.mock('@supabase/ssr', () => ({ createServerClient: createServerClientMock }));
vi.mock('next/server', () => ({
  NextResponse: { next: nextMock, redirect: redirectMock },
}));

function request(pathname: string) {
  return {
    url: `http://localhost:3000${pathname}`,
    nextUrl: { pathname },
    cookies: { getAll: vi.fn(() => []) },
  };
}

function session(value: object | null) {
  createServerClientMock.mockReturnValue({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: value } }) },
  });
}

describe('middleware route policy', () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
    nextMock.mockClear();
    redirectMock.mockClear();
    session(null);
  });

  it('allows anonymous /leaderboard without requiring a Supabase session read', async () => {
    const { middleware } = await import('./middleware');
    await middleware(request('/leaderboard') as never);
    expect(nextMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('retains anonymous login/register access and authenticated login redirect', async () => {
    const { middleware } = await import('./middleware');
    await middleware(request('/register') as never);
    expect(nextMock).toHaveBeenCalledTimes(1);

    session({ user: { id: 'user-a' } });
    await middleware(request('/login') as never);
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect((redirectMock.mock.calls[0]?.[0] as URL).pathname).toBe('/');
  });

  it('keeps unrelated routes protected and preserves their original redirect destination', async () => {
    const { middleware } = await import('./middleware');
    await middleware(request('/strategy') as never);
    expect(redirectMock).toHaveBeenCalledTimes(1);
    const destination = redirectMock.mock.calls[0]?.[0] as URL;
    expect(destination.pathname).toBe('/login');
    expect(destination.searchParams.get('redirect')).toBe('/strategy');
  });
});
