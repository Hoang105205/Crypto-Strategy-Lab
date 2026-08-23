'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LoopStatus,
  type LeaderboardUpdatedPayload,
  type SearchLoopProgressPayload,
  type SearchLoopRun,
  type SearchLoopStartedPayload,
  type SearchLoopStoppedPayload,
} from '@crypto-strategy-lab/shared';
import {
  apiClient,
  type DashboardSummary,
} from '../services/api-client';
import { getInfrastructureSocket } from '../services/infrastructure-socket';

type EventHandler = (payload: never) => void;

type LeaderboardUpdatedWire = Omit<LeaderboardUpdatedPayload, 'updatedAt'> & {
  updatedAt: string | Date;
};

type SearchLoopStartedWire = Omit<SearchLoopStartedPayload, 'startedAt'> & {
  startedAt: string | Date;
};

type SearchLoopStoppedWire = Omit<
  SearchLoopStoppedPayload,
  'startedAt' | 'stoppedAt'
> & {
  startedAt: string | Date;
  stoppedAt: string | Date;
};

export interface InfrastructureEventSocket {
  on(event: string, handler: EventHandler): unknown;
  off(event: string, handler: EventHandler): unknown;
}

export interface UseDashboardSummaryOptions {
  getDashboardSummary?: () => Promise<DashboardSummary>;
  socket?: InfrastructureEventSocket;
}

export interface DashboardSummaryState {
  data: DashboardSummary | null;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  lastSuccessfulAt: Date | null;
  isLeaderboardLive: boolean;
  setIsLeaderboardLive(value: boolean): void;
  refetch(): Promise<void>;
}

const TERMINAL_LOOP_STATUSES = new Set<LoopStatus>([
  LoopStatus.COMPLETED,
  LoopStatus.STOPPED_BY_USER,
  LoopStatus.FAILED,
]);

function isTerminal(status: LoopStatus): boolean {
  return TERMINAL_LOOP_STATUSES.has(status);
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function newerScore(
  current: SearchLoopRun,
  incomingScore: number | null,
  incomingId: string | null,
): Pick<SearchLoopRun, 'bestScore' | 'bestStrategyVersionId'> {
  if (
    incomingScore === null ||
    (current.bestScore !== null && current.bestScore > incomingScore)
  ) {
    return {
      bestScore: current.bestScore,
      bestStrategyVersionId: current.bestStrategyVersionId,
    };
  }
  return { bestScore: incomingScore, bestStrategyVersionId: incomingId };
}

function mergeLoopSnapshot(
  current: SearchLoopRun | null,
  incoming: SearchLoopRun | null,
): SearchLoopRun | null {
  if (current === null || incoming === null || current.id !== incoming.id) {
    return incoming;
  }
  if (isTerminal(current.status)) return current;

  return {
    ...incoming,
    iteration: Math.max(current.iteration, incoming.iteration),
    testedCandidates: Math.max(
      current.testedCandidates,
      incoming.testedCandidates,
    ),
    ...newerScore(current, incoming.bestScore, incoming.bestStrategyVersionId),
  };
}

function errorFrom(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

export function useDashboardSummary(
  options: UseDashboardSummaryOptions = {},
): DashboardSummaryState {
  const getDashboardSummary =
    options.getDashboardSummary ?? apiClient.getDashboardSummary;
  const socket =
    options.socket ??
    (getInfrastructureSocket() as unknown as InfrastructureEventSocket);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(true);
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState<Date | null>(null);
  const [isLeaderboardLive, setIsLeaderboardLiveState] = useState(true);
  const dataRef = useRef<DashboardSummary | null>(null);
  const requestGenerationRef = useRef(0);
  const liveRevisionRef = useRef(0);
  const leaderboardWatermarkRef = useRef(Number.NEGATIVE_INFINITY);
  const isLeaderboardLiveRef = useRef(true);
  const mountedRef = useRef(false);

  const commitData = useCallback((next: DashboardSummary) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const updateCurrent = useCallback(
    (updater: (current: DashboardSummary) => DashboardSummary) => {
      const current = dataRef.current;
      if (current === null) return;
      liveRevisionRef.current += 1;
      commitData(updater(current));
    },
    [commitData],
  );

  const refetch = useCallback(async () => {
    const requestGeneration = ++requestGenerationRef.current;
    const liveRevisionAtStart = liveRevisionRef.current;
    setLoading(true);
    setError(null);

    try {
      const snapshot = await getDashboardSummary();
      if (!mountedRef.current || requestGeneration !== requestGenerationRef.current) {
        return;
      }

      const current = dataRef.current;
      let next =
        current !== null && liveRevisionRef.current !== liveRevisionAtStart
          ? {
              ...snapshot,
              leaderboard:
                current.leaderboard.updatedAt > snapshot.leaderboard.updatedAt
                  ? current.leaderboard
                  : snapshot.leaderboard,
              loop: mergeLoopSnapshot(current.loop, snapshot.loop),
            }
          : snapshot;
      if (
        snapshot.leaderboard.updatedAt.getTime() <
        leaderboardWatermarkRef.current
      ) {
        if (current === null) return;
        next = { ...next, leaderboard: current.leaderboard };
      }
      leaderboardWatermarkRef.current = Math.max(
        leaderboardWatermarkRef.current,
        next.leaderboard.updatedAt.getTime(),
      );
      commitData(next);
      setLastSuccessfulAt(snapshot.generatedAt);
      setIsStale(false);
    } catch (reason) {
      if (mountedRef.current && requestGeneration === requestGenerationRef.current) {
        setError(errorFrom(reason));
      }
    } finally {
      if (mountedRef.current && requestGeneration === requestGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [commitData, getDashboardSummary]);

  const setIsLeaderboardLive = useCallback((value: boolean) => {
    isLeaderboardLiveRef.current = value;
    setIsLeaderboardLiveState(value);
  }, []);

  const handleLeaderboard = useCallback(
    (wire: LeaderboardUpdatedWire) => {
      const updatedAt = asDate(wire.updatedAt);
      if (updatedAt.getTime() < leaderboardWatermarkRef.current) return;
      leaderboardWatermarkRef.current = updatedAt.getTime();
      liveRevisionRef.current += 1;
      void refetch();
    },
    [refetch],
  );

  useEffect(() => {
    mountedRef.current = true;

    const handleConnect = () => {
      setIsStale(true);
      if (isLeaderboardLiveRef.current) void refetch();
    };
    const handleDisconnect = () => setIsStale(true);
    const handleLoopStarted = (wire: SearchLoopStartedWire) => {
      updateCurrent((current) => ({
        ...current,
        loop: {
          id: wire.loopRunId,
          status: LoopStatus.RUNNING,
          generatorType: wire.config.generatorType,
          iteration: 0,
          testedCandidates: 0,
          maxCandidates: wire.config.maxCandidates,
          maxDurationMs: wire.config.maxDurationMs,
          stopOnNoImprovementIterations:
            wire.config.stopOnNoImprovementIterations,
          currentCandidateStrategyVersionId: null,
          bestStrategyVersionId: null,
          bestScore: null,
          stopReason: null,
          startedAt: asDate(wire.startedAt),
          pausedAt: null,
          stoppedAt: null,
        },
      }));
    };
    const handleLoopProgress = (payload: SearchLoopProgressPayload) => {
      updateCurrent((current) => {
        const loop = current.loop;
        if (
          loop === null ||
          loop.id !== payload.loopRunId ||
          isTerminal(loop.status)
        ) {
          return current;
        }
        return {
          ...current,
          loop: {
            ...loop,
            iteration: Math.max(loop.iteration, payload.iteration),
            testedCandidates: Math.max(
              loop.testedCandidates,
              payload.testedCandidates,
            ),
            currentCandidateStrategyVersionId:
              payload.iteration >= loop.iteration
                ? payload.currentCandidate.strategyVersionId
                : loop.currentCandidateStrategyVersionId,
            ...newerScore(
              loop,
              payload.bestScoreSoFar,
              payload.bestStrategyVersionId,
            ),
          },
        };
      });
    };
    const handleLoopStopped = (wire: SearchLoopStoppedWire) => {
      updateCurrent((current) => {
        const loop = current.loop;
        if (loop === null || loop.id !== wire.loopRunId || isTerminal(loop.status)) {
          return current;
        }
        return {
          ...current,
          loop: {
            ...loop,
            status: wire.status,
            testedCandidates: Math.max(loop.testedCandidates, wire.testedCandidates),
            ...newerScore(loop, wire.bestScore, wire.bestStrategyVersionId),
            stopReason: wire.stopReason,
            startedAt: asDate(wire.startedAt),
            stoppedAt: asDate(wire.stoppedAt),
          },
        };
      });
    };

    socket.on('connect', handleConnect as EventHandler);
    socket.on('disconnect', handleDisconnect as EventHandler);
    socket.on('loop:started', handleLoopStarted as EventHandler);
    socket.on('loop:progress', handleLoopProgress as EventHandler);
    socket.on('loop:stopped', handleLoopStopped as EventHandler);
    return () => {
      mountedRef.current = false;
      socket.off('connect', handleConnect as EventHandler);
      socket.off('disconnect', handleDisconnect as EventHandler);
      socket.off('loop:started', handleLoopStarted as EventHandler);
      socket.off('loop:progress', handleLoopProgress as EventHandler);
      socket.off('loop:stopped', handleLoopStopped as EventHandler);
    };
  }, [refetch, socket, updateCurrent]);

  useEffect(() => {
    if (!isLeaderboardLive) return;

    socket.on('leaderboard:update', handleLeaderboard as EventHandler);
    // Subscribe first so an event during catch-up starts a newer generation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();

    return () => {
      socket.off('leaderboard:update', handleLeaderboard as EventHandler);
    };
  }, [handleLeaderboard, isLeaderboardLive, refetch, socket]);

  return {
    data,
    loading,
    error,
    isStale,
    lastSuccessfulAt,
    isLeaderboardLive,
    setIsLeaderboardLive,
    refetch,
  };
}
