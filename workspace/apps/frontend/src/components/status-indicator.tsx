'use client';

// StatusIndicator — connection status with text + icon (never color alone).
// Owner: Hoang
// See: spec.md FR-7, DESIGN.md StatusIndicator component

import { useWebSocket } from '../hooks/use-websocket';
import { COLORS } from '../lib/constants';

export function StatusIndicator() {
  const { status, lastReconnectAt } = useWebSocket();

  const dotColor =
    status === 'connected'
      ? COLORS.tradingUp
      : status === 'reconnecting'
        ? COLORS.primary
        : COLORS.tradingDown;

  const label =
    status === 'connected'
      ? lastReconnectAt
        ? `Connected (reconnected ${lastReconnectAt.toLocaleTimeString()})`
        : 'Connected'
      : status === 'reconnecting'
        ? 'Reconnecting...'
        : 'Connection lost';

  return (
    <div className="flex items-center gap-2 rounded-lg border border-hairline-dark/80 bg-surface-card px-3 py-1.5 shadow-sm">
      <span className="relative flex h-2 w-2 items-center justify-center">
        {status === 'reconnecting' && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      </span>
      <span className="text-xs font-medium text-body">{label}</span>
    </div>
  );
}
