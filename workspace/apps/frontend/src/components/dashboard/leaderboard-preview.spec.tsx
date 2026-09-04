import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string;
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

interface Entry {
  rank: number;
  strategyVersionId: string;
  strategyName: string;
  strategyType: string;
  isComposite: boolean;
  backtestResultId: string;
  score: number;
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
}

interface Snapshot {
  rankingCriterion: "score";
  updatedAt: Date;
  entries: Entry[];
}

interface LeaderboardPreviewProps {
  snapshot: Snapshot | null;
  loading?: boolean;
  error?: Error | null;
  isStale?: boolean;
  lastSuccessfulAt?: Date | null;
  selectedStrategyVersionId?: string | null;
  onSelectStrategy?(strategyVersionId: string): void;
  onRetry(): void;
}

interface LeaderboardPreviewModule {
  LeaderboardPreview(props: LeaderboardPreviewProps): ReactElement;
}

function entry(rank: number, identity = rank): Entry {
  return {
    rank,
    strategyVersionId: `version-${identity}`,
    strategyName: `Strategy ${identity}`,
    strategyType: "MA",
    isComposite: false,
    backtestResultId: `result-${identity}`,
    score: 1 - rank / 10,
    totalReturn: rank * 2,
    winRate: 0.5,
    maxDrawdown: -rank,
    sharpeRatio: 1,
    totalTrades: 10,
  };
}

function snapshot(entries: Entry[]): Snapshot {
  return {
    rankingCriterion: "score",
    updatedAt: new Date("2026-08-16T10:00:00.000Z"),
    entries,
  };
}

async function loadPreview(): Promise<LeaderboardPreviewModule> {
  const modulePath = "./leaderboard-preview";
  return import(
    /* @vite-ignore */ modulePath
  ) as Promise<LeaderboardPreviewModule>;
}

describe("LeaderboardPreview contract", () => {
  it("remains one Combined Top-5 preview rather than rendering scoped cards", async () => {
    const { LeaderboardPreview } = await loadPreview();
    render(
      <LeaderboardPreview
        snapshot={snapshot([
          entry(1, 1),
          entry(2, 2),
          entry(3, 3),
          entry(4, 4),
          entry(5, 5),
          entry(6, 6),
        ])}
        onRetry={vi.fn()}
      />,
    );

    expect(
      screen.getAllByRole("list", { name: /leaderboard preview/i }),
    ).toHaveLength(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByText(/my strategies/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/system leaderboard/i)).not.toBeInTheDocument();
  });

  it("shows at most five entries with continuous view-local ranks and valid navigation", async () => {
    const { LeaderboardPreview } = await loadPreview();
    const selectStrategy = vi.fn();
    render(
      <LeaderboardPreview
        snapshot={snapshot([
          entry(1, 7),
          entry(2, 2),
          entry(3, 9),
          entry(4, 1),
          entry(5, 5),
          entry(6, 3),
        ])}
        selectedStrategyVersionId="version-2"
        onSelectStrategy={selectStrategy}
        onRetry={vi.fn()}
      />,
    );

    const list = screen.getByRole("list", { name: /leaderboard preview/i });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items.map((item) => item.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("1"),
        expect.stringContaining("2"),
        expect.stringContaining("3"),
        expect.stringContaining("4"),
        expect.stringContaining("5"),
      ]),
    );
    expect(items.map((item) => item.textContent?.match(/\d+/)?.[0])).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    const fullLeaderboard = screen.getByRole("link", {
      name: /view full leaderboard/i,
    });
    expect(fullLeaderboard).toHaveAttribute("href", "/leaderboard");
    expect(fullLeaderboard.className).toMatch(/focus-visible:/);
    const detail = screen.getByRole("link", { name: /strategy 2/i });
    expect(detail).toHaveAttribute(
      "href",
      "/leaderboard?strategyVersionId=version-2",
    );
    expect(detail).toHaveAttribute("aria-current", "true");
    expect(detail.className).toMatch(/focus-visible:/);
    fireEvent.click(detail);
    expect(selectStrategy).toHaveBeenCalledWith("version-2");
  });

  it("freezes the supplied snapshot until a caught-up continuous-rank snapshot arrives", async () => {
    const { LeaderboardPreview } = await loadPreview();
    const timestamp = new Date("2026-08-16T10:00:00.000Z");
    const { rerender } = render(
      <LeaderboardPreview
        snapshot={snapshot([entry(1, 1), entry(2, 2)])}
        selectedStrategyVersionId="version-2"
        isStale
        lastSuccessfulAt={timestamp}
        onRetry={vi.fn()}
      />,
    );
    rerender(
      <LeaderboardPreview
        snapshot={snapshot([entry(1, 1), entry(2, 2)])}
        selectedStrategyVersionId="version-2"
        isStale
        lastSuccessfulAt={timestamp}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Strategy 1")).toBeInTheDocument();
    expect(screen.queryByText("Strategy 3")).not.toBeInTheDocument();

    rerender(
      <LeaderboardPreview
        snapshot={{
          ...snapshot([entry(1, 3), entry(2, 2)]),
          updatedAt: new Date("2026-08-16T10:01:00.000Z"),
        }}
        selectedStrategyVersionId="version-2"
        isStale
        lastSuccessfulAt={timestamp}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.queryByText("Strategy 1")).not.toBeInTheDocument();
    expect(screen.getByText("Strategy 3")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: /leaderboard preview/i }))
        .getAllByRole("listitem")
        .map((item) => item.textContent?.match(/^\d+/)?.[0]),
    ).toEqual(["1", "2"]);
    expect(screen.getByRole("link", { name: /strategy 2/i })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      screen.queryByText(/stale|disconnected|reconnecting/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/last updated/i)).toHaveTextContent(
      timestamp.toLocaleString(),
    );
  });

  it("provides stable loading, one empty next action, and a sanitized retry error", async () => {
    const { LeaderboardPreview } = await loadPreview();
    const retry = vi.fn();
    const { rerender } = render(
      <LeaderboardPreview snapshot={null} loading onRetry={retry} />,
    );
    expect(
      screen.getByRole("status", { name: /loading leaderboard preview/i }).style
        .minHeight,
    ).toMatch(/px$/);

    rerender(<LeaderboardPreview snapshot={snapshot([])} onRetry={retry} />);
    expect(screen.getByText(/no leaderboard entries/i)).toBeInTheDocument();
    const emptyActions = screen.getAllByRole("link");
    expect(emptyActions).toHaveLength(1);
    expect(emptyActions[0]).toHaveAttribute("href", "/strategy");

    rerender(
      <LeaderboardPreview
        snapshot={null}
        error={new Error("strategy-provider.internal raw stack")}
        onRetry={retry}
      />,
    );
    expect(
      screen.queryByText(/strategy-provider\.internal|raw stack/i),
    ).not.toBeInTheDocument();
    const retryActions = screen.getAllByRole("button", { name: /retry/i });
    expect(retryActions).toHaveLength(1);
    expect(retryActions[0].className).toMatch(/focus-visible:/);
    fireEvent.click(retryActions[0]);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
