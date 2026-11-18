# @fragiola/data-grid-vue

Composable, unstyled Vue 3 primitives for [`@fragiola/data-grid`](https://fragiola.com/data-grid):
a headless data grid built for millions of cells. Render it as a `<table>`, as `<div>`s, or as
anything else; the styling is all yours. The package ships no CSS, no icons and no text.

It re-exports the whole core, so a Vue app installs one package:

```sh
pnpm add @fragiola/data-grid-vue vue
```

## A first grid

```vue
<script setup lang="ts">
import { type Column, typedDataGrid } from "@fragiola/data-grid-vue";
import type { VNodeChild } from "vue";

interface Person {
    name: string;
    age: number;
}

const DataGrid = typedDataGrid<Person>();
const columns: Column<Person, VNodeChild>[] = [
    { key: "name", name: "Name", width: 160 },
    { key: "age", name: "Age", width: 80 },
];
const rows: Person[] = [
    { name: "Ada", age: 36 },
    { name: "Alan", age: 41 },
];
</script>

<template>
    <DataGrid.Root :columns="columns" :rows="rows" style="height: 300px">
        <DataGrid.Grid>
            <DataGrid.Header class="bg-white" />
            <DataGrid.Body />
        </DataGrid.Grid>
    </DataGrid.Root>
</template>
```

## The Vue contract

The same primitives as `@fragiola/data-grid-react`, mapped onto Vue:

- `as` replaces a primitive's element (`<DataGrid.Grid as="table">`); a `render` scoped slot
  receives `{ props, state, children }` for `v-bind="props"` on your own element.
- The collection parts (`Rows`, `Cells`, `HeaderRows`, `HeaderCells`, `SummaryRows`,
  `SummaryCells`) take a default scoped slot: `<DataGrid.Rows v-slot="{ row }">`.
- `class` and `style` are fallthrough attributes, merged under the structural style (its keys
  win). Listeners compose: the primitive's first, then yours, then the grid's keys and clicks, so
  `preventDefault` in yours cancels the grid's.
- Column renderers return vnodes (`Column<TRow, VNodeChild>`): `renderCell: ({ row }) => h("b", row.name)`.
- Composables (`useRow`, `useCell`, `useColumnResizer`, …) take a value or a getter and return
  `{ state, props }` as computed refs. `typedDataGrid<TRow>()` types the parts by your row type,
  which a template cannot pass as a type argument.
- `/local` (`useLocalRows`, `features` its stages: the installed `sorting()`, `filtering()`,
  `search()`, `pagination()`) is an opt-in entry point, and so is every feature, the core's
  re-exported with its composables: `/sorting`, `/navigation` (the keys and the tab stop: without
  it the grid is a plain `table` of `cell`s), `/row-selection` (`useSelectAll`), `/range`,
  `/clipboard` and `/fill` (`useFillHandle`). Install them on `Root` (`:features="features"`, a
  list fixed for the grid's life); their props are fallthrough attributes there
  (`:active-position`, `@selected-row-keys-change`), typed by
  `typedDataGrid<TRow, typeof features>()`.

Scrolling renders nothing until the rendered window changes: the engine writes the layers'
offsets itself.

Documentation and examples: <https://fragiola.com/data-grid>.

## Licence

MIT
