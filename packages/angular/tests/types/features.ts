// Type fixtures, checked by `ngc` (strict templates), never run: the injection functions' model
// and the refs are typed by the installed features (Epic #141, #144), and a feature's inputs are
// its directive's (`[dataGridSorting]`, `[dataGridNavigation]`, `[dataGridRowSelection]`,
// `[dataGridCellRange]`, `[dataGridClipboard]`, `[dataGridFill]`). `@ts-expect-error` marks what must not compile. A template
// binding the root has no input for (`<div dataGridRoot [sortColumns]>` without
// `DataGridSorting`) is a template error, which `@ts-expect-error` cannot mark: the root's class
// having no such member stands for it.
import { Component, signal } from "@angular/core";
import { clipboard, DataGridClipboard } from "../../src/clipboard";
import {
    DataGridFill,
    DataGridFillHandle,
    type FillHandleState,
    fillHandle,
    injectFillHandle,
} from "../../src/fill";
import { DataGridNavigation, navigation } from "../../src/navigation";
import {
    type CellPosition,
    type CellRange,
    type Column,
    createDataGridRef,
    DATA_GRID,
    type DataGridFeature,
    type DataGridFeatures,
    type DataGridNode,
    type DataGridRef,
    type DataGridRoot,
    injectDataGrid,
    injectRowWindow,
    type RangeFill,
    type RangePaste,
    type RowKey,
} from "../../src/public-api";
import { cellRange, DataGridCellRange } from "../../src/range";
import {
    DataGridRowSelection,
    injectSelectAll,
    rowSelection,
} from "../../src/row-selection";
import {
    DataGridSorting,
    type SortColumn,
    type SortingTypes,
    sorting,
} from "../../src/sorting";

interface Person {
    name: string;
}

const columns: Column<Person, DataGridNode>[] = [
    { key: "name", width: 100, sortable: true },
];
const features = [sorting()];

// a feature is a `DataGridFeature`, a list of them `DataGridFeatures`
const installed: DataGridFeatures = features;
const one: DataGridFeature<SortingTypes> = sorting();
void installed;
void one;

// the root has no sort of its own: its inputs are `[dataGridSorting]`'s
declare const root: DataGridRoot<Person>;
// @ts-expect-error
void root.sortColumns;
// @ts-expect-error
void root.sortColumnsChange;
declare const sortInputs: DataGridSorting;
const sortNow: readonly SortColumn[] | undefined = sortInputs.sortColumns();
void sortNow;

// the injection's model: a feature's keys with its features named
export function reader() {
    const plain = injectDataGrid<Person>();
    // @ts-expect-error
    plain.model.run("sort-columns.toggle", { columnKey: "name" });
    // @ts-expect-error
    plain.model.get("sort-columns");
    const typed = injectDataGrid<Person, typeof features>();
    typed.model.run("sort-columns.toggle", { columnKey: "name" });
    const sort: readonly SortColumn[] = typed.model.get("sort-columns");
    typed.model.run("sort-columns.set", {
        // @ts-expect-error: a direction that is not one
        sortColumns: [{ columnKey: "name", direction: "up" }],
    });
    return sort;
}

// a ref typed by the features carries them; any ref fits a root and the injection functions
export function withRef() {
    const gridRef = createDataGridRef<Person, typeof features>();
    const untyped = createDataGridRef<Person>();
    injectDataGrid(gridRef)()?.model.run("sort-columns.toggle", {
        columnKey: "name",
    });
    // @ts-expect-error
    injectDataGrid(untyped)()?.model.run("sort-columns.toggle", {
        columnKey: "name",
    });
    injectRowWindow(gridRef);
    const fits: DataGridRef<Person> = gridRef;
    const fitsToo: DataGridRef<Person> = untyped;
    return [fits, fitsToo];
}

// the sort on the root's element, bound both ways, with sorting installed
@Component({
    imports: [DATA_GRID, DataGridSorting],
    template: `
        <div dataGridRoot [columns]="columns" [rows]="rows" [features]="features" [gridRef]="gridRef"
            dataGridSorting [(sortColumns)]="sort" [defaultSortColumns]="[]"></div>
    `,
})
export class Sorted {
    readonly columns = columns;
    readonly rows: Person[] = [];
    readonly features = features;
    readonly gridRef = createDataGridRef<Person, typeof features>();
    readonly sort = signal<readonly SortColumn[]>([]);
}

// Epic #144: navigation, row selection, cell ranges, the clipboard and the fill handle are features
// too; the root has none of their inputs or outputs: they are their directives'
// @ts-expect-error
void root.activePosition;
// @ts-expect-error
void root.activePositionChange;
// @ts-expect-error
void root.defaultActivePosition;
// @ts-expect-error
void root.rowSelection;
// @ts-expect-error
void root.isRowSelectable;
// @ts-expect-error
void root.selectedRowKeys;
// @ts-expect-error
void root.selectedRowKeysChange;
// @ts-expect-error
void root.cellSelection;
// @ts-expect-error
void root.selectedRange;
// @ts-expect-error
void root.selectedRangeChange;
// @ts-expect-error
void root.beforeRangePaste;
// @ts-expect-error
void root.rangePaste;
// @ts-expect-error
void root.fillable;
// @ts-expect-error
void root.fill;

const everything = [
    navigation(),
    rowSelection(),
    cellRange(),
    clipboard(),
    fillHandle(),
] as const;

// the features' keys, with them named only
export function featureKeys() {
    const plain = injectDataGrid<Person>();
    // @ts-expect-error
    plain.model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
    // @ts-expect-error
    plain.model.get("active-position");
    // @ts-expect-error
    plain.model.is("cell-active", { rowIndex: 0, columnIndex: 0 });
    // @ts-expect-error
    plain.model.run("selected-rows.toggle", { rowIndex: 0 });
    // @ts-expect-error
    plain.model.is("row-selected", { rowIndex: 0 });
    // @ts-expect-error
    plain.model.run("selected-range.select-all");
    // @ts-expect-error
    plain.model.get("selected-range");
    const typed = injectDataGrid<Person, typeof everything>();
    typed.model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
    const active = typed.model.get("active-position");
    typed.model.is("cell-active", { rowIndex: 0, columnIndex: 0 });
    typed.model.run("selected-rows.toggle", { rowIndex: 0 });
    typed.model.is("row-selected", { rowIndex: 0 });
    typed.model.run("selected-range.select-all");
    const range = typed.model.get("selected-range");
    // a feature's state, with it installed
    const keys: readonly RowKey[] = typed.model.state.selectedRowKeys;
    // @ts-expect-error
    void plain.model.state.selectedRowKeys;
    const all = injectSelectAll<Person>([]);
    const handle: FillHandleState = injectFillHandle({
        rowIndex: 0,
        columnIndex: 0,
    }).state();
    return [active, range, keys, all, handle];
}

// every feature's inputs and outputs on the root's element, with their directives
@Component({
    imports: [
        DATA_GRID,
        DataGridNavigation,
        DataGridRowSelection,
        DataGridCellRange,
        DataGridClipboard,
        DataGridFill,
        DataGridFillHandle,
    ],
    template: `
        <div dataGridRoot [columns]="columns" [rows]="rows" [features]="features"
            dataGridNavigation [(activePosition)]="active" [defaultActivePosition]="null"
            dataGridRowSelection rowSelection="multiple" [isRowSelectable]="selectable"
            [(selectedRowKeys)]="selected" [defaultSelectedRowKeys]="[]"
            dataGridCellRange cellSelection="range" [(selectedRange)]="range" [defaultSelectedRange]="null"
            dataGridClipboard [beforeRangePaste]="allow" (rangePaste)="pasted($event)"
            dataGridFill (fill)="filled($event)">
            <div dataGridGrid>
                <div dataGridBody>
                    <ng-template dataGridRows let-row>
                        <div [dataGridRow]="row">
                            <ng-template dataGridCells let-cell>
                                <div [dataGridCell]="cell"><span *dataGridFillHandle="cell; let state">{{ state.filling }}</span></div>
                            </ng-template>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
        <div dataGridRoot [columns]="columns" [rows]="rows" [features]="features" [dataGridFill]="false"></div>
    `,
})
export class EveryFeature {
    readonly columns = columns;
    readonly rows: Person[] = [];
    readonly features = everything;
    readonly active = signal<CellPosition | null>(null);
    readonly selected = signal<readonly RowKey[]>([]);
    readonly range = signal<CellRange | null>(null);
    readonly selectable = (person: Person) => person.name !== "";
    readonly allow = (paste: RangePaste) => paste.values.length > 0;
    pasted(paste: RangePaste) {
        return paste;
    }
    filled(fill: RangeFill) {
        return fill;
    }
}
