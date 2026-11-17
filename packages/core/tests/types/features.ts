// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.
// A grid's keys and root props are the core's and its installed features' (Epic #141).

import type { CellPosition, CellRange, RowKey } from "../../src";
import {
    bindGridRoot,
    type Column,
    createDataGridEngine,
    createDataGridModel,
    type DataGridModel,
    defineFeature,
    type FeatureKeys,
    type FeatureTypes,
    type GridRootProps,
    type Middleware,
} from "../../src";
import { clipboard } from "../../src/clipboard";
import { fillHandle } from "../../src/fill";
import { navigation } from "../../src/navigation";
import { cellRange } from "../../src/range";
import { rowSelection } from "../../src/row-selection";
import { type SortColumn, sorting } from "../../src/sorting";

interface Person {
    name: string;
    age: number;
}

const columns: Column<Person>[] = [{ key: "age", width: 60, sortable: true }];
const rows: Person[] = [];
const origin = { rowIndex: 0, columnIndex: 0 };

// without sorting, its keys do not compile
const bare = createDataGridModel({ columns, rows });
// @ts-expect-error
bare.run("sort-columns.toggle", { columnKey: "age" });
// @ts-expect-error
bare.can("sort-columns.set", { sortColumns: [] });
// @ts-expect-error
bare.get("sort-columns");
// @ts-expect-error
bare.is("column-sortable", { columnKey: "age" });
// @ts-expect-error: its options neither
createDataGridModel({ columns, rows, sortColumns: [] });
bare.run("column-order.reset");

// with it, they do, typed
const sorted = createDataGridModel({
    columns,
    rows,
    features: [sorting()],
    sortColumns: [{ columnKey: "age", direction: "ascending" }],
});
sorted.run("sort-columns.toggle", { columnKey: "age", multi: true });
const sort: readonly SortColumn[] = sorted.get("sort-columns");
const sortedState: readonly SortColumn[] = sorted.state.sortColumns;
sorted.is("column-sortable", { columnKey: "age" });
sorted.run("sort-columns.set", {
    // @ts-expect-error: a direction that is not one
    sortColumns: [{ columnKey: "age", direction: "up" }],
});
// @ts-expect-error: a payload of the wrong shape
sorted.run("sort-columns.toggle", { column: "age" });
// the core's keys are still there, the row type still flows
sorted.run("column-order.reset");
const person: Person | undefined = sorted.get("row-by", { index: 0 });

// a middleware narrows a feature's commands too, and one written for any grid fits it
sorted.use((ctx, next) => {
    if (ctx.command === "sort-columns.toggle") {
        const columnKey: string = ctx.payload.columnKey;
        void columnKey;
    }
    return next();
});
declare const anyGrid: Middleware<Person>;
sorted.use(anyGrid);

// the engine takes a model with features
const engine = createDataGridEngine(sorted);

// a model's type carries its features, and a model of any features takes it, or a bare one
const typed: DataGridModel<
    Person,
    unknown,
    readonly [ReturnType<typeof sorting>]
> = sorted;
const anyFeatures: DataGridModel<Person> = sorted;
// a model of any features still checks the core's keys
// @ts-expect-error: a typo
anyFeatures.run("active-positon.clear");
// @ts-expect-error
anyFeatures.get("nope");
anyFeatures.run("column-order.reset");
const noFeatures: DataGridModel<Person> = bare;
// a middleware written for a grid without features fits one with them
declare const coreOnly: Middleware<Person, unknown, []>;
sorted.use(coreOnly);
bare.use((ctx, next) => {
    if (ctx.command === "column-widths.resize") {
        const width: number = ctx.payload.width;
        void width;
    }
    return next();
});

// a root's props: sorting's only with sorting installed
const withSort: GridRootProps<
    Person,
    unknown,
    readonly [ReturnType<typeof sorting>]
> = {
    columns,
    rows,
    features: [sorting()],
    sortColumns: [],
    onSortColumnsChange: (next) => next.map((entry) => entry.columnKey),
};
const withoutSort: GridRootProps<Person, unknown, []> = {
    columns,
    rows,
    // @ts-expect-error
    sortColumns: [],
};
const root = bindGridRoot(() => withSort);
root.model.run("sort-columns.toggle", { columnKey: "age" });

// Epic #144: navigation, row selection, cell ranges, the clipboard and the fill handle are
// features. Without them, their keys, options and root props do not compile
// @ts-expect-error
bare.run("active-position.set", { rowIndex: 0, columnIndex: 0 });
// @ts-expect-error
bare.get("active-position");
// @ts-expect-error
bare.is("cell-active", { rowIndex: 0, columnIndex: 0 });
// @ts-expect-error
bare.run("selected-rows.set", { rowKeys: [0] });
// @ts-expect-error
bare.get("selected-row-keys");
// @ts-expect-error
bare.is("row-selected", { rowIndex: 0 });
// @ts-expect-error
bare.run("selected-range.set", { anchor: origin, focus: origin });
// @ts-expect-error
bare.is("cell-selected", origin);
// @ts-expect-error
createDataGridModel({ columns, rows, activePosition: origin });
// @ts-expect-error
createDataGridModel({ columns, rows, rowSelection: "multiple" });
// @ts-expect-error
createDataGridModel({ columns, rows, cellSelection: "range" });
const bareRoot: GridRootProps<Person, unknown, []> = {
    columns,
    rows,
    // @ts-expect-error
    activePosition: origin,
};
const bareRows: GridRootProps<Person, unknown, []> = {
    columns,
    rows,
    // @ts-expect-error
    rowSelection: "multiple",
};
const bareRange: GridRootProps<Person, unknown, []> = {
    columns,
    rows,
    // @ts-expect-error
    cellSelection: "range",
};
// cell ranges without the clipboard or the fill handle: their props neither
const ranged = [navigation(), cellRange()] as const;
const noPaste: GridRootProps<Person, unknown, typeof ranged> = {
    columns,
    rows,
    features: ranged,
    // @ts-expect-error
    onRangePaste: () => {},
};
const noFill: GridRootProps<Person, unknown, typeof ranged> = {
    columns,
    rows,
    features: ranged,
    // @ts-expect-error
    onFill: () => {},
};

// with them, they do, typed
const features = [
    navigation(),
    rowSelection(),
    cellRange(),
    clipboard(),
    fillHandle(),
] as const;
const featured = createDataGridModel({
    columns,
    rows,
    features,
    activePosition: origin,
    rowSelection: "multiple",
    isRowSelectable: (row) => row.age > 0,
    cellSelection: "range",
});
featured.run("active-position.set", origin);
const active: CellPosition | null = featured.get("active-position");
featured.is("cell-active", origin);
featured.is("row-active", { rowIndex: 0 });
featured.run("selected-rows.set", { rowKeys: [0] });
const selectedKeys: readonly RowKey[] = featured.get("selected-row-keys");
featured.is("row-selected", { rowIndex: 0 });
featured.run("selected-range.set", { anchor: origin, focus: origin });
featured.is("cell-selected", origin);
const range: CellRange | null = featured.state.selectedRange;
// @ts-expect-error: a payload of the wrong shape
featured.run("active-position.set", { rowIndex: 0 });
// @ts-expect-error: not a row key
featured.run("selected-rows.set", { rowKeys: [{}] });
const featuredRoot: GridRootProps<Person, unknown, typeof features> = {
    columns,
    rows,
    features,
    activePosition: origin,
    onActivePositionChange: (position) => position?.rowIndex,
    rowSelection: "multiple",
    selectedRowKeys: [],
    onSelectedRowKeysChange: (keys) => keys.length,
    cellSelection: "range",
    selectedRange: null,
    onSelectedRangeChange: (next) => next?.anchor,
    onRangePaste: (paste) => paste.values,
    onFill: (fill) => fill.target,
};

// a feature of an app's own: its types read the grid's row type (`this["row"]`, at a member)
interface FlagQueries<TRow> {
    "first-flagged-row": { payload: undefined; result: TRow | undefined };
}
interface Flags extends FeatureTypes {
    readonly state: { readonly flagged: readonly number[] };
    readonly commands: {
        "flags.toggle": {
            payload: { readonly rowIndex: number };
            result: readonly number[];
        };
    };
    readonly queries: FlagQueries<this["row"]>;
}
const flags = defineFeature<Flags>({
    name: "flags",
    initial: () => ({ flagged: [] }),
    commands: {
        "flags.toggle": (state, { rowIndex }) => {
            const flagged = state.flagged.includes(rowIndex)
                ? state.flagged.filter((index) => index !== rowIndex)
                : [...state.flagged, rowIndex];
            return {
                ok: true,
                value: { state: { ...state, flagged }, value: flagged },
            };
        },
    },
});
const flagged = createDataGridModel({
    columns,
    rows,
    features: [flags, sorting()],
});
flagged.run("flags.toggle", { rowIndex: 1 });
flagged.run("sort-columns.toggle", { columnKey: "age" });
const first: Person | undefined = flagged.get("first-flagged-row");
type Merged = FeatureKeys<readonly [typeof flags], Person>["queries"];
const merged: Merged["first-flagged-row"]["result"] = first;

void [
    sort,
    sortedState,
    person,
    engine,
    typed,
    anyFeatures,
    noFeatures,
    withoutSort,
    merged,
    bareRoot,
    bareRows,
    bareRange,
    noPaste,
    noFill,
    active,
    selectedKeys,
    range,
    featuredRoot,
];
