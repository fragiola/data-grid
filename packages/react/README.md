# @fragiola/data-grid-react

Composable, unstyled React 19 primitives for [`@fragiola/data-grid`](https://fragiola.com/data-grid):
a headless data grid built for millions of cells. Render it as a `<table>`, as `<div>`s, or as
anything else; the styling is all yours. The package ships no CSS, no icons and no text.

It re-exports the whole core, so a React app installs one package:

```sh
pnpm add @fragiola/data-grid-react
```

## A first grid

```tsx
import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { navigation } from "@fragiola/data-grid-react/navigation";

interface Person {
    id: number;
    name: string;
    age: number;
}

// the keys, the active cell and the tab stop: without it, the grid is a plain table
const features = [navigation()];

const columns: Column<Person>[] = [
    { key: "name", name: "Name", width: 160 },
    { key: "age", name: "Age", width: 80 },
];

export function People({ people }: { people: Person[] }) {
    return (
        <DataGrid.Root
            features={features}
            columns={columns}
            rows={people}
            rowKey={(row) => row.id}
            style={{ height: 300 }}
        >
            <DataGrid.Grid aria-label="People">
                <DataGrid.Header className="bg-white" />
                <DataGrid.Body />
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}
```

`DataGrid.Root` is the scroll container: give it a height, or nothing is virtualized.

- Every part takes `className`, `style` and `render` (to swap its element: `render={<table />}`),
  and exposes its state as `data-*` attributes.
- The collection parts (`Rows`, `Cells`, `HeaderRows`, `HeaderCells`, …) take a function child:
  `<DataGrid.Rows>{(row) => <DataGrid.Row row={row} />}</DataGrid.Rows>`.
- Hooks (`useRow`, `useCell`, `useGridView`, `useDataGridRef`, …) give a part's state and props for
  your own elements.
- Every feature is an opt-in entry point, the core's re-exported with its hooks: `/sorting`,
  `/navigation`, `/row-selection`, `/range`, `/clipboard`, `/fill`, `/editing`, `/column-resize`,
  `/column-reorder`, `/column-pinning`, `/row-grouping`, `/local` (rows in memory: sorted,
  filtered, grouped and paged), and more. Install them on `Root` through `features`.

Documentation and examples: <https://fragiola.com/data-grid>.

## Licence

MIT
