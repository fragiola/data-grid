// Type fixtures, checked by `ngc` (strict templates), never run: the injection functions' model
// and the refs are typed by the installed features (Epic #141), and a feature's inputs are its
// directive's (`[dataGridSorting]`). `@ts-expect-error` marks what must not compile. A template
// binding the root has no input for (`<div dataGridRoot [sortColumns]>` without
// `DataGridSorting`) is a template error, which `@ts-expect-error` cannot mark: the root's class
// having no such member stands for it.
import { Component, signal } from "@angular/core";
import {
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
} from "../../src/public-api";
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
