// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.
// A root's props, the composables' model and the refs are typed by the installed features
// (Epic #141): a template cannot pass a type argument, so `typedDataGrid` takes them.

import { defineComponent, h, type VNodeChild } from "vue";
import {
    type Column,
    createDataGridRef,
    DataGrid,
    typedDataGrid,
    useDataGrid,
    useDataGridRef,
    useRowWindow,
} from "../../src";
import { clipboard } from "../../src/clipboard";
import { editing } from "../../src/editing";
import { fillHandle } from "../../src/fill";
import { navigation } from "../../src/navigation";
import { cellRange } from "../../src/range";
import { RowDetail, rowExpansion } from "../../src/row-expansion";
import { rowGrouping } from "../../src/row-grouping";
import { rowReorder } from "../../src/row-reorder";
import { rowSelection } from "../../src/row-selection";
import { type SortColumn, sorting } from "../../src/sorting";
import { cellSpans } from "../../src/spans";
import { Summary, summaryRows } from "../../src/summary-rows";

interface Person {
    name: string;
}

const columns: Column<Person, VNodeChild>[] = [
    { key: "name", width: 100, sortable: true },
];
declare const people: Person[];
const features = [sorting()] as const;

/** The props a component takes, as a template or `h` checks them. */
type PropsOf<C extends abstract new (...args: never) => { $props: object }> =
    InstanceType<C>["$props"];

// sorting's props compile only with it installed
const Bare = typedDataGrid<Person>();
export const bare: PropsOf<typeof Bare.Root> = {
    columns,
    rows: people,
    // @ts-expect-error
    sortColumns: [],
};
const Sorted = typedDataGrid<Person, typeof features>();
export const sorted: PropsOf<typeof Sorted.Root> = {
    columns,
    rows: people,
    features,
    defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
    onSortColumnsChange: (sort: readonly SortColumn[]) => sort.length,
};
h(Sorted.Root, { columns, rows: people, features, sortColumns: [] });
h(Sorted.Root, {
    columns,
    rows: people,
    features,
    // @ts-expect-error: a direction that is not one
    sortColumns: [{ columnKey: "name", direction: "up" }],
});
// @ts-expect-error: features other than the ones it is typed with
h(Bare.Root, { columns, rows: people, features });

// the untyped primitives stay loose: any features, any of their props
h(DataGrid.Root, { columns: [], rows: [], features, sortColumns: [] });

// the composables' model: a feature's keys with its features named
export const Reader = defineComponent(() => {
    const plain = useDataGrid<Person>();
    // @ts-expect-error
    plain.model.run("sort-columns.toggle", { columnKey: "name" });
    // @ts-expect-error
    plain.model.get("sort-columns");
    const typed = useDataGrid<Person, typeof features>();
    typed.model.run("sort-columns.toggle", { columnKey: "name" });
    const sort: readonly SortColumn[] = typed.model.get("sort-columns");
    void sort;
    return () => null;
});

// a ref typed by the features carries them; any ref fits a root and the composables
export const WithRef = defineComponent(() => {
    const gridRef = useDataGridRef<Person, typeof features>();
    const untyped = useDataGridRef<Person>();
    const grid = useDataGrid(gridRef);
    grid.value?.model.run("sort-columns.toggle", { columnKey: "name" });
    useDataGrid(untyped).value?.model.run(
        // @ts-expect-error
        "sort-columns.toggle",
        { columnKey: "a" },
    );
    useRowWindow(gridRef);
    return () => [
        h(Sorted.Root, { columns, rows: people, features, gridRef }),
        h(Sorted.Root, { columns, rows: people, features, gridRef: untyped }),
    ];
});
export const outside = createDataGridRef<Person, typeof features>();

// navigation, row selection, cell ranges, the clipboard and the fill handle (Epic #144): each
// one's props compile only with it installed
const navigated = [navigation()] as const;
const selectable = [rowSelection()] as const;
const ranged = [navigation(), cellRange()] as const;
const pasting = [navigation(), cellRange(), clipboard()] as const;
const filling = [navigation(), cellRange(), fillHandle()] as const;

export const bareNavigation: PropsOf<typeof Bare.Root> = {
    columns,
    rows: people,
    // @ts-expect-error
    defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
};
export const bareActivePosition: PropsOf<typeof Bare.Root> = {
    columns,
    rows: people,
    // @ts-expect-error
    onActivePositionChange: () => {},
};
const Navigated = typedDataGrid<Person, typeof navigated>();
h(Navigated.Root, {
    columns,
    rows: people,
    features: navigated,
    activePosition: null,
    defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
    onActivePositionChange: (position) => position?.rowIndex,
});

export const bareSelection: PropsOf<typeof Bare.Root> = {
    columns,
    rows: people,
    // @ts-expect-error
    rowSelection: "multiple",
};
export const bareSelectedRowKeys: PropsOf<typeof Bare.Root> = {
    columns,
    rows: people,
    // @ts-expect-error
    selectedRowKeys: [],
};
const Selectable = typedDataGrid<Person, typeof selectable>();
h(Selectable.Root, {
    columns,
    rows: people,
    features: selectable,
    rowSelection: "multiple",
    isRowSelectable: (row) => row.name !== "",
    defaultSelectedRowKeys: [0],
    onSelectedRowKeysChange: (keys) => keys.length,
});

export const bareRange: PropsOf<typeof Bare.Root> = {
    columns,
    rows: people,
    // @ts-expect-error
    cellSelection: "range",
};
export const navigatedRange: PropsOf<typeof Navigated.Root> = {
    columns,
    rows: people,
    features: navigated,
    // @ts-expect-error: the range's, not navigation's
    selectedRange: null,
};
const Ranged = typedDataGrid<Person, typeof ranged>();
h(Ranged.Root, {
    columns,
    rows: people,
    features: ranged,
    cellSelection: "range",
    selectedRange: null,
    onSelectedRangeChange: (range) => range?.anchor,
});

export const rangedPaste: PropsOf<typeof Ranged.Root> = {
    columns,
    rows: people,
    features: ranged,
    // @ts-expect-error: the clipboard's, not the range's
    onRangePaste: () => {},
};
const Pasting = typedDataGrid<Person, typeof pasting>();
h(Pasting.Root, {
    columns,
    rows: people,
    features: pasting,
    cellSelection: "range",
    onRangePaste: (paste) => paste.values.length,
    onBeforeRangePaste: () => false,
});

export const rangedFill: PropsOf<typeof Ranged.Root> = {
    columns,
    rows: people,
    features: ranged,
    // @ts-expect-error: the fill handle's, not the range's
    onFill: () => {},
};
const Filling = typedDataGrid<Person, typeof filling>();
h(Filling.Root, {
    columns,
    rows: people,
    features: filling,
    cellSelection: "range",
    onFill: (fill) => fill.target,
});

// editing's props (Epic #146): only with it installed, the event typed by the row
export const bareEdit: PropsOf<typeof Bare.Root> = {
    columns,
    rows: people,
    // @ts-expect-error
    editingCell: null,
};
const editable = [navigation(), editing()] as const;
const Editing = typedDataGrid<Person, typeof editable>();
h(Editing.Root, {
    columns,
    rows: people,
    features: editable,
    editingCell: null,
    onEditingCellChange: (cell) => cell?.startKey,
    onCellEdit: (edit) => edit.row.name,
});

// the row features' props (Epic #151): only with them installed
export const bareRows: PropsOf<typeof Bare.Root>[] = [
    {
        columns,
        rows: people,
        // @ts-expect-error
        expandedRowKeys: [],
    },
    {
        columns,
        rows: people,
        // @ts-expect-error
        detailHeight: 100,
    },
    {
        columns,
        rows: people,
        // @ts-expect-error
        expandedGroupKeys: [],
    },
    {
        columns,
        rows: people,
        // @ts-expect-error
        summaryRows: { top: 1 },
    },
    {
        columns,
        rows: people,
        // @ts-expect-error
        onRowMove: () => {},
    },
];
const rowFeatures = [
    rowExpansion(),
    rowGrouping(),
    summaryRows(),
    rowReorder(),
    cellSpans(),
] as const;
const Rows = typedDataGrid<Person, typeof rowFeatures>();
h(Rows.Root, {
    columns,
    rows: people,
    features: rowFeatures,
    expandedRowKeys: [],
    onExpandedRowKeysChange: (keys) => keys.length,
    detailHeight: (row) => row.name.length,
    defaultExpandedGroupKeys: [],
    summaryRows: { top: 1 },
    summaryRowHeight: 30,
    onRowMove: (move) => move.toIndex,
});
// their primitives are their entries' (the main namespace has none)
// @ts-expect-error
void DataGrid.RowDetail;
// @ts-expect-error
void DataGrid.Summary;
void RowDetail;
void Summary;

// their keys, through the composables' model
export const FeatureKeys = defineComponent(() => {
    const plain = useDataGrid<Person>();
    // @ts-expect-error
    plain.model.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
    // @ts-expect-error
    plain.model.run("selected-rows.set", { rowKeys: [] });
    // @ts-expect-error
    plain.model.get("selected-range");
    // @ts-expect-error
    plain.model.is("row-selected", { rowIndex: 0 });
    // @ts-expect-error
    plain.model.run("editing-cell.clear", {});
    useDataGrid<Person, typeof editable>().model.run("editing-cell.clear", {});
    useDataGrid<Person, typeof navigated>().model.run("active-position.set", {
        rowIndex: 0,
        columnIndex: 0,
    });
    const selection = useDataGrid<Person, typeof selectable>();
    selection.model.run("selected-rows.set", { rowKeys: [] });
    selection.model.is("row-selected", { rowIndex: 0 });
    useDataGrid<Person, typeof ranged>().model.get("selected-range");
    // @ts-expect-error
    plain.model.run("expanded-rows.toggle", { rowIndex: 0 });
    // @ts-expect-error
    plain.model.run("summary-rows.set", { top: 1 });
    const rowed = useDataGrid<Person, typeof rowFeatures>();
    rowed.model.run("expanded-rows.toggle", { rowIndex: 0 });
    rowed.model.run("row-groups.toggle", { groupKey: "g" });
    rowed.model.get("cell-span-by", { rowIndex: 0, columnIndex: 0 });
    rowed.model.is("row-movable", { rowIndex: 0 });
    return () => null;
});
