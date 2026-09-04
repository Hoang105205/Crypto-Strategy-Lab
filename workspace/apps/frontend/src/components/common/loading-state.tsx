export interface LoadingStateProps {
  label?: string;
  minHeight?: number | string;
}

export function LoadingState({
  label = 'Loading content',
  minHeight = 240,
}: LoadingStateProps) {
  return (
    <section
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-busy="true"
      className="flex w-full animate-pulse flex-col gap-4 rounded-xl border border-hairline-dark/60 bg-surface-card p-4 shadow-sm"
      style={{ minHeight }}
    >
      <span className="sr-only">{label}</span>
      <div
        data-testid="loading-skeleton"
        aria-hidden="true"
        className="h-6 w-2/5 rounded-md bg-surface-elevated/90"
      />
      <div
        data-testid="loading-skeleton"
        aria-hidden="true"
        className="h-24 w-full rounded-lg bg-surface-elevated/70"
      />
      <div
        data-testid="loading-skeleton"
        aria-hidden="true"
        className="h-24 w-full rounded-lg bg-surface-elevated/70"
      />
    </section>
  );
}

