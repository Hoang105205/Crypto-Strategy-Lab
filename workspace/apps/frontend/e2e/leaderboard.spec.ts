import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const fixtureBaseUrl = "http://127.0.0.1:3201";
const userAId = "11111111-1111-4111-8111-111111111111";
const userBId = "22222222-2222-4222-8222-222222222222";
const userALowId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const userBLowId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const missingId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const cacheKey = "crypto-strategy-lab:leaderboard-cache:v2";

interface FixtureRequest {
  sequence: number;
  kind: "list" | "detail" | "dashboard" | "loop-read";
  path: string;
  criterion: string | null;
  scope: "system" | "mine" | "combined" | null;
  viewer: "anonymous" | "A" | "B";
  revision: number;
  status: number | null;
}

interface FixtureState {
  revision: number;
  requests: FixtureRequest[];
  loopCommands: string[];
  connections: number;
  activeConnections: number;
  disconnects: number;
  pendingDelayIds: string[];
  pendingFailureCount: number;
}

const jsonHeaders = {
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json",
};

test.describe.configure({ mode: "serial", timeout: 120_000 });

test.beforeEach(async ({ request }) => {
  await control(request, "reset");
});

async function control(request: APIRequestContext, path: string): Promise<FixtureState> {
  const response = await request.get(`${fixtureBaseUrl}/__test__/${path}`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<FixtureState>;
}

async function fixtureState(request: APIRequestContext): Promise<FixtureState> {
  return control(request, "state");
}

async function installSupabaseAuthFixture(page: Page): Promise<void> {
  await page.route("**/auth/v1/token**", async (route) => {
    const body = route.request().postDataJSON() as { email?: string };
    const actor = body.email?.toLowerCase().startsWith("b@") ? "B" : "A";
    const userId = actor === "B" ? userBId : userAId;
    const email = actor === "B" ? "b@example.test" : "a@example.test";
    await route.fulfill({ status: 200, headers: jsonHeaders, body: JSON.stringify(authSession(userId, email)) });
  });
  await page.route("**/auth/v1/logout**", async (route) => route.fulfill({ status: 204, headers: jsonHeaders }));
}

function authSession(userId: string, email: string) {
  const now = Math.floor(Date.now() / 1_000);
  const user = {
    id: userId, aud: "authenticated", role: "authenticated", email,
    email_confirmed_at: new Date(now * 1_000).toISOString(), phone: "",
    confirmed_at: new Date(now * 1_000).toISOString(), last_sign_in_at: new Date(now * 1_000).toISOString(),
    app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [],
    created_at: new Date(now * 1_000).toISOString(), updated_at: new Date(now * 1_000).toISOString(), is_anonymous: false,
  };
  return {
    access_token: fixtureJwt(userId, email, now), token_type: "bearer", expires_in: 3_600,
    expires_at: now + 3_600, refresh_token: `refresh-${userId}`, user,
  };
}

function fixtureJwt(userId: string, email: string, issuedAt = Math.floor(Date.now() / 1_000)): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ aud: "authenticated", exp: issuedAt + 3_600, iat: issuedAt, role: "authenticated", sub: userId, email })}.fixture`;
}

function authorization(actor: "A" | "B") {
  const userId = actor === "A" ? userAId : userBId;
  return { authorization: `Bearer ${fixtureJwt(userId, `${actor.toLowerCase()}@example.test`)}` };
}

async function signIn(page: Page, actor: "A" | "B"): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(actor === "A" ? "a@example.test" : "b@example.test");
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect.poll(async () => (await page.context().cookies()).some((cookie) => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name))).toBe(true);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Market Dashboard" })).toBeVisible();
}

async function signOutThroughBroadcast(context: BrowserContext, broadcaster: Page): Promise<void> {
  const authCookie = (await context.cookies()).find((cookie) => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name));
  expect(authCookie).toBeDefined();
  const channel = authCookie!.name.replace(/\.\d+$/, "");
  await context.clearCookies();
  await broadcaster.evaluate((storageKey) => {
    const broadcast = new BroadcastChannel(storageKey);
    broadcast.postMessage({ event: "SIGNED_OUT", session: null });
    broadcast.close();
  }, channel);
}

function listRequests(state: FixtureState) {
  return state.requests.filter((item) => item.kind === "list");
}

async function cacheEnvelope(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}") as {
    version?: number;
    viewerKey?: string;
    activeCriterion?: string;
    selectedStrategy?: { strategyVersionId: string; sourceScope: string } | null;
    snapshots?: Record<string, { entries?: Array<{ userId: string | null; strategyName: string }> }>;
  }, cacheKey);
}

test("anonymous sees only System plus accessible My sign-in and no private request/cache", async ({ page }) => {
  await page.goto("/leaderboard");
  const system = page.getByRole("table", { name: "System leaderboard rankings" });
  await expect(system).toBeVisible();
  await expect(system).toContainText("system-one-score-r1");
  await expect(page.getByText(/A-low|A-second|B-low/)).toHaveCount(0);
  const mine = page.getByRole("region", { name: "My Strategies" });
  await expect(mine.getByText("Sign in to view your strategies.")).toBeVisible();
  await expect(mine.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?redirect=/leaderboard");

  await expect.poll(async () => listRequests(await fixtureState(page.request)).map(({ scope }) => scope).sort()).toEqual(["combined", "system"]);
  expect(listRequests(await fixtureState(page.request)).some(({ scope }) => scope === "mine")).toBe(false);
  const envelope = await cacheEnvelope(page);
  expect(envelope.viewerKey).toBe("anonymous");
  expect(Object.keys(envelope.snapshots ?? {}).sort()).toEqual(["combined:score", "system:score"]);
  expect(JSON.stringify(envelope)).not.toMatch(/A-low|A-second|B-low/);

  const omitted = await page.request.get(`${fixtureBaseUrl}/api/leaderboard`);
  expect((await omitted.json()).entries.map((row: { userId: string | null }) => row.userId)).toEqual([null, null, null]);
  const foreign = await page.request.get(`${fixtureBaseUrl}/api/leaderboard/${userALowId}?scope=mine`);
  const missing = await page.request.get(`${fixtureBaseUrl}/api/leaderboard/${missingId}?scope=mine`);
  expect(foreign.status()).toBe(404);
  expect(missing.status()).toBe(404);
  expect(await foreign.json()).toEqual(await missing.json());
  expect((await fixtureState(page.request)).loopCommands).toEqual([]);
});

test("user A gets System-only and A-only Mine below Combined cutoff with shared sort and scoped details", async ({ page }) => {
  await installSupabaseAuthFixture(page);
  await signIn(page, "A");
  await control(page.request, "clear");
  await page.goto("/leaderboard");

  const system = page.getByRole("table", { name: "System leaderboard rankings" });
  const mine = page.getByRole("table", { name: "My strategies rankings" });
  await expect(system).toContainText("system-one-score-r1");
  await expect(system).not.toContainText("A-low");
  await expect(mine).toContainText("A-low-score-r1");
  await expect(mine).toContainText("A-second-score-r1");
  await expect(page.getByText(/B-low/)).toHaveCount(0);
  await expect(mine.getByText("#1")).toBeVisible();
  await expect(mine.getByText("#2")).toBeVisible();

  const combined = await page.request.get(`${fixtureBaseUrl}/api/leaderboard`, { headers: authorization("A") });
  const combinedBody = await combined.json() as { updatedAt: string; entries: Array<{ strategyVersionId: string }> };
  expect(combinedBody.entries).toHaveLength(3);
  expect(combinedBody.entries.some(({ strategyVersionId }) => strategyVersionId === userALowId)).toBe(false);
  const systemRaw = await page.request.get(`${fixtureBaseUrl}/api/leaderboard?scope=system`, { headers: authorization("A") });
  const mineRaw = await page.request.get(`${fixtureBaseUrl}/api/leaderboard?scope=mine`, { headers: authorization("A") });
  const [systemBody, mineBody] = await Promise.all([systemRaw.json(), mineRaw.json()]) as Array<{ updatedAt: string; entries: Array<{ rank: number }> }>;
  expect(systemBody.updatedAt).not.toBe(mineBody.updatedAt);
  expect(mineBody.updatedAt).not.toBe(combinedBody.updatedAt);
  expect(mineBody.entries.map(({ rank }) => rank)).toEqual([1, 2]);

  await page.getByLabel("Ranking criterion").selectOption("sharpeRatio");
  await expect(system).toContainText("system-one-sharpeRatio-r1");
  await expect(mine).toContainText("A-low-sharpeRatio-r1");
  await expect.poll(async () => listRequests(await fixtureState(page.request)).filter(({ criterion }) => criterion === "sharpeRatio").map(({ scope }) => scope).sort()).toEqual(["mine", "system"]);

  await system.getByRole("button", { name: /Select system-one-sharpeRatio-r1/ }).click();
  await expect(page.getByRole("heading", { name: "system-one-score-r1" })).toBeVisible();
  await mine.getByRole("button", { name: /Select A-low-sharpeRatio-r1/ }).click();
  await expect(page.getByRole("heading", { name: "A-low-score-r1" })).toBeVisible();
  const detailScopes = (await fixtureState(page.request)).requests.filter(({ kind }) => kind === "detail").map(({ scope }) => scope);
  expect(detailScopes).toEqual(expect.arrayContaining(["system", "mine"]));

  const foreign = await page.request.get(`${fixtureBaseUrl}/api/leaderboard/${userBLowId}?scope=mine`, { headers: authorization("A") });
  const missing = await page.request.get(`${fixtureBaseUrl}/api/leaderboard/${missingId}?scope=mine`, { headers: authorization("A") });
  expect(await foreign.json()).toEqual(await missing.json());

  await page.getByRole("link", { name: "Dashboard" }).click();
  const preview = page.getByRole("region", { name: "Leaderboard preview" });
  await expect(preview).toContainText("system-one-score-r1");
  await expect(preview).not.toContainText("A-low");
  await expect(page.getByRole("heading", { name: "System Leaderboard" })).toHaveCount(0);
  expect((await fixtureState(page.request)).loopCommands).toEqual([]);
});

test("user B is symmetric: System-only plus B-only Mine with no A metadata", async ({ page }) => {
  await installSupabaseAuthFixture(page);
  await signIn(page, "B");
  await page.goto("/leaderboard");
  const system = page.getByRole("table", { name: "System leaderboard rankings" });
  const mine = page.getByRole("table", { name: "My strategies rankings" });
  await expect(system).toContainText("system-one-score-r1");
  await expect(mine).toContainText("B-low-score-r1");
  await expect(page.getByText(/A-low|A-second/)).toHaveCount(0);
  expect(JSON.stringify(await cacheEnvelope(page))).not.toMatch(/A-low|A-second|11111111-1111-4111-8111-111111111111/);
  const scopes = listRequests(await fixtureState(page.request)).filter(({ viewer }) => viewer === "B").map(({ scope }) => scope);
  expect(scopes).toEqual(expect.arrayContaining(["combined", "system", "mine"]));
});

test("Mine initial error, delayed retry, stale refresh and recovery stay independent from System", async ({ page }) => {
  await installSupabaseAuthFixture(page);
  await signIn(page, "A");
  await control(page.request, "fail-next?kind=list&viewer=A&scope=mine&criterion=score&status=503");
  await page.goto("/leaderboard");
  await expect(page.getByRole("table", { name: "System leaderboard rankings" })).toBeVisible();
  await expect(page.getByRole("alert", { name: "My Strategies unavailable" })).toBeVisible();

  await control(page.request, "delay-next?id=mine-retry&kind=list&viewer=A&scope=mine&criterion=score");
  await page.getByRole("button", { name: "Retry My Strategies" }).click();
  await expect.poll(async () => (await fixtureState(page.request)).pendingDelayIds).toContain("mine-retry");
  await expect(page.getByRole("status", { name: "Loading My Strategies" })).toBeVisible();
  await expect(page.getByRole("table", { name: "System leaderboard rankings" })).toBeVisible();
  await control(page.request, "release?id=mine-retry");
  await expect(page.getByRole("table", { name: "My strategies rankings" })).toContainText("A-low-score-r1");

  await page.getByRole("link", { name: "Dashboard" }).click();
  const live = page.getByRole("switch", { name: "Live updates" });
  await live.click();
  await expect(live).toHaveAttribute("aria-checked", "true");
  await control(page.request, "clear");
  await page.getByRole("link", { name: "View full leaderboard" }).click();
  await expect.poll(async () => listRequests(await fixtureState(page.request)).filter(({ scope, status }) => (scope === "system" || scope === "mine") && status === 200).length).toBe(2);
  await control(page.request, "clear");
  await control(page.request, "revision?value=2");
  await control(page.request, "fail-next?kind=list&viewer=A&scope=mine&criterion=score&status=503");
  await control(page.request, "emit");
  await expect(page.getByRole("table", { name: "System leaderboard rankings" })).toContainText("system-one-score-r2");
  await expect(page.getByRole("status", { name: "My Strategies is stale" })).toBeVisible();
  await expect(page.getByRole("table", { name: "My strategies rankings" })).toContainText("A-low-score-r1");
  await page.getByRole("button", { name: "Retry My Strategies" }).click();
  await expect(page.getByRole("table", { name: "My strategies rankings" })).toContainText("A-low-score-r2");
});

test("one safe invalidation/reconnect reconciles exact scoped keys; OFF freezes without disconnect commands", async ({ page }) => {
  await installSupabaseAuthFixture(page);
  await signIn(page, "A");
  let live = page.getByRole("switch", { name: "Live updates" });
  await live.click();
  await expect(live).toHaveAttribute("aria-checked", "true");
  await page.goto("/leaderboard");
  await expect(page.getByRole("table", { name: "System leaderboard rankings" })).toContainText("system-one-score-r1");
  await expect(page.getByRole("table", { name: "My strategies rankings" })).toContainText("A-low-score-r1");
  await expect.poll(async () => (await fixtureState(page.request)).activeConnections).toBe(1);
  await control(page.request, "clear");
  await control(page.request, "revision?value=2");
  await control(page.request, "emit");
  await expect(page.getByRole("table", { name: "System leaderboard rankings" })).toContainText("system-one-score-r2");
  await expect(page.getByRole("table", { name: "My strategies rankings" })).toContainText("A-low-score-r2");
  await expect.poll(async () => listRequests(await fixtureState(page.request)).length).toBe(3);
  const invalidationRequests = listRequests(await fixtureState(page.request));
  expect(invalidationRequests.map(({ scope }) => scope).sort()).toEqual(["combined", "mine", "system"]);
  expect(new Set(invalidationRequests.map(({ scope }) => scope)).size).toBe(3);
  await expect(page.getByText(/event-decoy/)).toHaveCount(0);
  let envelope = await cacheEnvelope(page);
  expect(envelope.version).toBe(2);
  expect(envelope.viewerKey).toBe(userAId);
  expect(Object.keys(envelope.snapshots ?? {}).sort()).toEqual(["combined:score", "mine:score", "system:score"]);
  expect(JSON.stringify(envelope)).not.toContain("event-decoy");

  await control(page.request, "clear");
  const beforeReconnect = await fixtureState(page.request);
  await control(page.request, "close-transport");
  await expect.poll(async () => (await fixtureState(page.request)).connections).toBeGreaterThan(beforeReconnect.connections);
  await expect.poll(async () => listRequests(await fixtureState(page.request)).length).toBe(3);
  expect(listRequests(await fixtureState(page.request)).map(({ scope }) => scope).sort()).toEqual(["combined", "mine", "system"]);
  expect((await fixtureState(page.request)).activeConnections).toBe(1);

  await page.getByRole("link", { name: "Dashboard" }).click();
  live = page.getByRole("switch", { name: "Live updates" });
  await live.click();
  await expect(live).toHaveAttribute("aria-checked", "false");
  await control(page.request, "clear");
  await page.getByRole("link", { name: "View full leaderboard" }).click();
  await expect.poll(async () => listRequests(await fixtureState(page.request)).filter(({ scope, status }) => (scope === "system" || scope === "mine") && status === 200).length).toBe(2);
  await control(page.request, "clear");
  const beforeOffReconnect = await fixtureState(page.request);
  await control(page.request, "close-transport");
  await expect.poll(async () => (await fixtureState(page.request)).connections).toBeGreaterThan(beforeOffReconnect.connections);
  await page.waitForTimeout(400);
  expect(listRequests(await fixtureState(page.request))).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("crypto-strategy-lab:leaderboard-live"))).toBe("false");

  const beforeRoutes = await fixtureState(page.request);
  await page.getByRole("link", { name: "News Feed" }).click();
  await page.getByRole("link", { name: "Leaderboard" }).click();
  expect((await fixtureState(page.request)).disconnects).toBe(beforeRoutes.disconnects);
  expect((await fixtureState(page.request)).loopCommands).toEqual([]);
  envelope = await cacheEnvelope(page);
  expect(envelope.viewerKey).toBe(userAId);
});

test("A to B rejects delayed A Mine list/detail and replaces the exact-viewer cache before render", async ({ page }) => {
  await installSupabaseAuthFixture(page);
  await signIn(page, "A");
  const live = page.getByRole("switch", { name: "Live updates" });
  await live.click();
  await expect(live).toHaveAttribute("aria-checked", "true");
  await page.goto("/leaderboard");
  await control(page.request, "delay-next?id=a-list&kind=list&viewer=A&scope=mine&criterion=score");
  await control(page.request, `delay-next?id=a-detail&kind=detail&viewer=A&scope=mine&strategyVersionId=${userALowId}`);
  await control(page.request, "emit");
  await page.getByRole("table", { name: "My strategies rankings" }).getByRole("button", { name: /Select A-low-score-r1/ }).click();
  await expect.poll(async () => (await fixtureState(page.request)).pendingDelayIds.sort()).toEqual(["a-detail", "a-list"]);

  const userBPage = await page.context().newPage();
  await installSupabaseAuthFixture(userBPage);
  await page.context().clearCookies();
  await signIn(userBPage, "B");
  await expect(page.getByRole("table", { name: "My strategies rankings" })).toContainText("B-low-score-r1");
  await expect(page.getByText(/A-low|A-second/)).toHaveCount(0);
  await control(page.request, "release?id=a-list");
  await control(page.request, "release?id=a-detail");
  await page.waitForTimeout(150);
  await expect(page.getByText(/A-low|A-second/)).toHaveCount(0);
  const envelope = await cacheEnvelope(page);
  expect(envelope.viewerKey).toBe(userBId);
  expect(JSON.stringify(envelope)).not.toMatch(/A-low|A-second|11111111-1111-4111-8111-111111111111/);
  expect(await page.evaluate(() => localStorage.getItem("crypto-strategy-lab:leaderboard-live"))).toBe("true");
  await userBPage.close();
});

test("A to anonymous rejects delayed A Mine list/detail while preserving Live preference", async ({ page }) => {
  await installSupabaseAuthFixture(page);
  await signIn(page, "A");
  const live = page.getByRole("switch", { name: "Live updates" });
  await live.click();
  await expect(live).toHaveAttribute("aria-checked", "true");
  await page.goto("/leaderboard");
  await control(page.request, "delay-next?id=anon-a-list&kind=list&viewer=A&scope=mine&criterion=score");
  await control(page.request, `delay-next?id=anon-a-detail&kind=detail&viewer=A&scope=mine&strategyVersionId=${userALowId}`);
  await control(page.request, "emit");
  await page.getByRole("table", { name: "My strategies rankings" }).getByRole("button", { name: /Select A-low-score-r1/ }).click();
  await expect.poll(async () => (await fixtureState(page.request)).pendingDelayIds.sort()).toEqual(["anon-a-detail", "anon-a-list"]);

  const broadcaster = await page.context().newPage();
  await broadcaster.goto("/login");
  await signOutThroughBroadcast(page.context(), broadcaster);
  await expect(page.getByRole("region", { name: "My Strategies" }).getByText("Sign in to view your strategies.")).toBeVisible();
  await expect(page.getByText(/A-low|A-second/)).toHaveCount(0);
  await control(page.request, "release?id=anon-a-list");
  await control(page.request, "release?id=anon-a-detail");
  await page.waitForTimeout(150);
  await expect(page.getByText(/A-low|A-second/)).toHaveCount(0);
  const envelope = await cacheEnvelope(page);
  expect(envelope.viewerKey).toBe("anonymous");
  expect(Object.keys(envelope.snapshots ?? {}).sort()).toEqual(["combined:score", "system:score"]);
  expect(JSON.stringify(envelope)).not.toMatch(/A-low|A-second|11111111-1111-4111-8111-111111111111/);
  expect(await page.evaluate(() => localStorage.getItem("crypto-strategy-lab:leaderboard-live"))).toBe("true");
  await broadcaster.close();
});

test("desktop stacks both wide tables; mobile source order is System then Mine then Detail with two scrollers", async ({ page }) => {
  await installSupabaseAuthFixture(page);
  await signIn(page, "A");
  await page.goto("/leaderboard");
  const systemHeading = page.getByRole("heading", { name: "System Leaderboard" });
  const mineHeading = page.getByRole("heading", { name: "My Strategies" });
  const emptyDetail = page.getByRole("complementary").filter({ hasText: /Select a strategy to inspect/ });
  const [systemBox, mineBox, detailBox] = await Promise.all([systemHeading.locator("xpath=ancestor::section").boundingBox(), mineHeading.locator("xpath=ancestor::section").boundingBox(), emptyDetail.boundingBox()]);
  expect(systemBox).not.toBeNull();
  expect(mineBox).not.toBeNull();
  expect(detailBox).not.toBeNull();
  expect(mineBox!.y).toBeGreaterThan(systemBox!.y + systemBox!.height);
  expect(Math.abs(mineBox!.x - systemBox!.x)).toBeLessThan(4);
  expect(detailBox!.x).toBeGreaterThan(systemBox!.x + systemBox!.width);

  await page.setViewportSize({ width: 390, height: 844 });
  const systemScroll = page.getByRole("region", { name: "Scroll System leaderboard rankings" });
  const mineScroll = page.getByRole("region", { name: "Scroll My strategies rankings" });
  await expect(systemScroll).toBeVisible();
  await expect(mineScroll).toBeVisible();
  for (const scroll of [systemScroll, mineScroll]) {
    expect(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  }
  const order = await page.locator("body").evaluate(() => {
    const system = document.getElementById("system-leaderboard-heading");
    const mine = document.getElementById("mine-strategies-heading");
    const detail = [...document.querySelectorAll("aside")].find((node) => node.textContent?.includes("Select a strategy"));
    return Boolean(system && mine && detail && (system.compareDocumentPosition(mine) & Node.DOCUMENT_POSITION_FOLLOWING) && (mine.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(order).toBe(true);
  expect((await fixtureState(page.request)).loopCommands).toEqual([]);
});
