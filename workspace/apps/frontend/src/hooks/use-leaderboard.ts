'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RankingCriterion,
  type LeaderboardSnapshot,
  type LeaderboardUpdatedPayload,
} from '@crypto-strategy-lab/shared';
import { apiClient } from '../services/api-client';
import { getInfrastructureSocket } from '../services/infrastructure-socket';
import type { InfrastructureEventSocket } from './use-dashboard-summary';

type EventHandler = (payload: never) => void;

type LeaderboardUpdatedWire = Omit<LeaderboardUpdatedPayload, 'updatedAt'> & {
  updatedAt: string | Date;
};

export interface UseLeaderboardOptions {
  getLeaderboard?: (sortBy: RankingCriterion) => Promise<LeaderboardSnapshot>;
  socket?: InfrastructureEventSocket;
}

export interface LeaderboardState {
  data: LeaderboardSnapshot | null;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  lastSuccessfulAt: Date | null;
  sortBy: RankingCriterion;
  setSortBy(value: RankingCriterion): void;
  selectedStrategyVersionId: string | null;
  setSelectedStrategyVersionId(value: string | null): void;
  refetch(): Promise<void>;
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function errorFrom(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

export function useLeaderboard(
  options: UseLeaderboardOptions = {},
): LeaderboardState {
  const getLeaderboard = options.getLeaderboard ?? apiClient.getLeaderboard;
  const socket =
    options.socket ??
    (getInfrastructureSocket() as unknown as InfrastructureEventSocket);
  const [data, setData] = useState<LeaderboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(true);
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState<Date | null>(null);
  const [sortBy, setSortByState] = useState<RankingCriterion>(
    RankingCriterion.SCORE,
  );
  const [selectedStrategyVersionId, setSelectedStrategyVersionId] = useState<
    string | null
  >(null);
  const dataRef = useRef<LeaderboardSnapshot | null>(null);
  const sortByRef = useRef(sortBy);
  const requestGenerationRef = useRef(0);
  const liveRevisionRef = useRef(0);
  const realtimeWatermarkRef = useRef(Number.NEGATIVE_INFINITY);
  const mountedRef = useRef(false);

  const commitData = useCallback((next: LeaderboardSnapshot) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const fetchSnapshot = useCallback(
    async (criterion: RankingCriterion) => {
      const requestGeneration = ++requestGenerationRef.current;
      const liveRevisionAtStart = liveRevisionRef.current;
      setLoading(true);
      setError(null);
      try {
        const snapshot = await getLeaderboard(criterion);
        if (
          !mountedRef.current ||
          requestGeneration !== requestGenerationRef.current
        ) {
          return;
        }
        if (snapshot.updatedAt.getTime() < realtimeWatermarkRef.current) {
          return;
        }
        if (
          liveRevisionRef.current !== liveRevisionAtStart &&
          dataRef.current !== null &&
          snapshot.updatedAt < dataRef.current.updatedAt
        ) {
          return;
        }
        realtimeWatermarkRef.current = Math.max(
          realtimeWatermarkRef.current,
          snapshot.updatedAt.getTime(),
        );
        commitData(snapshot);
        setLastSuccessfulAt(snapshot.updatedAt);
        setIsStale(false);
      } catch (reason) {
        if (
          mountedRef.current &&
          requestGeneration === requestGenerationRef.current
        ) {
          setError(errorFrom(reason));
        }
      } finally {
        if (
          mountedRef.current &&
          requestGeneration === requestGenerationRef.current
        ) {
          setLoading(false);
        }
      }
    },
    [commitData, getLeaderboard],
  );

  const refetch = useCallback(
    () => fetchSnapshot(sortByRef.current),
    [fetchSnapshot],
  );

  const setSortBy = useCallback(
    (value: RankingCriterion) => {
      sortByRef.current = value;
      setSortByState(value);
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;

    const handleConnect = () => {
      setIsStale(true);
      void refetch();
    };
    const handleDisconnect = () => setIsStale(true);
    const handleLeaderboard = (wire: LeaderboardUpdatedWire) => {
      const updatedAt = asDate(wire.updatedAt);
      if (updatedAt.getTime() < realtimeWatermarkRef.current) return;

      realtimeWatermarkRef.current = updatedAt.getTime();
      liveRevisionRef.current += 1;
      void refetch();
    };

    socket.on('connect', handleConnect as EventHandler);
    socket.on('disconnect', handleDisconnect as EventHandler);
    socket.on('leaderboard:update', handleLeaderboard as EventHandler);
    void refetch();

    return () => {
      mountedRef.current = false;
      socket.off('connect', handleConnect as EventHandler);
      socket.off('disconnect', handleDisconnect as EventHandler);
      socket.off('leaderboard:update', handleLeaderboard as EventHandler);
    };
  }, [commitData, refetch, socket]);

  return {
    data,
    loading,
    error,
    isStale,
    lastSuccessfulAt,
    sortBy,
    setSortBy,
    selectedStrategyVersionId,
    setSelectedStrategyVersionId,
    refetch,
  };
}
