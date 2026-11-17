// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.
// A root's props, the hooks' model and the refs are typed by the installed features (Epic #141;
// navigation, row selection, ranges, the clipboard and the fill handle since Epic #144).

import {
    type Column,
    createDataGridRef,
    DataGrid,
    useDataGrid,
    useDataGridRef,
    useRowWindow,
} from "../../src";
import { clipboard } from "../../src/clipboard";
import { fillHandle } from "../../src/fill";
import { navigation } from "../../src/navigation";
import { cellRange } from "../../src/range";
import { rowSelection } from "../../src/row-selection";
import { type SortColumn, sorting } from "../../src/sorting";

interface Person {
    name: string;
}

const columns: Column<Person>[] = [{ key: "name", width: 100, sortable: true }];
declare const people: Person[];
const features = [sorting()];

// sorting's props compile only with it installed
export const bare = (
    // @ts-expect-error
    <DataGrid.Root columns={columns} rows={people} sortColumns={[]} />
);
export const sorted = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={features}
        defaultSortColumns={[{ columnKey: "name", direction: "ascending" }]}
        onSortColumnsChange={(sort: readonly SortColumn[]) => sort.length}
    />
);
export const inline = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={[sorting()]}
        sortColumns={[]}
    />
);
export const wrongSort = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={features}
        // @ts-expect-error: a direction that is not one
        sortColumns={[{ columnKey: "name", direction: "up" }]}
    />
);

// the hooks' model: a feature's keys with its features named
export function Reader() {
    const plain = useDataGrid<Person>();
    // @ts-expect-error
    plain.model.run("sort-columns.toggle", { columnKey: "name" });
    // @ts-expect-error
    plain.model.get("sort-columns");
    const typed = useDataGrid<Person, typeof features>();
    typed.model.run("sort-columns.toggle", { columnKey: "name" });
    const sort: readonly SortColumn[] = typed.model.get("sort-columns");
    void sort;
    return null;
}

// a ref typed by the features carries them; any ref fits a root and the hooks
export function WithRef() {
    const gridRef = useDataGridRef<Person, typeof features>();
    const untyped = useDataGridRef<Person>();
    const grid = useDataGrid(gridRef);
    grid?.model.run("sort-columns.toggle", { columnKey: "name" });
    // @ts-expect-error
    useDataGrid(untyped)?.model.run("sort-columns.toggle", { columnKey: "a" });
    useRowWindow(gridRef);
    return (
        <>
            <DataGrid.Root
                columns={columns}
                rows={people}
                features={features}
                gridRef={gridRef}
            />
            <DataGrid.Root
                columns={columns}
                rows={people}
                features={features}
                gridRef={untyped}
            />
        </>
    );
}
export const outside = createDataGridRef<Person, typeof features>();

// Epic #144: each feature's props compile only with it installed
const navigated = [navigation()] as const;
const selectable = [rowSelection()] as const;
const ranged = [navigation(), cellRange()] as const;
const copied = [navigation(), cellRange(), clipboard()] as const;
const filled = [navigation(), cellRange(), fillHandle()] as const;

export const withoutNavigation = (
    <>
        {/* @ts-expect-error */}
        <DataGrid.Root columns={columns} rows={people} activePosition={null} />
        <DataGrid.Root
            columns={columns}
            rows={people}
            // @ts-expect-error
            defaultActivePosition={{ rowIndex: 0, columnIndex: 0 }}
        />
        <DataGrid.Root
            columns={columns}
            rows={people}
            // @ts-expect-error
            onActivePositionChange={() => {}}
        />
    </>
);
export const withNavigation = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={navigated}
        activePosition={{ rowIndex: 0, columnIndex: 0 }}
        defaultActivePosition={null}
        onActivePositionChange={(position) => position?.rowIndex}
    />
);

export const withoutRowSelection = (
    <>
        <DataGrid.Root
            columns={columns}
            rows={people}
            // @ts-expect-error
            rowSelection="multiple"
        />
        {/* @ts-expect-error */}
        <DataGrid.Root columns={columns} rows={people} selectedRowKeys={[]} />
        <DataGrid.Root
            columns={columns}
            rows={people}
            // @ts-expect-error
            isRowSelectable={() => true}
        />
    </>
);
export const withRowSelection = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={selectable}
        rowSelection="multiple"
        isRowSelectable={(row) => row.name !== ""}
        defaultSelectedRowKeys={[]}
        onSelectedRowKeysChange={(keys) => keys.length}
    />
);

export const withoutRange = (
    <>
        <DataGrid.Root
            columns={columns}
            rows={people}
            // @ts-expect-error
            cellSelection="range"
        />
        <DataGrid.Root
            columns={columns}
            rows={people}
            features={navigated}
            // @ts-expect-error: navigation alone selects no range
            selectedRange={null}
        />
    </>
);
export const withRange = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={ranged}
        cellSelection="range"
        defaultSelectedRange={null}
        onSelectedRangeChange={(range) => range?.anchor.rowIndex}
    />
);

export const withoutClipboard = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={ranged}
        // @ts-expect-error: ranges alone paste nothing
        onRangePaste={() => {}}
    />
);
export const withClipboard = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={copied}
        cellSelection="range"
        onBeforeRangePaste={({ values }) => values.length > 0}
        onRangePaste={({ range }) => range.focus.rowIndex}
    />
);

export const withoutFillHandle = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={ranged}
        // @ts-expect-error: ranges alone fill nothing
        onFill={() => {}}
    />
);
export const withFillHandle = (
    <DataGrid.Root
        columns={columns}
        rows={people}
        features={filled}
        onFill={({ target }) => target.anchor.rowIndex}
    />
);

// the features' keys, through the hooks and the refs, with their features named
export function FeatureKeys() {
    const plain = useDataGrid<Person>();
    // @ts-expect-error
    plain.model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
    // @ts-expect-error
    plain.model.get("active-position");
    // @ts-expect-error
    plain.model.is("row-selected", { rowIndex: 0 });
    // @ts-expect-error
    plain.model.run("selected-range.clear");
    const all = useDataGrid<Person, typeof copied>();
    all.model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
    all.model.run("selected-range.clear");
    all.model.is("cell-selected", { rowIndex: 0, columnIndex: 0 });
    // @ts-expect-error: row selection is not installed
    all.model.run("selected-rows.select-all");
    const rows = useDataGridRef<Person, typeof selectable>();
    useDataGrid(rows)?.model.run("selected-rows.toggle", { rowIndex: 0 });
    const selected: boolean | undefined = useDataGrid(rows)?.model.is(
        "row-selected",
        { rowIndex: 0 },
    );
    void selected;
    return null;
}
