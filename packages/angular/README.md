# @fragiola/data-grid-angular

Composable, unstyled Angular directives for [`@fragiola/data-grid`](https://fragiola.com/data-grid):
a headless data grid built for millions of cells. Put them on a `<table>`, on `<div>`s, or on
anything else; the styling is all yours. The package ships no CSS, no icons and no text.

It re-exports the whole core, so an Angular app installs one package:

```sh
pnpm add @fragiola/data-grid-angular
```

## A first grid

```ts
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { type Column, DATA_GRID, type DataGridNode } from "@fragiola/data-grid-angular";
import { navigation } from "@fragiola/data-grid-angular/navigation";

interface Person {
    name: string;
    age: number;
}

@Component({
    selector: "app-people",
    imports: [DATA_GRID],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div dataGridRoot [features]="features" [columns]="columns" [rows]="rows" style="height: 300px">
            <div dataGridGrid>
                <div *dataGridHeader class="bg-white">
                    <div dataGridHeaderRow>
                        <ng-template dataGridHeaderCells let-cell>
                            <div [dataGridHeaderCell]="cell"><ng-container *dataGridCellContent /></div>
                        </ng-template>
                    </div>
                </div>
                <div dataGridBody>
                    <ng-template [dataGridRows]="columns" let-row>
                        <div [dataGridRow]="row">
                            <ng-template [dataGridCells]="columns" let-cell>
                                <div [dataGridCell]="cell"><ng-container *dataGridCellContent /></div>
                            </ng-template>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export class People {
    // the keys, the active cell and the tab stop: without it, the grid is a plain table
    readonly features = [navigation()];
    readonly columns: Column<Person, DataGridNode>[] = [
        { key: "name", name: "Name", width: 160 },
        { key: "age", name: "Age", width: 80 },
    ];
    readonly rows: Person[] = [
        { name: "Ada", age: 36 },
        { name: "Alan", age: 41 },
    ];
}
```

## The Angular contract

The same primitives as `@fragiola/data-grid-react`, mapped onto Angular:

- Each part is an attribute directive on your own element (`<table dataGridGrid>`,
  `<td [dataGridCell]="cell">`): the Angular form of `render`. A part that renders only sometimes
  is a structural directive on its element (`*dataGridHeader`, `*dataGridEmpty`,
  `*dataGridRowDetail`, `*dataGridSummary`, `*dataGridColumnResizer`, `*dataGridGroupToggle`,
  `*dataGridCellEdit`; `*dataGridFillHandle` from `/fill`).
- The recursion is your templates: `<ng-template dataGridRows let-row>`,
  `<ng-template dataGridCells let-cell>`, typed by the columns or the root you give them.
- `class` and `style` are your element's, under the structural style (its keys win). Your
  listeners run before the grid's keys, clicks and presses, so `preventDefault` cancels them.
- The root's inputs are the core's root props; React's `onXChange` callbacks are outputs
  (`(editingCellChange)`, `[(columnWidths)]`, …).
- Column renderers return text or a template with its context (`Column<TRow, DataGridNode>`,
  `templateContent(template, props)`), which `*dataGridCellContent` renders.
- Every hook is an injection function (`injectRow`, `injectCell`, `injectRowWindow`, …)
  returning signals; `createDataGridRef()` makes a handle on a grid.
- `/local` (`injectLocalRows`, `[dataGridLocalRows]`) is an opt-in entry point; its `features`
  option (the root's list) says which stages run (`sorting()`, `filtering()`, `search()`,
  `pagination()`), and the root's model holds their state.
- The features are opt-in too: the root installs them (`[features]="[navigation(), sorting()]"`,
  fixed once created), and a feature's inputs and outputs are its own directive's on the root's
  element, from its entry point (each re-exports the core's of the same name):

  | entry | feature | on the root |
  | --- | --- | --- |
  | `/navigation` | `navigation()` | `dataGridNavigation [(activePosition)]`, `[defaultActivePosition]` |
  | `/row-selection` | `rowSelection()` | `dataGridRowSelection rowSelection`, `[isRowSelectable]`, `[(selectedRowKeys)]`, `[defaultSelectedRowKeys]`; `injectSelectAll` |
  | `/range` | `cellRange()` (needs navigation) | `dataGridCellRange cellSelection`, `[(selectedRange)]`, `[defaultSelectedRange]` |
  | `/clipboard` | `clipboard()` (needs `cellRange()`) | `dataGridClipboard [beforeRangePaste]`, `(rangePaste)` |
  | `/fill` | `fillHandle()` (needs `cellRange()`) | `dataGridFill (fill)` (cells fill while it is on; `[dataGridFill]="false"` turns them off); `*dataGridFillHandle`, `injectFillHandle` |
  | `/sorting` | `sorting()` | `dataGridSorting [(sortColumns)]`, `[defaultSortColumns]` |
  | `/filtering` | `filtering()` | `dataGridFiltering [(columnFilters)]`, `[defaultColumnFilters]` |
  | `/search` | `search()` | `dataGridSearch [(searchText)]`, `[defaultSearchText]` |
  | `/pagination` | `pagination()` | `dataGridPagination [(pageIndex)]`, `[(pageSize)]`, `[totalRowCount]` |

  Without navigation the grid is the ARIA table (`table`, `cell`, `columnheader`): no tab stop on
  it nor on a cell, and the arrow keys do nothing.

Zoneless and `OnPush`-safe: scrolling renders nothing until the rendered window changes, the
engine writes the layers' offsets itself. Angular 22; browser rendering only (no SSR yet).

Documentation and examples: <https://fragiola.com/data-grid>.

## Licence

MIT
