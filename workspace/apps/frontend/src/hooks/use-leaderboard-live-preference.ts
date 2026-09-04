"use client";

import { useCallback, useSyncExternalStore } from "react";

export const LEADERBOARD_LIVE_STORAGE_KEY =
  "crypto-strategy-lab:leaderboard-live";

const listeners = new Set<() => void>();

function readPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LEADERBOARD_LIVE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LEADERBOARD_LIVE_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function persistPreference(value: boolean): void {
  try {
    window.localStorage.setItem(LEADERBOARD_LIVE_STORAGE_KEY, String(value));
  } catch {
    // If browser storage is unavailable, a later mount safely defaults to OFF.
  }
  listeners.forEach((listener) => listener());
}

export interface LeaderboardLivePreference {
  isLeaderboardLive: boolean;
  setIsLeaderboardLive(value: boolean): void;
}

export function useLeaderboardLivePreference(): LeaderboardLivePreference {
  const isLeaderboardLive = useSyncExternalStore(
    subscribe,
    readPreference,
    () => false,
  );
  const setIsLeaderboardLive = useCallback((value: boolean) => {
    persistPreference(value);
  }, []);

  return { isLeaderboardLive, setIsLeaderboardLive };
}
