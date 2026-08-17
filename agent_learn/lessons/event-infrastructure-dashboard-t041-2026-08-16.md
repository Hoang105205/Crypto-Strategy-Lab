# Event Infrastructure Dashboard T041 - 2026-08-16

## What worked

- Keeping the root layout as a Server Component and isolating `usePathname`/mobile state in `AppShell` preserves the App Router Server/Client boundary and shared-layout state.
- A lazy `useState` initializer gives the root provider one stable Socket.IO singleton across rerenders without reading or mutating a ref during render.
- Listener cleanup belongs to `useInfrastructureSocket`; connection teardown belongs to the root provider. Tests assert both ownership levels separately.
- Runtime-loaded RED tests let all missing-component contracts collect before production files existed.
- Testing a stateful child across pathname rerenders directly proves the shell does not reset page-owned React state.

## Adjustment made during implementation

- The first RED attempt used analyzable dynamic-import literals, so Vite stopped before collecting tests. Runtime module-path variables with `@vite-ignore` produced six independent expected failures.
- Targeted lint initially reported unused Error Boundary parameters and an incomplete memo dependency. Removing unused callback parameters and memoizing destructured connection fields produced a warning-free gate without changing behavior.

## Reusable lesson

In an App Router shell, keep routing awareness in the smallest client island. The Server root layout should compose that island and pass page children through unchanged. For global sockets, separate listener ownership from transport ownership so rerenders do not duplicate subscriptions and teardown remains deterministic.

## KB updates needed

- [ ] No KB update is required; the implementation follows DESIGN.md Application Shell, Shared UI States, Responsive Rules, and the active Dashboard realtime contract.
