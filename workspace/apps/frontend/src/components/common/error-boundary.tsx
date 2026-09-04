'use client';

import { Component, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // The boundary intentionally does not render or log provider details here.
    // Production observability can be added behind a sanitizing reporting port.
  }

  private readonly retry = () => {
    this.props.onRetry?.();
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section
        role="alert"
        className="mx-auto my-6 max-w-xl rounded-xl border border-hairline-dark bg-surface-card p-6 text-body"
      >
        <h2 className="text-lg font-semibold">Unable to display this content</h2>
        <p className="mt-2 text-sm text-muted-strong">
          Something went wrong. Please try again.
        </p>
        <button
          type="button"
          onClick={this.retry}
          className="mt-4 rounded-md bg-primary px-4 py-2 font-semibold text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
        >
          Try again
        </button>
      </section>
    );
  }
}
