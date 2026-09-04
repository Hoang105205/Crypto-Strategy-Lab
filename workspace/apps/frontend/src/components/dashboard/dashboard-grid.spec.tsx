import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

const getPairsMock = vi.hoisted(() => vi.fn());

vi.mock("../../services/api-client", () => {
  return { apiClient: { getPairs: getPairsMock } };
});

vi.mock("../../hooks/use-websocket", () => ({
  useWebSocket: () => ({
    status: "connected",
    exchange: "binance",
    lastReconnectAt: null,
  }),
}));

vi.mock("../chart/candlestick-chart", () => ({
  CandlestickChart: ({
    symbol,
    timeframe,
  }: {
    symbol: string;
    timeframe: string;
  }) => (
    <div data-testid="candlestick-chart">
      {symbol}:{timeframe}
    </div>
  ),
}));

interface DashboardGridProps {
  pair: string;
  onPairChange(value: string): void;
  loopStatusPanel: ReactNode;
  leaderboardPreview: ReactNode;
}

interface DashboardGridModule {
  DashboardGrid(props: DashboardGridProps): ReactElement;
}

async function loadDashboardGrid(): Promise<DashboardGridModule> {
  const modulePath = "./dashboard-grid";
  return import(/* @vite-ignore */ modulePath) as Promise<DashboardGridModule>;
}

describe("DashboardGrid contract", () => {
  beforeEach(() => {
    getPairsMock.mockReset();
    getPairsMock.mockResolvedValue([
      {
        symbol: "BTCUSDT",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        isActive: true,
      },
      {
        symbol: "ETHUSDT",
        baseAsset: "ETH",
        quoteAsset: "USDT",
        isActive: true,
      },
    ]);
  });

  it("composes the existing Market Data controls/grid in an 8/4 desktop layout that stacks on mobile", async () => {
    const { DashboardGrid } = await loadDashboardGrid();
    const onPairChange = vi.fn();
    render(
      <DashboardGrid
        pair="BTCUSDT"
        onPairChange={onPairChange}
        loopStatusPanel={<p>Loop panel</p>}
        leaderboardPreview={<p>Leaderboard preview</p>}
      />,
    );

    const dashboard = screen.getByTestId("dashboard-grid");
    expect(dashboard).toHaveClass("grid-cols-1", "md:grid-cols-12");
    expect(screen.getByRole("region", { name: /market data/i })).toHaveClass(
      "md:col-span-8",
    );
    expect(
      screen.getByRole("complementary", { name: /infrastructure status/i }),
    ).toHaveClass("md:col-span-4");

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getAllByTestId("candlestick-chart")).toHaveLength(4);
    const pairSelector = screen.getByRole("combobox", {
      name: /trading pair/i,
    });
    await waitFor(() =>
      expect(within(pairSelector).getByText("ETH/USDT")).toBeInTheDocument(),
    );
    fireEvent.change(pairSelector, { target: { value: "ETHUSDT" } });
    expect(onPairChange).toHaveBeenCalledWith("ETHUSDT");
  });

  it("keeps frozen rows while OFF, then shows caught-up continuous ranks after re-enable", async () => {
    const { DashboardGrid } = await loadDashboardGrid();
    const { rerender } = render(
      <DashboardGrid
        pair="BTCUSDT"
        onPairChange={vi.fn()}
        loopStatusPanel={<p>Loop iteration 2 · Live updates ON</p>}
        leaderboardPreview={<p>1 Leader version-1</p>}
      />,
    );
    await waitFor(() =>
      expect(
        within(
          screen.getByRole("combobox", { name: /trading pair/i }),
        ).getByText("ETH/USDT"),
      ).toBeInTheDocument(),
    );

    const marketRegion = screen.getByRole("region", { name: /market data/i });
    const selectors = within(marketRegion).getAllByRole("combobox");
    fireEvent.change(selectors[0], { target: { value: "1m" } });
    expect(selectors[0]).toHaveValue("1m");

    rerender(
      <DashboardGrid
        pair="BTCUSDT"
        onPairChange={vi.fn()}
        loopStatusPanel={<p>Loop iteration 3 · Live updates OFF</p>}
        leaderboardPreview={<p>1 Leader version-1</p>}
      />,
    );

    expect(screen.getByText(/Loop iteration 3/)).toBeInTheDocument();
    expect(screen.getByText("1 Leader version-1")).toBeInTheDocument();
    expect(screen.queryByText(/version-2/)).not.toBeInTheDocument();

    rerender(
      <DashboardGrid
        pair="BTCUSDT"
        onPairChange={vi.fn()}
        loopStatusPanel={<p>Loop iteration 3 · Live updates ON</p>}
        leaderboardPreview={
          <ol aria-label="Caught-up leaderboard">
            <li>1 Leader version-2</li>
            <li>2 Leader version-1</li>
          </ol>
        }
      />,
    );

    expect(
      within(screen.getByRole("list", { name: /caught-up leaderboard/i }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["1 Leader version-2", "2 Leader version-1"]);
    expect(
      within(marketRegion).getAllByTestId("candlestick-chart"),
    ).toHaveLength(4);
    expect(within(marketRegion).getAllByRole("combobox")[0]).toHaveValue("1m");
  });
});
