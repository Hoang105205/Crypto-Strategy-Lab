import { createServer } from "node:http";
import { Server } from "socket.io";

const port = 3201;
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const IDS = {
  systemOne: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  systemTwo: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
  systemThree: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
  aLow: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  aSecond: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6",
  bLow: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  eventDecoy: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
};
const TOP_K = 3;

const state = {
  revision: 1,
  sequence: 0,
  requests: [],
  loopCommands: [],
  connections: 0,
  activeConnections: 0,
  disconnects: 0,
  delayRules: [],
  pendingDelays: new Map(),
  failureRules: [],
};

const corsHeaders = {
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json",
};

const httpServer = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (request.method === "OPTIONS") return empty(response, 204);
  if (url.pathname === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
    return;
  }

  if (url.pathname.startsWith("/__test__/")) {
    await handleControl(url, response);
    return;
  }

  const viewer = viewerFromAuthorization(request.headers.authorization);
  if (url.pathname === "/api/leaderboard") {
    const criterion = url.searchParams.get("sortBy") ?? "score";
    const scope = normalizeScope(url.searchParams.get("scope"));
    const capturedRevision = state.revision;
    const log = logRequest({ kind: "list", path: url.pathname, criterion, scope, viewer, revision: capturedRevision });
    await applyDelay({ kind: "list", viewer, scope, criterion, strategyVersionId: null });
    const failure = consumeFailure({ kind: "list", viewer, scope, criterion, strategyVersionId: null });
    if (failure) {
      log.status = failure.status;
      if (!response.destroyed) json(response, { error: "Fixture projection unavailable", code: "FIXTURE_UNAVAILABLE" }, failure.status);
      return;
    }
    log.status = 200;
    if (!response.destroyed) json(response, snapshot(viewer, scope, criterion, capturedRevision));
    return;
  }

  if (url.pathname.startsWith("/api/leaderboard/")) {
    const strategyVersionId = url.pathname.slice("/api/leaderboard/".length);
    const scope = normalizeScope(url.searchParams.get("scope"));
    const capturedRevision = state.revision;
    const log = logRequest({ kind: "detail", path: url.pathname, criterion: null, scope, viewer, revision: capturedRevision });
    await applyDelay({ kind: "detail", viewer, scope, criterion: null, strategyVersionId });
    const failure = consumeFailure({ kind: "detail", viewer, scope, criterion: null, strategyVersionId });
    if (failure) {
      log.status = failure.status;
      if (!response.destroyed) json(response, { error: "Fixture detail unavailable", code: "FIXTURE_UNAVAILABLE" }, failure.status);
      return;
    }
    const visible = visibleEntries(viewer, scope, "score", capturedRevision).find(
      (candidate) => candidate.strategyVersionId === strategyVersionId,
    );
    if (!visible) {
      log.status = 404;
      if (!response.destroyed) json(response, notFound(), 404);
      return;
    }
    log.status = 200;
    if (!response.destroyed) json(response, detail(visible, capturedRevision));
    return;
  }

  if (url.pathname === "/api/dashboard/summary") {
    const capturedRevision = state.revision;
    logRequest({ kind: "dashboard", path: url.pathname, criterion: "score", scope: "combined", viewer, revision: capturedRevision, status: 200 });
    json(response, {
      leaderboard: snapshot(viewer, "combined", "score", capturedRevision),
      loop: globalLoop(),
      queue: { waiting: 1, active: 1, delayed: 0, failed: 0, completed: 7, deadLetter: 0 },
      generatedAt: projectionUpdatedAt("combined", viewer, capturedRevision),
    });
    return;
  }
  if (url.pathname === "/api/loop/current") {
    logRequest({ kind: "loop-read", path: url.pathname, criterion: null, scope: null, viewer, revision: state.revision, status: 200 });
    json(response, globalLoop());
    return;
  }
  if (url.pathname.startsWith("/api/loop/") && request.method === "POST") {
    state.loopCommands.push(url.pathname);
    json(response, { loopRunId: globalLoop().id, status: "RUNNING" });
    return;
  }
  if (url.pathname === "/api/market-data/pairs") {
    json(response, [{ symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", isActive: true }]);
    return;
  }
  if (url.pathname === "/api/market-data/candles" || url.pathname === "/api/market-data/subscriptions") {
    json(response, []);
    return;
  }
  if (url.pathname === "/api/news") {
    json(response, { items: [], total: 0, limit: 20, offset: 0 });
    return;
  }
  json(response, { error: "not found" }, 404);
});

const io = new Server(httpServer, { cors: { origin: "*" }, transports: ["websocket"] });
io.of("/infrastructure").on("connection", (socket) => {
  state.connections += 1;
  state.activeConnections += 1;
  socket.on("disconnect", () => {
    state.disconnects += 1;
    state.activeConnections -= 1;
  });
});
httpServer.listen(port, "127.0.0.1");

async function handleControl(url, response) {
  const action = url.pathname.slice("/__test__/".length);
  if (action === "reset") {
    releaseAllDelays();
    state.revision = 1;
    state.sequence = 0;
    state.requests = [];
    state.loopCommands = [];
    state.delayRules = [];
    state.failureRules = [];
  } else if (action === "clear") {
    state.requests = [];
    state.loopCommands = [];
  } else if (action === "revision") {
    state.revision = Number(url.searchParams.get("value") ?? state.revision);
  } else if (action === "delay-next") {
    state.delayRules.push(ruleFrom(url, { id: url.searchParams.get("id") ?? `delay-${state.sequence + 1}` }));
  } else if (action === "fail-next") {
    state.failureRules.push(ruleFrom(url, { status: Number(url.searchParams.get("status") ?? 503) }));
  } else if (action === "release") {
    const id = url.searchParams.get("id") ?? "pending";
    state.pendingDelays.get(id)?.();
    state.pendingDelays.delete(id);
  } else if (action === "emit") {
    io.of("/infrastructure").emit("leaderboard:update", safeInvalidation());
  } else if (action === "close-transport") {
    for (const socket of io.of("/infrastructure").sockets.values()) socket.conn.close();
  } else if (action !== "state") {
    json(response, { error: "unknown control" }, 404);
    return;
  }
  json(response, publicState());
}

function ruleFrom(url, extra) {
  return {
    kind: url.searchParams.get("kind") ?? "list",
    viewer: url.searchParams.get("viewer") ?? "anonymous",
    scope: normalizeScope(url.searchParams.get("scope")),
    criterion: url.searchParams.get("criterion"),
    strategyVersionId: url.searchParams.get("strategyVersionId"),
    ...extra,
  };
}

function matchesRule(rule, request) {
  return rule.kind === request.kind && rule.viewer === request.viewer && rule.scope === request.scope &&
    (rule.criterion === null || rule.criterion === request.criterion) &&
    (rule.strategyVersionId === null || rule.strategyVersionId === request.strategyVersionId);
}

async function applyDelay(request) {
  const index = state.delayRules.findIndex((rule) => matchesRule(rule, request));
  if (index < 0) return;
  const [rule] = state.delayRules.splice(index, 1);
  await new Promise((resolve) => state.pendingDelays.set(rule.id, resolve));
  state.pendingDelays.delete(rule.id);
}

function consumeFailure(request) {
  const index = state.failureRules.findIndex((rule) => matchesRule(rule, request));
  if (index < 0) return null;
  return state.failureRules.splice(index, 1)[0];
}

function releaseAllDelays() {
  for (const resolve of state.pendingDelays.values()) resolve();
  state.pendingDelays.clear();
}

function publicState() {
  return {
    revision: state.revision,
    requests: state.requests,
    loopCommands: state.loopCommands,
    connections: state.connections,
    activeConnections: state.activeConnections,
    disconnects: state.disconnects,
    pendingDelayIds: [...state.pendingDelays.keys()],
    pendingFailureCount: state.failureRules.length,
  };
}

function logRequest(value) {
  const record = { sequence: ++state.sequence, status: null, ...value };
  state.requests.push(record);
  return record;
}

function snapshot(viewer, scope, criterion, revision) {
  const entries = visibleEntries(viewer, scope, criterion, revision).slice(0, TOP_K).map((value, index) => ({ ...value, rank: index + 1 }));
  return { rankingCriterion: criterion, updatedAt: projectionUpdatedAt(scope, viewer, revision), entries };
}

function visibleEntries(viewer, scope, criterion, revision) {
  if (scope === "mine" && viewer === "anonymous") return [];
  const system = [
    entry("system-one", null, IDS.systemOne, criterion, revision, 0.99),
    entry("system-two", null, IDS.systemTwo, criterion, revision, 0.98),
    entry("system-three", null, IDS.systemThree, criterion, revision, 0.97),
  ];
  const mine = viewer === "A"
    ? [entry("A-low", USER_A, IDS.aLow, criterion, revision, 0.2), entry("A-second", USER_A, IDS.aSecond, criterion, revision, 0.1)]
    : viewer === "B"
      ? [entry("B-low", USER_B, IDS.bLow, criterion, revision, 0.3)]
      : [];
  const visible = scope === "system" ? system : scope === "mine" ? mine : [...system, ...mine];
  return visible.sort((left, right) => metric(right, criterion) - metric(left, criterion));
}

function metric(value, criterion) {
  if (criterion === "totalReturn") return value.totalReturn;
  if (criterion === "winRate") return value.winRate;
  if (criterion === "maxDrawdown") return value.maxDrawdown;
  if (criterion === "sharpeRatio") return value.sharpeRatio;
  return value.score;
}

function entry(owner, userId, strategyVersionId, criterion, revision, score) {
  const offset = {
    "system-one": 1,
    "system-two": 2,
    "system-three": 3,
    "A-low": 4,
    "A-second": 5,
    "B-low": 6,
    "event-decoy": 0,
  }[owner] ?? 9;
  return {
    rank: 0,
    userId,
    strategyVersionId,
    strategyName: `${owner}-${criterion}-r${revision}`,
    strategyType: "RSI",
    isComposite: false,
    backtestResultId: strategyVersionId.replace(/^a/, "b"),
    score,
    totalReturn: 40 - offset,
    winRate: 0.8 - offset * 0.03,
    maxDrawdown: -3 - offset,
    sharpeRatio: 3 - offset * 0.1,
    totalTrades: 20 + revision + offset,
  };
}

function detail(value, revision) {
  return {
    ...value,
    strategyVersion: {
      id: value.strategyVersionId,
      strategyType: value.strategyType,
      name: value.strategyName,
      version: 1,
      parameters: { fixture: true },
      isComposite: false,
      createdAt: "2026-08-24T00:00:00.000Z",
    },
    trades: [],
    executedAt: projectionUpdatedAt(value.userId === null ? "system" : "mine", value.userId === USER_A ? "A" : value.userId === USER_B ? "B" : "anonymous", revision),
  };
}

function projectionUpdatedAt(scope, viewer, revision) {
  if (scope === "mine" && viewer === "anonymous") return new Date(0).toISOString();
  const minute = scope === "system" ? 10 : scope === "mine" && viewer === "A" ? 20 : scope === "mine" ? 30 : 40;
  return new Date(Date.UTC(2026, 7, 24, 2, minute, revision)).toISOString();
}

function safeInvalidation() {
  return {
    updatedAt: projectionUpdatedAt("system", "anonymous", state.revision),
    triggeredByBacktestResultId: null,
    rankingCriterion: "score",
    topK: [{ ...entry("event-decoy", null, IDS.eventDecoy, "score", state.revision, 99), rank: 1 }],
  };
}

function notFound() {
  return { error: "Leaderboard entry not found", code: "LEADERBOARD_ENTRY_NOT_FOUND" };
}

function normalizeScope(scope) {
  return scope === "system" || scope === "mine" ? scope : "combined";
}

function viewerFromAuthorization(authorization) {
  if (!authorization?.startsWith("Bearer ")) return "anonymous";
  try {
    const payload = authorization.slice("Bearer ".length).split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (decoded.sub === USER_A) return "A";
    if (decoded.sub === USER_B) return "B";
  } catch {
    // Invalid fixture tokens have anonymous scope.
  }
  return "anonymous";
}

function globalLoop() {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", status: "RUNNING", generatorType: "DOMAIN_GUIDED",
    iteration: 7, testedCandidates: 7, maxCandidates: 100, maxDurationMs: null,
    stopOnNoImprovementIterations: 50, currentCandidateStrategyVersionId: IDS.systemOne,
    bestStrategyVersionId: IDS.systemOne, bestScore: 0.99, stopReason: null,
    startedAt: "2026-08-24T00:00:00.000Z", pausedAt: null, stoppedAt: null,
  };
}

function json(response, body, status = 200) {
  response.writeHead(status, corsHeaders);
  response.end(JSON.stringify(body));
}

function empty(response, status) {
  response.writeHead(status, corsHeaders);
  response.end();
}
