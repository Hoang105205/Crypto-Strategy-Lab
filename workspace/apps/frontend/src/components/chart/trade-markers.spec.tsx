import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

const createSeriesMarkersMock = vi.hoisted(() => vi.fn());

vi.mock('lightweight-charts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lightweight-charts')>();
  return {
    ...actual,
    createSeriesMarkers: createSeriesMarkersMock,
  };
});

interface Trade {
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  side: string;
  pnl: number;
  quantity: number;
}

interface TradeMarkersProps {
  series: unknown;
  trades: Trade[];
}

interface TradeMarkersModule {
  TradeMarkers(props: TradeMarkersProps): ReactElement | null;
}

interface MarkerPlugin {
  setMarkers: ReturnType<typeof vi.fn>;
  detach: ReturnType<typeof vi.fn>;
}

const createdPlugins: MarkerPlugin[] = [];

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    entryDate: new Date('2026-08-01T10:00:00.000Z'),
    exitDate: new Date('2026-08-01T12:00:00.000Z'),
    entryPrice: 100,
    exitPrice: 105,
    side: 'LONG',
    // Deliberately inconsistent with the price delta: the UI must use published P&L.
    pnl: -42.5,
    quantity: 2,
    ...overrides,
  };
}

async function loadTradeMarkers(): Promise<TradeMarkersModule> {
  const modulePath = './trade-markers';
  return import(/* @vite-ignore */ modulePath) as Promise<TradeMarkersModule>;
}

beforeEach(() => {
  createdPlugins.length = 0;
  createSeriesMarkersMock.mockReset();
  createSeriesMarkersMock.mockImplementation(() => {
    const plugin: MarkerPlugin = {
      setMarkers: vi.fn(),
      detach: vi.fn(),
    };
    createdPlugins.push(plugin);
    return plugin;
  });
});

describe('TradeMarkers lightweight-charts v5 contract', () => {
  it('maps published entryDate/exitDate and published P&L into labeled v5 marker input', async () => {
    const { TradeMarkers } = await loadTradeMarkers();
    const series = { id: 'candlestick-series' };
    render(<TradeMarkers series={series} trades={[trade()]} />);

    expect(createSeriesMarkersMock).toHaveBeenCalledTimes(1);
    expect(createSeriesMarkersMock.mock.calls[0]?.[0]).toBe(series);
    const markers = createSeriesMarkersMock.mock.calls[0]?.[1] as Array<
      Record<string, unknown>
    >;
    expect(markers).toHaveLength(2);
    expect(markers[0]).toEqual(
      expect.objectContaining({
        time: Math.floor(new Date('2026-08-01T10:00:00.000Z').getTime() / 1000),
        position: 'belowBar',
        shape: 'arrowUp',
        text: expect.stringMatching(/entry.*long.*100\.00/i),
      }),
    );
    expect(markers[1]).toEqual(
      expect.objectContaining({
        time: Math.floor(new Date('2026-08-01T12:00:00.000Z').getTime() / 1000),
        position: 'aboveBar',
        shape: 'arrowDown',
        text: expect.stringMatching(/exit.*p&l.*-42\.50/i),
      }),
    );
    expect(JSON.stringify(markers)).not.toMatch(/BUY|SELL|signal/i);
  });

  it('passes an empty marker list for empty published trades', async () => {
    const { TradeMarkers } = await loadTradeMarkers();
    render(<TradeMarkers series={{ id: 'series-empty' }} trades={[]} />);

    expect(createSeriesMarkersMock).toHaveBeenCalledTimes(1);
    expect(createSeriesMarkersMock.mock.calls[0]?.[1]).toEqual([]);
  });

  it('replaces markers on trade changes and detaches the v5 plugin on series replacement/unmount', async () => {
    const { TradeMarkers } = await loadTradeMarkers();
    const firstSeries = { id: 'series-1' };
    const secondSeries = { id: 'series-2' };
    const { rerender, unmount } = render(
      <TradeMarkers series={firstSeries} trades={[trade()]} />,
    );
    const firstPlugin = createdPlugins[0];

    rerender(
      <TradeMarkers
        series={firstSeries}
        trades={[trade({ pnl: 10 }), trade({ side: 'SHORT', pnl: 5 })]}
      />,
    );
    expect(createSeriesMarkersMock).toHaveBeenCalledTimes(1);
    expect(firstPlugin.setMarkers).toHaveBeenCalledTimes(1);
    expect(firstPlugin.setMarkers.mock.calls[0]?.[0]).toHaveLength(4);

    rerender(<TradeMarkers series={secondSeries} trades={[trade()]} />);
    expect(firstPlugin.detach).toHaveBeenCalledTimes(1);
    expect(createSeriesMarkersMock).toHaveBeenCalledTimes(2);
    expect(createSeriesMarkersMock.mock.calls[1]?.[0]).toBe(secondSeries);

    const secondPlugin = createdPlugins[1];
    unmount();
    expect(secondPlugin.detach).toHaveBeenCalledTimes(1);
  });
});
