// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.
// A grid's keys and root props are the core's and its installed features' (Epic #141).

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
import { type SortColumn, sorting } from "../../src/sorting";

interface Person {
    name: string;
    age: number;
}

const columns: Column<Person>[] = [{ key: "age", width: 60, sortable: true }];
const rows: Person[] = [];

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
bare.run("active-position.clear");

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
sorted.run("active-position.clear");
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

// a model's type carries its features
const typed: DataGridModel<
    Person,
    unknown,
    readonly [ReturnType<typeof sorting>]
> = sorted;

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

void [sort, sortedState, person, engine, typed, withoutSort, merged];
