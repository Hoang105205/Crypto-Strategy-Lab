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
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <span className="text-sm text-body">{label}</span>
    </div>
  );
}
