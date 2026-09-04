import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";
import { readFileSync } from "node:fs";

let currentPathname = "/";

const getInfrastructureSocketMock = vi.hoisted(() => vi.fn());
const disconnectInfrastructureSocketMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../services/infrastructure-socket", () => ({
  getInfrastructureSocket: getInfrastructureSocketMock,
  disconnectInfrastructureSocket: disconnectInfrastructureSocketMock,
}));

// AppShell renders <UserNavSection /> in the header; stub it so the shell contract
// stays testable without an AuthProvider/Supabase env. It has its own spec.
vi.mock("../auth/user-nav-section", () => ({
  UserNavSection: () => null,
}));

type Handler = (...args: unknown[]) => void;

class FakeEmitter {
  private readonly handlers = new Map<string, Set<Handler>>();
  readonly on = vi.fn((event: string, handler: Handler) => {
    const listeners = this.handlers.get(event) ?? new Set<Handler>();
    listeners.add(handler);
    this.handlers.set(event, listeners);
    return this;
  });
  readonly off = vi.fn((event: string, handler: Handler) => {
    this.handlers.get(event)?.delete(handler);
    return this;
  });
}

class FakeSocket extends FakeEmitter {
  readonly io = new FakeEmitter();
  readonly connected = false;
}

async function loadAppShell() {
  const modulePath = "./app-shell";
  return import(/* @vite-ignore */ modulePath);
}

async function loadInfrastructureProvider() {
  const modulePath = "./infrastructure-provider";
  return import(/* @vite-ignore */ modulePath);
}

async function loadLoadingState() {
  const modulePath = "./loading-state";
  return import(/* @vite-ignore */ modulePath);
}

async function loadErrorBoundary() {
  const modulePath = "./error-boundary";
  return import(/* @vite-ignore */ modulePath);
}

describe("AppShell contract", () => {
  beforeEach(() => {
    currentPathname = "/";
  });

  it("renders canonical navigation in order with one semantic active route", async () => {
    const { AppShell } = await loadAppShell();
    currentPathname = "/leaderboard";
    render(<AppShell>Page content</AppShell>);

    const navigation = screen.getByRole("navigation", { name: /primary/i });
    const links = within(navigation).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Strategy Builder",
      "Leaderboard",
      "News Feed",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/strategy",
      "/leaderboard",
      "/news",
    ]);
    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Strategy Builder" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("provides a usable mobile menu, visible focus styles, and preserves page-owned state", async () => {
    const { AppShell } = await loadAppShell();

    function StatefulPage() {
      const [count, setCount] = useState(0);
      return (
        <button onClick={() => setCount((value) => value + 1)}>
          Count {count}
        </button>
      );
    }

    const { rerender } = render(
      <AppShell>
        <StatefulPage />
      </AppShell>,
    );
    const menuButton = screen.getByRole("button", { name: /open navigation/i });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: /primary/i })).toHaveClass(
      "flex",
    );
    expect(screen.getByRole("link", { name: "Dashboard" }).className).toMatch(
      /focus-visible:/,
    );

    fireEvent.click(screen.getByRole("button", { name: "Count 0" }));
    currentPathname = "/news";
    rerender(
      <AppShell>
        <StatefulPage />
      </AppShell>,
    );
    expect(screen.getByRole("button", { name: "Count 1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "News Feed" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("uses a dark 64px shell and a full-width content container", async () => {
    const { AppShell } = await loadAppShell();
    render(<AppShell>Page content</AppShell>);

    expect(screen.getByRole("banner")).toHaveClass("h-16", "bg-canvas-dark");
    expect(screen.getByTestId("app-shell-container")).toHaveClass("w-full");
    expect(screen.getByTestId("app-shell-container")).not.toHaveClass(
      "max-w-[1440px]",
    );
  });

  it("keeps canonical Auth -> Infrastructure -> LeaderboardLive -> AppShell root ownership", () => {
    const layoutSource = readFileSync("src/app/layout.tsx", "utf8");
    const auth = layoutSource.indexOf("<AuthProvider>");
    const infrastructure = layoutSource.indexOf("<InfrastructureProvider>");
    const leaderboardLive = layoutSource.indexOf("<LeaderboardLiveProvider>");
    const appShell = layoutSource.indexOf("<AppShell>");

    expect(auth).toBeGreaterThan(-1);
    expect(infrastructure).toBeGreaterThan(auth);
    expect(leaderboardLive).toBeGreaterThan(infrastructure);
    expect(appShell).toBeGreaterThan(leaderboardLive);
  });
});

describe("InfrastructureProvider ownership", () => {
  beforeEach(() => {
    getInfrastructureSocketMock.mockReset();
    disconnectInfrastructureSocketMock.mockReset();
  });

  it("reuses one socket across rerenders and removes only its own listeners on unmount", async () => {
    const socket = new FakeSocket();
    getInfrastructureSocketMock.mockReturnValue(socket);
    const { InfrastructureProvider } = await loadInfrastructureProvider();

    const { rerender, unmount } = render(
      <InfrastructureProvider>
        <span>First</span>
      </InfrastructureProvider>,
    );
    const socketRegistrations = [...socket.on.mock.calls];
    const managerRegistrations = [...socket.io.on.mock.calls];

    rerender(
      <InfrastructureProvider>
        <span>Second</span>
      </InfrastructureProvider>,
    );

    expect(getInfrastructureSocketMock).toHaveBeenCalledTimes(1);
    expect(socket.on).toHaveBeenCalledTimes(socketRegistrations.length);
    expect(socket.io.on).toHaveBeenCalledTimes(managerRegistrations.length);

    unmount();
    for (const [event, handler] of socketRegistrations) {
      expect(socket.off).toHaveBeenCalledWith(event, handler);
    }
    for (const [event, handler] of managerRegistrations) {
      expect(socket.io.off).toHaveBeenCalledWith(event, handler);
    }
    expect(disconnectInfrastructureSocketMock).toHaveBeenCalledTimes(1);
  });
});

describe("shared UI states", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a dimension-preserving skeleton with an accessible loading indication", async () => {
    const { LoadingState } = await loadLoadingState();
    render(<LoadingState label="Loading leaderboard" minHeight={320} />);

    const status = screen.getByRole("status", { name: "Loading leaderboard" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveStyle({ minHeight: "320px" });
    expect(
      within(status).getAllByTestId("loading-skeleton").length,
    ).toBeGreaterThan(0);
  });

  it("sanitizes caught errors and exposes at most one clear retry action", async () => {
    const { ErrorBoundary } = await loadErrorBoundary();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let shouldThrow = true;
    const retry = vi.fn(() => {
      shouldThrow = false;
    });

    function FailingChild() {
      if (shouldThrow) {
        throw new Error("redis://secret-provider.internal raw stack");
      }
      return <p>Recovered</p>;
    }

    render(
      <ErrorBoundary onRetry={retry}>
        <FailingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(
      screen.queryByText(/secret-provider|redis:\/\//i),
    ).not.toBeInTheDocument();
    const actions = screen.getAllByRole("button");
    expect(actions).toHaveLength(1);
    expect(actions[0]).toHaveAccessibleName("Try again");

    fireEvent.click(actions[0]);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Recovered")).toBeInTheDocument();
  });
});
