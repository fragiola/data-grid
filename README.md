# Data Grid

A headless data grid for millions of cells. It ships behaviour, accessibility and composable
primitives, and no CSS, icons or text; you bring the styling, and the structure: the same
primitives render a real `<table>` or `<div>`s.

Both axes are virtualized, the scroll space represents the whole dataset from the start (even past
the browser's maximum element size), and the grid tells you which rows and columns are in view, so
you can load exactly that window.

| package | what it is |
|---|---|
| [`@fragiola/data-grid`](packages/core) | framework-agnostic core: typed model and commands, axis math, windows, scroll scaling, cell navigation, the engine |
| [`@fragiola/data-grid-react`](packages/react) | composable React 19 primitives over the core |

## Running it

Requires Node ≥ 24 and pnpm 11.

```sh
pnpm install
pnpm dev        # playground on http://localhost:5173: every example live
pnpm check      # lint + format
pnpm typecheck
pnpm test       # unit and component tests
pnpm build
pnpm e2e        # Playwright
```

Contributors and agents: read [AGENTS.md](AGENTS.md) first.
