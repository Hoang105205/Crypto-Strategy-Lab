"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  LeaderboardScope,
  RankingCriterion,
  type LeaderboardSnapshot,
} from "@crypto-strategy-lab/shared";
import { useInfrastructure } from "../components/common/infrastructure-provider";
import { useLeaderboardLivePreference } from "../hooks/use-leaderboard-live-preference";
import { apiClient } from "../services/api-client";
import { useAuth } from "./auth-context";

export const LEADERBOARD_CACHE_STORAGE_KEY =
  "crypto-strategy-lab:leaderboard-cache:v2";
const LEGACY_CACHE_STORAGE_KEY = "crypto-strategy-lab:leaderboard-cache:v1";
const ANONYMOUS_VIEWER_KEY = "anonymous";
const CACHE_VERSION = 2;

type ViewerKey = string | null;
type ProjectionKey = `${LeaderboardScope}:${RankingCriterion}`;

interface AcceptedSnapshot {
  viewerKey: string;
  identityGeneration: number;
  requestGeneration: number;
  acceptedAt: Date;
  snapshot: LeaderboardSnapshot;
}

interface ProjectionRecord {
  accepted?: AcceptedSnapshot;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  lastSuccessfulAt: Date | null;
}

type ProjectionMap = Partial<Record<ProjectionKey, ProjectionRecord>>;

interface SerializedSnapshot {
  rankingCriterion: RankingCriterion;
  updatedAt: string;
  entries: LeaderboardSnapshot["entries"];
}

interface PersistedCacheEnvelopeV2 {
  version: 2;
  viewerKey: string;
  activeCriterion: RankingCriterion;
  selectedStrategy: SelectedLeaderboardStrategy | null;
  snapshots: Partial<Record<ProjectionKey, SerializedSnapshot>>;
  persistedAt: string;
}

interface InFlightRequest {
  generation: number;
  controller: AbortController;
  promise: Promise<void>;
}

export interface ProjectionViewState {
  snapshot: LeaderboardSnapshot | null;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  lastSuccessfulAt: Date | null;
  refetch(): Promise<void>;
}

export interface SelectedLeaderboardStrategy {
  strategyVersionId: string;
  sourceScope: LeaderboardScope;
}

export interface LeaderboardLiveContextValue {
  isLive: boolean;
  setIsLive(value: boolean): void;
  activeCriterion: RankingCriterion;
  setActiveCriterion(value: RankingCriterion): Promise<void>;
  combinedScore: ProjectionViewState;
  system: ProjectionViewState;
  mine: ProjectionViewState;
  selectedStrategy: SelectedLeaderboardStrategy | null;
  setSelectedStrategy(value: SelectedLeaderboardStrategy | null): void;
  maintainScopedProjections(): void;

  // Transitional aliases keep the existing Dashboard adapter compatible until T024.
  scoreSnapshot: LeaderboardSnapshot | null;
  activeSnapshot: LeaderboardSnapshot | null;
  selectedStrategyVersionId: string | null;
  setSelectedStrategyVersionId(value: string | null): void;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  lastSuccessfulAt: Date | null;
  refetch(criterion?: RankingCriterion): Promise<void>;
}

const LeaderboardLiveContext = createContext<
  LeaderboardLiveContextValue | undefined
>(undefined);
const CRITERIA = new Set<RankingCriterion>(Object.values(RankingCriterion));
const SCOPES = new Set<LeaderboardScope>(Object.values(LeaderboardScope));

function isCriterion(value: unknown): value is RankingCriterion {
  return typeof value === "string" && CRITERIA.has(value as RankingCriterion);
}

function isScope(value: unknown): value is LeaderboardScope {
  return typeof value === "string" && SCOPES.has(value as LeaderboardScope);
}

function isSelection(value: unknown): value is SelectedLeaderboardStrategy {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<SelectedLeaderboardStrategy>;
  return (
    typeof candidate.strategyVersionId === "string" &&
    isScope(candidate.sourceScope)
  );
}

function projectionKey(
  scope: LeaderboardScope,
  criterion: RankingCriterion,
): ProjectionKey {
  return `${scope}:${criterion}`;
}

function parseProjectionKey(
  value: string,
): { scope: LeaderboardScope; criterion: RankingCriterion } | null {
  const separator = value.indexOf(":");
  if (separator < 0) return null;
  const scope = value.slice(0, separator);
  const criterion = value.slice(separator + 1);
  return isScope(scope) && isCriterion(criterion)
    ? { scope, criterion }
    : null;
}

function emptyRecord(isStale = true): ProjectionRecord {
  return {
    loading: false,
    error: null,
    isStale,
    lastSuccessfulAt: null,
  };
}

function errorFrom(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

function parseSnapshot(value: unknown): LeaderboardSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Partial<SerializedSnapshot>;
  if (
    !isCriterion(raw.rankingCriterion) ||
    typeof raw.updatedAt !== "string" ||
    !Array.isArray(raw.entries)
  ) {
    return null;
  }
  const updatedAt = new Date(raw.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) return null;
  return {
    rankingCriterion: raw.rankingCriterion,
    updatedAt,
    entries: raw.entries,
  };
}

function snapshotMatchesViewer(
  snapshot: LeaderboardSnapshot,
  scope: LeaderboardScope,
  viewerKey: string,
): boolean {
  return snapshot.entries.every(({ userId }) => {
    switch (scope) {
      case LeaderboardScope.SYSTEM:
        return userId === null;
      case LeaderboardScope.MINE:
        return viewerKey !== ANONYMOUS_VIEWER_KEY && userId === viewerKey;
      case LeaderboardScope.COMBINED:
        return (
          userId === null ||
          (viewerKey !== ANONYMOUS_VIEWER_KEY && userId === viewerKey)
        );
      default:
        return false;
    }
  });
}

function readEnvelope(viewerKey: string): PersistedCacheEnvelopeV2 | null {
  try {
    const serialized = window.localStorage.getItem(
      LEADERBOARD_CACHE_STORAGE_KEY,
    );
    if (serialized === null) return null;
    const raw = JSON.parse(serialized) as Partial<PersistedCacheEnvelopeV2>;
    const persistedAt = new Date(raw.persistedAt ?? "");
    if (
      raw.version !== CACHE_VERSION ||
      raw.viewerKey !== viewerKey ||
      !isCriterion(raw.activeCriterion) ||
      (raw.selectedStrategy !== null &&
        raw.selectedStrategy !== undefined &&
        !isSelection(raw.selectedStrategy)) ||
      typeof raw.snapshots !== "object" ||
      raw.snapshots === null ||
      typeof raw.persistedAt !== "string" ||
      Number.isNaN(persistedAt.getTime())
    ) {
      return null;
    }
    const snapshots: PersistedCacheEnvelopeV2["snapshots"] = {};
    for (const [key, value] of Object.entries(raw.snapshots)) {
      const parsedKey = parseProjectionKey(key);
      const parsedSnapshot = parseSnapshot(value);
      if (
        parsedKey === null ||
        parsedSnapshot === null ||
        !snapshotMatchesViewer(parsedSnapshot, parsedKey.scope, viewerKey) ||
        parsedSnapshot.rankingCriterion !== parsedKey.criterion ||
        (parsedKey.scope === LeaderboardScope.COMBINED &&
          parsedKey.criterion !== RankingCriterion.SCORE) ||
        (parsedKey.scope !== LeaderboardScope.COMBINED &&
          parsedKey.criterion !== raw.activeCriterion)
      ) {
        return null;
      }
      snapshots[key as ProjectionKey] = {
        ...parsedSnapshot,
        updatedAt: parsedSnapshot.updatedAt.toISOString(),
      };
    }
    return {
      version: CACHE_VERSION,
      viewerKey,
      activeCriterion: raw.activeCriterion,
      selectedStrategy: raw.selectedStrategy ?? null,
      snapshots,
      persistedAt: raw.persistedAt,
    };
  } catch {
    return null;
  }
}

function removePersistedCaches(): void {
  try {
    window.localStorage.removeItem(LEADERBOARD_CACHE_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_CACHE_STORAGE_KEY);
  } catch {
    // Storage failure falls back to exact-viewer in-memory eligibility.
  }
}

function retainedProjections(
  projections: ProjectionMap,
  activeCriterion: RankingCriterion,
): ProjectionMap {
  const retained: ProjectionMap = {};
  const combinedKey = projectionKey(
    LeaderboardScope.COMBINED,
    RankingCriterion.SCORE,
  );
  if (projections[combinedKey] !== undefined) {
    retained[combinedKey] = projections[combinedKey];
  }
  for (const scope of [LeaderboardScope.SYSTEM, LeaderboardScope.MINE]) {
    const key = projectionKey(scope, activeCriterion);
    if (projections[key] !== undefined) retained[key] = projections[key];
  }
  return retained;
}

export function LeaderboardLiveProvider({ children }: { children: ReactNode }) {
  const { loading: authLoading, user } = useAuth();
  const { socket, status } = useInfrastructure();
  const { isLeaderboardLive: isLive, setIsLeaderboardLive: setIsLive } =
    useLeaderboardLivePreference();
  const viewerKey: ViewerKey = authLoading
    ? null
    : (user?.id ?? ANONYMOUS_VIEWER_KEY);

  const [projections, setProjections] = useState<ProjectionMap>({});
  const [activeCriterion, setActiveCriterionState] = useState<RankingCriterion>(
    RankingCriterion.SCORE,
  );
  const [selectedStrategyState, setSelectedStrategyState] =
    useState<SelectedLeaderboardStrategy | null>(null);
  const [scopedMaintained, setScopedMaintained] = useState(false);

  const mountedRef = useRef(false);
  const activeViewerRef = useRef<ViewerKey>(null);
  const currentViewerRef = useRef<ViewerKey>(viewerKey);
  const identityGenerationRef = useRef(0);
  const requestGenerationsRef = useRef(new Map<ProjectionKey, number>());
  const controllersRef = useRef(new Map<ProjectionKey, InFlightRequest>());
  const watermarksRef = useRef(new Map<ProjectionKey, number>());
  const projectionsRef = useRef<ProjectionMap>({});
  const activeCriterionRef = useRef(activeCriterion);
  const selectedStrategyRef =
    useRef<SelectedLeaderboardStrategy | null>(null);
  const scopedMaintainedRef = useRef(false);
  const isLiveRef = useRef(isLive);
  const reconcileMaintainedRef = useRef<(force: boolean) => Promise<void>>(
    async () => undefined,
  );
  const fetchProjectionRef = useRef<
    (
      scope: LeaderboardScope,
      criterion: RankingCriterion,
      force?: boolean,
    ) => Promise<void>
  >(async () => undefined);
  const previousStatusRef = useRef(status);

  const commitProjections = useCallback((next: ProjectionMap) => {
    projectionsRef.current = next;
    setProjections(next);
  }, []);

  const persistProjections = useCallback((next: ProjectionMap) => {
    const currentViewer = activeViewerRef.current;
    if (currentViewer === null) return;
    const retained = retainedProjections(next, activeCriterionRef.current);
    const serialized: PersistedCacheEnvelopeV2["snapshots"] = {};
    for (const [key, record] of Object.entries(retained)) {
      if (record?.accepted === undefined) continue;
      serialized[key as ProjectionKey] = {
        ...record.accepted.snapshot,
        updatedAt: record.accepted.snapshot.updatedAt.toISOString(),
      };
    }
    const envelope: PersistedCacheEnvelopeV2 = {
      version: CACHE_VERSION,
      viewerKey: currentViewer,
      activeCriterion: activeCriterionRef.current,
      selectedStrategy: selectedStrategyRef.current,
      snapshots: serialized,
      persistedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(
        LEADERBOARD_CACHE_STORAGE_KEY,
        JSON.stringify(envelope),
      );
      window.localStorage.removeItem(LEGACY_CACHE_STORAGE_KEY);
    } catch {
      // A current viewer can continue with memory-only state.
    }
  }, []);

  const isMaintained = useCallback(
    (scope: LeaderboardScope, criterion: RankingCriterion): boolean => {
      if (scope === LeaderboardScope.COMBINED) {
        return criterion === RankingCriterion.SCORE;
      }
      if (!scopedMaintainedRef.current) return false;
      if (criterion !== activeCriterionRef.current) return false;
      return !(
        scope === LeaderboardScope.MINE &&
        activeViewerRef.current === ANONYMOUS_VIEWER_KEY
      );
    },
    [],
  );

  const clearSelection = useCallback(() => {
    selectedStrategyRef.current = null;
    setSelectedStrategyState(null);
  }, []);

  const fetchProjection = useCallback(
    (
      scope: LeaderboardScope,
      criterion: RankingCriterion,
      force = false,
    ): Promise<void> => {
      const capturedViewerKey = activeViewerRef.current;
      if (capturedViewerKey === null) return Promise.resolve();
      if (
        scope === LeaderboardScope.MINE &&
        capturedViewerKey === ANONYMOUS_VIEWER_KEY
      ) {
        return Promise.resolve();
      }
      const key = projectionKey(scope, criterion);
      const existing = controllersRef.current.get(key);
      if (!force && existing !== undefined) return existing.promise;
      if (force) existing?.controller.abort();

      const capturedIdentityGeneration = identityGenerationRef.current;
      const requestGeneration =
        (requestGenerationsRef.current.get(key) ?? 0) + 1;
      requestGenerationsRef.current.set(key, requestGeneration);
      const controller = new AbortController();
      const previous = projectionsRef.current[key] ?? emptyRecord();
      commitProjections({
        ...projectionsRef.current,
        [key]: { ...previous, loading: true, error: null },
      });

      const promise = (async () => {
        try {
          const snapshot = await apiClient.getLeaderboard({
            sortBy: criterion,
            scope,
            signal: controller.signal,
          });
          if (!snapshotMatchesViewer(snapshot, scope, capturedViewerKey)) {
            throw new Error("Leaderboard response contains entries outside the requested scope");
          }
          const eligible =
            mountedRef.current &&
            !controller.signal.aborted &&
            currentViewerRef.current === capturedViewerKey &&
            activeViewerRef.current === capturedViewerKey &&
            identityGenerationRef.current === capturedIdentityGeneration &&
            requestGenerationsRef.current.get(key) === requestGeneration &&
            isMaintained(scope, criterion);
          if (!eligible) return;
          const watermark =
            watermarksRef.current.get(key) ?? Number.NEGATIVE_INFINITY;
          // An empty projection uses the Unix epoch as its contract sentinel.
          // It is still an authoritative deletion result and must clear a newer
          // cached snapshot. Request generations already reject superseded reads.
          if (
            snapshot.entries.length > 0 &&
            snapshot.updatedAt.getTime() < watermark
          ) {
            return;
          }
          watermarksRef.current.set(key, snapshot.updatedAt.getTime());
          const acceptedAt = new Date();
          const accepted: AcceptedSnapshot = {
            viewerKey: capturedViewerKey,
            identityGeneration: capturedIdentityGeneration,
            requestGeneration,
            acceptedAt,
            snapshot,
          };
          const next = retainedProjections(
            {
              ...projectionsRef.current,
              [key]: {
                accepted,
                loading: false,
                error: null,
                isStale: false,
                lastSuccessfulAt: acceptedAt,
              },
            },
            activeCriterionRef.current,
          );
          commitProjections(next);
          const selected = selectedStrategyRef.current;
          if (
            selected?.sourceScope === scope &&
            criterion === activeCriterionRef.current &&
            !snapshot.entries.some(
              (entry) => entry.strategyVersionId === selected.strategyVersionId,
            )
          ) {
            clearSelection();
          }
          persistProjections(next);
        } catch (reason) {
          const eligible =
            mountedRef.current &&
            !controller.signal.aborted &&
            currentViewerRef.current === capturedViewerKey &&
            activeViewerRef.current === capturedViewerKey &&
            identityGenerationRef.current === capturedIdentityGeneration &&
            requestGenerationsRef.current.get(key) === requestGeneration;
          if (!eligible) return;
          const current = projectionsRef.current[key] ?? emptyRecord();
          commitProjections({
            ...projectionsRef.current,
            [key]: {
              ...current,
              loading: false,
              error: errorFrom(reason),
              isStale: current.accepted !== undefined,
            },
          });
        } finally {
          const active = controllersRef.current.get(key);
          if (active?.generation === requestGeneration) {
            controllersRef.current.delete(key);
            const current = projectionsRef.current[key];
            if (current?.loading) {
              commitProjections({
                ...projectionsRef.current,
                [key]: { ...current, loading: false },
              });
            }
          }
        }
      })();
      controllersRef.current.set(key, {
        generation: requestGeneration,
        controller,
        promise,
      });
      return promise;
    },
    [clearSelection, commitProjections, isMaintained, persistProjections],
  );

  const reconcileMaintained = useCallback(
    async (force: boolean) => {
      const requests: Promise<void>[] = [
        fetchProjection(
          LeaderboardScope.COMBINED,
          RankingCriterion.SCORE,
          force,
        ),
      ];
      if (scopedMaintainedRef.current) {
        requests.push(
          fetchProjection(
            LeaderboardScope.SYSTEM,
            activeCriterionRef.current,
            force,
          ),
        );
        if (activeViewerRef.current !== ANONYMOUS_VIEWER_KEY) {
          requests.push(
            fetchProjection(
              LeaderboardScope.MINE,
              activeCriterionRef.current,
              force,
            ),
          );
        }
      }
      await Promise.all(requests);
    },
    [fetchProjection],
  );

  useLayoutEffect(() => {
    currentViewerRef.current = viewerKey;
    activeCriterionRef.current = activeCriterion;
    selectedStrategyRef.current = selectedStrategyState;
    scopedMaintainedRef.current = scopedMaintained;
    isLiveRef.current = isLive;
    fetchProjectionRef.current = fetchProjection;
    reconcileMaintainedRef.current = reconcileMaintained;
  }, [
    activeCriterion,
    fetchProjection,
    isLive,
    reconcileMaintained,
    scopedMaintained,
    selectedStrategyState,
    viewerKey,
  ]);

  const handleLeaderboardUpdate = useCallback(() => {
    if (!isLiveRef.current || currentViewerRef.current === null) return;
    void reconcileMaintainedRef.current(true);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- viewer state must be gated, cleared, and optionally hydrated before paint. */
  useLayoutEffect(() => {
    if (activeViewerRef.current === viewerKey) return;
    const envelope = viewerKey === null ? null : readEnvelope(viewerKey);
    identityGenerationRef.current += 1;
    controllersRef.current.forEach(({ controller }) => controller.abort());
    controllersRef.current.clear();
    requestGenerationsRef.current.clear();
    watermarksRef.current.clear();
    activeViewerRef.current = viewerKey;
    projectionsRef.current = {};
    selectedStrategyRef.current = null;
    setProjections({});
    setSelectedStrategyState(null);
    setActiveCriterionState(RankingCriterion.SCORE);
    activeCriterionRef.current = RankingCriterion.SCORE;
    if (viewerKey === null || envelope === null) {
      removePersistedCaches();
      return;
    }
    const restored: ProjectionMap = {};
    const acceptedAt = new Date(envelope.persistedAt);
    for (const [key, rawSnapshot] of Object.entries(envelope.snapshots)) {
      const parsedKey = parseProjectionKey(key);
      const parsedSnapshot = parseSnapshot(rawSnapshot);
      if (parsedKey === null || parsedSnapshot === null) continue;
      restored[key as ProjectionKey] = {
        accepted: {
          viewerKey,
          identityGeneration: identityGenerationRef.current,
          requestGeneration: 0,
          acceptedAt,
          snapshot: parsedSnapshot,
        },
        loading: false,
        error: null,
        isStale: false,
        lastSuccessfulAt: acceptedAt,
      };
      watermarksRef.current.set(
        key as ProjectionKey,
        parsedSnapshot.updatedAt.getTime(),
      );
    }
    activeCriterionRef.current = envelope.activeCriterion;
    selectedStrategyRef.current = envelope.selectedStrategy;
    projectionsRef.current = restored;
    setActiveCriterionState(envelope.activeCriterion);
    setSelectedStrategyState(envelope.selectedStrategy);
    setProjections(restored);
  }, [viewerKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const controllers = controllersRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllers.forEach(({ controller }) => controller.abort());
      controllers.clear();
    };
  }, []);

  useEffect(() => {
    if (viewerKey === null) return;
    if (isLive) {
      socket.on("leaderboard:update", handleLeaderboardUpdate);
      void reconcileMaintainedRef.current(true);
      return () => {
        socket.off("leaderboard:update", handleLeaderboardUpdate);
      };
    }
    const combinedKey = projectionKey(
      LeaderboardScope.COMBINED,
      RankingCriterion.SCORE,
    );
    if (projectionsRef.current[combinedKey]?.accepted === undefined) {
      void fetchProjectionRef.current(
        LeaderboardScope.COMBINED,
        RankingCriterion.SCORE,
      );
    }
  }, [handleLeaderboardUpdate, isLive, socket, viewerKey]);

  useEffect(() => {
    if (viewerKey === null || !scopedMaintained) return;
    const criterion = activeCriterionRef.current;
    void Promise.all([
      fetchProjectionRef.current(LeaderboardScope.SYSTEM, criterion),
      viewerKey === ANONYMOUS_VIEWER_KEY
        ? Promise.resolve()
        : fetchProjectionRef.current(LeaderboardScope.MINE, criterion),
    ]);
  }, [scopedMaintained, viewerKey]);

  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = status;
    if (
      previous !== "connected" &&
      status === "connected" &&
      isLiveRef.current &&
      currentViewerRef.current !== null
    ) {
      void reconcileMaintainedRef.current(true);
    }
  }, [status]);

  const updateIsLive = useCallback(
    (value: boolean) => {
      if (!value && isLiveRef.current) {
        for (const [key, generation] of requestGenerationsRef.current) {
          requestGenerationsRef.current.set(key, generation + 1);
        }
        controllersRef.current.forEach(({ controller }) => controller.abort());
        controllersRef.current.clear();
        const frozen: ProjectionMap = {};
        for (const [key, record] of Object.entries(projectionsRef.current)) {
          frozen[key as ProjectionKey] = { ...record, loading: false };
        }
        commitProjections(frozen);
      }
      isLiveRef.current = value;
      setIsLive(value);
    },
    [commitProjections, setIsLive],
  );

  const maintainScopedProjections = useCallback(() => {
    if (!scopedMaintainedRef.current) {
      scopedMaintainedRef.current = true;
      setScopedMaintained(true);
    }
    const criterion = activeCriterionRef.current;
    void Promise.all([
      fetchProjectionRef.current(LeaderboardScope.SYSTEM, criterion),
      activeViewerRef.current === ANONYMOUS_VIEWER_KEY
        ? Promise.resolve()
        : fetchProjectionRef.current(LeaderboardScope.MINE, criterion),
    ]);
  }, []);

  const setActiveCriterion = useCallback(
    async (criterion: RankingCriterion) => {
      if (criterion === activeCriterionRef.current) return;
      activeCriterionRef.current = criterion;
      setActiveCriterionState(criterion);
      for (const [key, request] of controllersRef.current) {
        const parsed = parseProjectionKey(key);
        if (
          parsed !== null &&
          parsed.scope !== LeaderboardScope.COMBINED &&
          parsed.criterion !== criterion
        ) {
          request.controller.abort();
          controllersRef.current.delete(key);
          requestGenerationsRef.current.set(
            key,
            (requestGenerationsRef.current.get(key) ?? 0) + 1,
          );
        }
      }
      const retained = retainedProjections(projectionsRef.current, criterion);
      commitProjections(retained);
      clearSelection();
      persistProjections(retained);
      if (!scopedMaintainedRef.current) return;
      await Promise.all([
        fetchProjectionRef.current(LeaderboardScope.SYSTEM, criterion),
        activeViewerRef.current === ANONYMOUS_VIEWER_KEY
          ? Promise.resolve()
          : fetchProjectionRef.current(LeaderboardScope.MINE, criterion),
      ]);
    },
    [clearSelection, commitProjections, persistProjections],
  );

  const setSelectedStrategy = useCallback(
    (value: SelectedLeaderboardStrategy | null) => {
      selectedStrategyRef.current = value;
      setSelectedStrategyState(value);
      persistProjections(projectionsRef.current);
    },
    [persistProjections],
  );

  const refetchCombined = useCallback(
    () =>
      fetchProjectionRef.current(
        LeaderboardScope.COMBINED,
        RankingCriterion.SCORE,
        true,
      ),
    [],
  );
  const refetchSystem = useCallback(
    () =>
      fetchProjectionRef.current(
        LeaderboardScope.SYSTEM,
        activeCriterionRef.current,
        true,
      ),
    [],
  );
  const refetchMine = useCallback(
    () =>
      fetchProjectionRef.current(
        LeaderboardScope.MINE,
        activeCriterionRef.current,
        true,
      ),
    [],
  );

  const combinedRecord =
    projections[
      projectionKey(LeaderboardScope.COMBINED, RankingCriterion.SCORE)
    ];
  const combinedAccepted =
    combinedRecord?.accepted?.viewerKey === viewerKey
      ? combinedRecord.accepted
      : undefined;
  const combinedScore = useMemo<ProjectionViewState>(
    () => ({
      snapshot:
        viewerKey === null ? null : (combinedAccepted?.snapshot ?? null),
      loading: viewerKey === null ? false : (combinedRecord?.loading ?? false),
      error: viewerKey === null ? null : (combinedRecord?.error ?? null),
      isStale:
        viewerKey !== null &&
        ((combinedRecord?.isStale ?? combinedAccepted === undefined) ||
          status !== "connected"),
      lastSuccessfulAt:
        viewerKey === null ? null : (combinedRecord?.lastSuccessfulAt ?? null),
      refetch: refetchCombined,
    }),
    [combinedAccepted, combinedRecord, refetchCombined, status, viewerKey],
  );
  const systemRecord =
    projections[projectionKey(LeaderboardScope.SYSTEM, activeCriterion)];
  const systemAccepted =
    systemRecord?.accepted?.viewerKey === viewerKey
      ? systemRecord.accepted
      : undefined;
  const system = useMemo<ProjectionViewState>(
    () => ({
      snapshot: viewerKey === null ? null : (systemAccepted?.snapshot ?? null),
      loading: viewerKey === null ? false : (systemRecord?.loading ?? false),
      error: viewerKey === null ? null : (systemRecord?.error ?? null),
      isStale:
        viewerKey !== null &&
        ((systemRecord?.isStale ?? systemAccepted === undefined) ||
          status !== "connected"),
      lastSuccessfulAt:
        viewerKey === null ? null : (systemRecord?.lastSuccessfulAt ?? null),
      refetch: refetchSystem,
    }),
    [refetchSystem, status, systemAccepted, systemRecord, viewerKey],
  );
  const mineNeutral =
    viewerKey === null || viewerKey === ANONYMOUS_VIEWER_KEY;
  const mineRecord =
    projections[projectionKey(LeaderboardScope.MINE, activeCriterion)];
  const mineAccepted =
    mineRecord?.accepted?.viewerKey === viewerKey
      ? mineRecord.accepted
      : undefined;
  const mine = useMemo<ProjectionViewState>(
    () => ({
      snapshot: mineNeutral ? null : (mineAccepted?.snapshot ?? null),
      loading: mineNeutral ? false : (mineRecord?.loading ?? false),
      error: mineNeutral ? null : (mineRecord?.error ?? null),
      isStale:
        !mineNeutral &&
        ((mineRecord?.isStale ?? mineAccepted === undefined) ||
          status !== "connected"),
      lastSuccessfulAt:
        mineNeutral ? null : (mineRecord?.lastSuccessfulAt ?? null),
      refetch: refetchMine,
    }),
    [mineAccepted, mineNeutral, mineRecord, refetchMine, status],
  );
  const selectedStrategy = selectedStrategyState;

  const setSelectedStrategyVersionId = useCallback(
    (value: string | null) => {
      setSelectedStrategy(
        value === null
          ? null
          : {
              strategyVersionId: value,
              sourceScope: LeaderboardScope.COMBINED,
            },
      );
    },
    [setSelectedStrategy],
  );

  const refetch = useCallback(
    async (criterion?: RankingCriterion) => {
      if (
        criterion === RankingCriterion.SCORE ||
        !scopedMaintainedRef.current
      ) {
        await refetchCombined();
        return;
      }
      await Promise.all([refetchSystem(), refetchMine()]);
    },
    [refetchCombined, refetchMine, refetchSystem],
  );

  const value = useMemo<LeaderboardLiveContextValue>(
    () => ({
      isLive,
      setIsLive: updateIsLive,
      activeCriterion,
      setActiveCriterion,
      combinedScore,
      system,
      mine,
      selectedStrategy,
      setSelectedStrategy,
      maintainScopedProjections,
      scoreSnapshot: combinedScore.snapshot,
      activeSnapshot: system.snapshot,
      selectedStrategyVersionId:
        selectedStrategy?.strategyVersionId ?? null,
      setSelectedStrategyVersionId,
      loading: combinedScore.loading,
      error: combinedScore.error,
      isStale: combinedScore.isStale,
      lastSuccessfulAt: combinedScore.lastSuccessfulAt,
      refetch,
    }),
    [
      activeCriterion,
      combinedScore,
      isLive,
      maintainScopedProjections,
      mine,
      refetch,
      selectedStrategy,
      setActiveCriterion,
      setSelectedStrategy,
      setSelectedStrategyVersionId,
      system,
      updateIsLive,
    ],
  );

  return (
    <LeaderboardLiveContext.Provider value={value}>
      {children}
    </LeaderboardLiveContext.Provider>
  );
}

export function useLeaderboardLive(): LeaderboardLiveContextValue {
  const context = useContext(LeaderboardLiveContext);
  if (context === undefined) {
    throw new Error(
      "useLeaderboardLive must be used within LeaderboardLiveProvider",
    );
  }
  return context;
}
