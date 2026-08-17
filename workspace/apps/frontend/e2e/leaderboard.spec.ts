import { expect, test, type Page, type Route } from '@playwright/test';

const strategyVersionId = '11111111-1111-4111-8111-111111111111';

const entry = {
  rank: 1,
  strategyVersionId,
  strategyName: 'Momentum v2',
  strategyType: 'RSI',
  isComposite: false,
  backtestResultId: '22222222-2222-4222-8222-222222222222',
  score: 0.81234,
  totalReturn: 12.345,
  winRate: 0.625,
  maxDrawdown: -8.2,
  sharpeRatio: 1.456,
  totalTrades: 1,
};

const snapshot = {
  rankingCriterion: 'score',
  updatedAt: '2026-08-16T10:00:00.000Z',
  entries: [entry],
};

const detail = {
  ...entry,
  strategyVersion: {
    id: strategyVersionId,
    strategyType: 'RSI',
    name: 'Momentum v2',
    version: 2,
    parameters: { period: 14, oversold: 30 },
    isComposite: false,
    createdAt: '2026-08-10T09:00:00.000Z',
  },
  trades: [
    {
      entryDate: '2026-08-01T10:00:00.000Z',
      exitDate: '2026-08-01T12:00:00.000Z',
      entryPrice: 100,
      exitPrice: 105,
      side: 'LONG',
      pnl: 150.25,
      quantity: 2,
    },
  ],
  executedAt: '2026-08-16T10:00:00.000Z',
};

const jsonHeaders = {
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-origin': '*',
  'content-type': 'application/json',
};

async function fulfillPreflight(route: Route): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') return false;
  await route.fulfill({ status: 204, headers: jsonHeaders });
  return true;
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
}

async function mockLeaderboard(page: Page, onListRequest?: (url: URL) => void) {
  await page.route('**/api/leaderboard**', async (route) => {
    if (await fulfillPreflight(route)) return;
    const url = new URL(route.request().url());
    if (url.pathname === `/api/leaderboard/${strategyVersionId}`) {
      await fulfillJson(route, detail);
      return;
    }
    onListRequest?.(url);
    await fulfillJson(route, snapshot);
  });
}

test('leaving the four-chart Dashboard does not access disposed chart objects', async ({
  page,
}) => {
  const disposedErrors: string[] = [];
  page.on('pageerror', (error) => {
    if (/object is disposed/i.test(error.message)) {
      disposedErrors.push(error.message);
    }
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Market Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'Strategy Builder' }).click();
  await expect(page).toHaveURL(/\/strategy$/);
  await page.waitForTimeout(250);

  expect(disposedErrors).toEqual([]);
});

test('desktop supports exact sort requests, keyboard selection, detail, and disconnected retention', async ({
  page,
}) => {
  const listRequests: URL[] = [];
  await mockLeaderboard(page, (url) => listRequests.push(url));
  await page.goto('/leaderboard');

  const table = page.getByRole('table', { name: 'Strategy leaderboard' });
  await expect(table).toBeVisible();
  await expect(page.getByText(/Last updated:/)).toBeVisible();
  await expect(page.getByText('+12.35%')).toBeVisible();
  await expect(page.getByText('62.50%')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /score/i })).toHaveAttribute(
    'aria-sort',
    'descending',
  );

  await page.getByRole('button', { name: 'Sort by Sharpe' }).click();
  await expect.poll(() => listRequests.some((url) => url.searchParams.get('sortBy') === 'sharpeRatio')).toBe(true);
  await expect(page.getByRole('columnheader', { name: /sharpe/i })).toHaveAttribute(
    'aria-sort',
    'descending',
  );

  const selectStrategy = page.getByRole('button', { name: 'Select Momentum v2' });
  await selectStrategy.focus();
  await expect(selectStrategy).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Momentum v2' })).toBeVisible();
  await expect(page.getByText('Version 2 · RSI')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Published trades' })).toContainText('150.25');
  await expect(page.getByRole('row', { name: /momentum v2/i })).toHaveAttribute('aria-selected', 'true');

  await expect(page.getByText('Infrastructure: Connected')).toBeVisible();
  await page.context().setOffline(true);
  await expect(page.getByText(/Infrastructure: (Disconnected|Reconnecting)/)).toBeVisible();
  await expect(table).toBeVisible();
  await expect(page.getByText('Momentum v2').first()).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByText('Infrastructure: Connected')).toBeVisible();
  await expect(table).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /sharpe/i })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
});

test('mobile keeps all columns in a scroll wrapper and places detail below the table', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockLeaderboard(page);
  await page.goto('/leaderboard');
  await expect(page.getByRole('table', { name: 'Strategy leaderboard' })).toBeVisible();

  const menu = page.getByRole('button', { name: 'Open navigation menu' });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation menu' }).click();

  const scrollWrapper = page.getByTestId('leaderboard-scroll');
  await expect(scrollWrapper).toBeVisible();
  expect(await scrollWrapper.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  for (const name of ['Rank', 'Strategy', 'Score', 'Return', 'Win Rate', 'Max Drawdown', 'Sharpe', 'Trades']) {
    await expect(page.getByRole('columnheader', { name: new RegExp(name, 'i') })).toBeAttached();
  }

  await page.getByRole('button', { name: 'Select Momentum v2' }).click();
  const tableBox = await page.getByRole('table', { name: 'Strategy leaderboard' }).boundingBox();
  const detailBox = await page.getByRole('heading', { name: 'Momentum v2' }).boundingBox();
  expect(tableBox).not.toBeNull();
  expect(detailBox).not.toBeNull();
  expect(detailBox!.y).toBeGreaterThan(tableBox!.y + tableBox!.height);
});

test('detail hides a provider 503 and exposes exactly one working retry', async ({ page }) => {
  let detailAttempts = 0;
  await page.route('**/api/leaderboard**', async (route) => {
    if (await fulfillPreflight(route)) return;
    const url = new URL(route.request().url());
    if (url.pathname !== `/api/leaderboard/${strategyVersionId}`) {
      await fulfillJson(route, snapshot);
      return;
    }
    detailAttempts += 1;
    if (detailAttempts === 1) {
      await fulfillJson(route, { code: 'STRATEGY_ENGINE_UNAVAILABLE', error: 'provider.internal ECONNREFUSED' }, 503);
      return;
    }
    await fulfillJson(route, detail);
  });
  await page.goto(`/leaderboard?strategyVersionId=${strategyVersionId}`);

  await expect(page.getByText('Strategy detail is temporarily unavailable.')).toBeVisible();
  await expect(page.getByText(/provider\.internal|ECONNREFUSED/)).toHaveCount(0);
  const retry = page.getByRole('button', { name: 'Retry' });
  await expect(retry).toHaveCount(1);
  await retry.click();
  await expect(page.getByRole('heading', { name: 'Momentum v2' })).toBeVisible();
  expect(detailAttempts).toBe(2);
});
