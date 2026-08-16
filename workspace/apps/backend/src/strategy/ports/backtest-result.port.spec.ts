import type { BacktestResultCreateInput } from '@crypto-strategy-lab/shared';
import { BacktestResultPort } from './backtest-result.port';

const input: BacktestResultCreateInput = {
  jobId: 'f3338108-2257-4e16-bf43-80ad50507ba1',
  strategyVersionId: 'version-1',
  pair: 'BTCUSDT',
  timeframe: '1h',
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-01-02T00:00:00.000Z'),
  totalReturn: 0.1,
  winRate: 0.5,
  maxDrawdown: 0.05,
  sharpeRatio: 1.2,
  profitFactor: 1.5,
  totalTrades: 1,
  trades: [],
  executedAt: new Date('2026-01-02T00:00:01.000Z'),
  executionTimeMs: 100,
};

const stored = { id: 'result-1', ...input };

describe('BacktestResultPort', () => {
  it('creates a result once using producer jobId', async () => {
    const prisma = mockPrisma(null);
    prisma.backtestResult.create.mockResolvedValue(stored);
    const port = new BacktestResultPort(prisma as never);

    await expect(port.save(input)).resolves.toEqual(stored);
    expect(prisma.backtestResult.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ jobId: input.jobId }),
    });
  });

  it('returns the immutable existing result for the same job request', async () => {
    const prisma = mockPrisma(stored);
    const port = new BacktestResultPort(prisma as never);

    const replay = { ...input, executedAt: new Date(), executionTimeMs: 999 };
    await expect(port.save(replay)).resolves.toEqual(stored);
    expect(prisma.backtestResult.create).not.toHaveBeenCalled();
  });

  it('rejects reuse of a jobId for a different backtest request', async () => {
    const prisma = mockPrisma(stored);
    const port = new BacktestResultPort(prisma as never);

    await expect(port.save({ ...input, pair: 'ETHUSDT' })).rejects.toMatchObject({
      code: 'JOB_CONFLICT',
    });
  });

  it('resolves a concurrent unique race to the winning immutable result', async () => {
    const prisma = mockPrisma(null);
    prisma.backtestResult.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stored);
    prisma.backtestResult.create.mockRejectedValue({ code: 'P2002' });
    const port = new BacktestResultPort(prisma as never);

    await expect(port.save(input)).resolves.toEqual(stored);
  });

  it('gets a persisted result by result id', async () => {
    const prisma = mockPrisma(stored);
    const port = new BacktestResultPort(prisma as never);

    await expect(port.getById(stored.id)).resolves.toEqual(stored);
    expect(prisma.backtestResult.findUnique).toHaveBeenCalledWith({
      where: { id: stored.id },
    });
  });
});

function mockPrisma(existing: typeof stored | null) {
  return {
    backtestResult: {
      findUnique: jest.fn().mockResolvedValue(existing),
      create: jest.fn(),
    },
  };
}
