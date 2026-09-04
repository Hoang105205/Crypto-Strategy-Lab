import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const chartMock = vi.hoisted(() => ({
  addSeries: vi.fn(),
  applyOptions: vi.fn(),
  remove: vi.fn(),
  timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
}));
const seriesMock = vi.hoisted(() => ({
  setData: vi.fn(),
  update: vi.fn(),
}));
const tradeMarkersMock = vi.hoisted(() => vi.fn(() => null));

vi.mock('lightweight-charts', () => ({
  CandlestickSeries: {},
  createChart: vi.fn(() => chartMock),
}));

vi.mock('../../hooks/use-market-data', () => ({
  useMarketData: () => ({ candles: [], loading: false, error: null }),
}));

vi.mock('./trade-markers', () => ({
  TradeMarkers: tradeMarkersMock,
}));

vi.mock('./chart-overlay', () => ({
  ChartOverlay: () => null,
}));

type ResizeCallback = ResizeObserverCallback;
let resizeCallback: ResizeCallback | null = null;

class ResizeObserverMock {
  constructor(callback: ResizeCallback) {
    resizeCallback = callback;
  }

  observe = vi.fn();
  disconnect = vi.fn();
}

describe('CandlestickChart disposal lifecycle', () => {
  beforeEach(() => {
    resizeCallback = null;
    chartMock.addSeries.mockReset().mockReturnValue(seriesMock);
    chartMock.applyOptions.mockReset();
    chartMock.remove.mockReset();
    chartMock.timeScale.mockClear();
    tradeMarkersMock.mockClear();
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  it('does not create an empty marker plugin and ignores queued resize after unmount', async () => {
    const { CandlestickChart } = await import('./candlestick-chart');
    const { unmount } = render(
      <CandlestickChart symbol="BTCUSDT" timeframe="1h" />,
    );

    expect(tradeMarkersMock).not.toHaveBeenCalled();
    const queuedResize = resizeCallback;
    expect(queuedResize).not.toBeNull();

    unmount();
    expect(chartMock.remove).toHaveBeenCalledTimes(1);
    queuedResize?.([], {} as ResizeObserver);
    expect(chartMock.applyOptions).not.toHaveBeenCalled();
  });
});
