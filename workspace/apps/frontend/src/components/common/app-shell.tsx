'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

const NAVIGATION_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/strategy', label: 'Strategy Builder' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/news', label: 'News Feed' },
] as const;

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas-dark text-body font-sans antialiased">
      <header className="sticky top-0 z-40 h-16 border-b border-hairline-dark/80 bg-canvas-dark backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[80%] items-center justify-between px-6 md:px-8">
          <Link
            href="/"
            className="rounded-lg text-lg font-bold tracking-tight text-body transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
          >
            Crypto Strategy Lab
          </Link>

          <button
            type="button"
            aria-controls="primary-navigation"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="rounded-lg border border-hairline-dark/80 bg-surface-card px-3.5 py-2 text-sm font-medium text-body transition-all hover:bg-surface-elevated active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark md:hidden"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            Menu
          </button>

          <nav
            id="primary-navigation"
            aria-label="Primary navigation"
            className={`${
              isMenuOpen ? 'flex' : 'hidden'
            } absolute left-0 right-0 top-full z-50 flex-col gap-2 border-b border-hairline-dark bg-canvas-dark p-4 shadow-xl md:static md:flex md:flex-row md:items-center md:gap-4 lg:gap-6 md:border-0 md:p-0 md:shadow-none`}
          >
            {NAVIGATION_ITEMS.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-10 items-center px-3.5 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active
                      ? 'text-primary border-b-2 border-primary font-bold'
                      : 'text-muted-strong hover:text-body border-b-2 border-transparent hover:border-hairline-dark'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div
        data-testid="app-shell-container"
        className="mx-auto max-w-[90%] w-full px-6 py-8 md:px-8"
      >
        {children}
      </div>
    </div>
  );
}
