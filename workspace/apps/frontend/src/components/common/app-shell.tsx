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
    <div className="min-h-screen bg-canvas-dark text-body">
      <header className="relative h-16 border-b border-hairline-dark bg-canvas-dark">
        <div className="flex h-full w-full items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            className="rounded-sm text-base font-semibold text-body focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-info"
          >
            Crypto Strategy Lab
          </Link>

          <button
            type="button"
            aria-controls="primary-navigation"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="rounded-md border border-hairline-dark px-3 py-2 text-sm text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info md:hidden"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            Menu
          </button>

          <nav
            id="primary-navigation"
            aria-label="Primary navigation"
            className={`${
              isMenuOpen ? 'flex' : 'hidden'
            } absolute left-0 right-0 top-full z-50 flex-col border-b border-hairline-dark bg-canvas-dark px-4 py-3 md:static md:flex md:flex-row md:items-stretch md:border-0 md:p-0`}
          >
            {NAVIGATION_ITEMS.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center rounded-sm border-b-2 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-info ${
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-body hover:text-primary'
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
        className="w-full px-4 py-6 md:px-6"
      >
        {children}
      </div>
    </div>
  );
}
