# @fragiola/data-grid

The framework-agnostic core of **Data Grid**, a headless data grid built for millions of cells: a
typed model whose every change is a command, the axis math, windows and scroll scaling that
virtualize both axes past the browser's size limit, the engine that binds a grid to the DOM, and
the opt-in features, each an entry point of its own (`/sorting`, `/navigation`, `/row-selection`,
`/range`, `/clipboard`, `/fill`, `/editing`, `/column-resize`, `/column-reorder`,
`/column-pinning`, `/row-grouping`, `/local`, …). Zero runtime dependencies, no CSS.

An app installs its framework's package instead, which re-exports all of this:
[`@fragiola/data-grid-react`](https://www.npmjs.com/package/@fragiola/data-grid-react),
[`@fragiola/data-grid-vue`](https://www.npmjs.com/package/@fragiola/data-grid-vue) or
[`@fragiola/data-grid-angular`](https://www.npmjs.com/package/@fragiola/data-grid-angular).
Install the core alone for Node, tests or another framework:

```sh
pnpm add @fragiola/data-grid
```

Documentation: **<https://fragiola.com/data-grid>**. ESM only.

## Licence

MIT
