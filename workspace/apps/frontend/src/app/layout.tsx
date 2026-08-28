import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "../components/common/app-shell";
import { ErrorBoundary } from "../components/common/error-boundary";
import { InfrastructureProvider } from "../components/common/infrastructure-provider";
import { AuthProvider } from "../contexts/auth-context";
import { LeaderboardLiveProvider } from "../contexts/leaderboard-live-context";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crypto Strategy Lab",
  description:
    "Platform for analyzing, combining & evaluating crypto trading strategies",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-canvas-dark text-body font-sans">
        <ErrorBoundary>
          <AuthProvider>
            <InfrastructureProvider>
              <LeaderboardLiveProvider>
                <AppShell>{children}</AppShell>
              </LeaderboardLiveProvider>
            </InfrastructureProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
