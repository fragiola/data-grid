import { describe, expect, it, vi } from "vitest";
import { bindGridRoot, type DataGridFeatures } from "../../src";
import { filtering } from "../../src/filtering";
import {
    createLocalRows,
    type LocalRowsInputs,
    localRowsResult,
    localStagesOf,
} from "../../src/local";
import { pagination } from "../../src/pagination";
import { rowGrouping } from "../../src/row-grouping";
import { search } from "../../src/search";
import { sorting } from "../../src/sorting";

// `/local` over the features (Epic #153): each stage is its feature's, skipped when the feature
// is not installed; the props carry the state of the features it runs, for the root's model to
// hold, and a command run on the model comes back to the pipeline.

interface Person {
    name: string;
    team: string;
}

const people: Person[] = [
    { name: "Ada", team: "Data" },
    { name: "Bob", team: "Design" },
    { name: "Cy", team: "Data" },
    { name: "Di", team: "Design" },
];

const columns = [
    { key: "name", width: 100, sortable: true },
    { key: "team", width: 100 },
];

const ALL = [sorting(), filtering(), search(), pagination()] as const;

/** The result `useLocalRows` would give for a pipeline, its rows and the features. */
function resultOf<const F extends DataGridFeatures = []>(
    local: ReturnType<typeof createLocalRows<Person>>,
    features: F,
    groupBy: readonly string[] = [],
) {
    const view = local.derive(people, columns, { groupBy });
    const inputs: LocalRowsInputs<Person> = {
        local,
        state: local.state,
        view,
        expandedGroupKeys: [],
        groupBy,
        rowKey: undefined,
        setExpanded: () => {},
        subRowKeysOf: () => [],
        moveRow: () => people,
        features,
    };
    return localRowsResult<Person, F>(inputs);
}

describe("the local pipeline's stages", () => {
    it("are the installed features'", () => {
        expect(localStagesOf([])).toEqual({
            sort: false,
            filter: false,
            search: false,
            page: false,
        });
        expect(localStagesOf([sorting(), pagination()])).toEqual({
            sort: true,
            filter: false,
            search: false,
            page: true,
        });
        expect(localStagesOf(ALL)).toEqual({
            sort: true,
            filter: true,
            search: true,
            page: true,
        });
    });

    it("skips a stage whose feature is not installed, its state kept", () => {
        const local = createLocalRows<Person>({
            stages: localStagesOf([sorting()]),
            defaultSortColumns: [
                { columnKey: "name", direction: "descending" },
            ],
            defaultFilters: { team: "Data" },
            defaultSearch: "a",
            pageSize: 1,
        });
        const view = local.derive(people, columns);
        expect(view.rows.map((row) => row.name)).toEqual([
            "Di",
            "Cy",
            "Bob",
            "Ada",
        ]);
        expect(view.pageCount).toBe(1);
        expect(local.state.filters).toEqual({ team: "Data" });
        // without the option, every stage (the pipeline on its own)
        const alone = createLocalRows<Person>({
            defaultFilters: { team: "Data" },
            pageSize: 1,
        });
        expect(alone.derive(people, columns).rows).toEqual([people[0]]);
    });
});

describe("the local props", () => {
    it("carry the state of the features installed, and none other", () => {
        const local = createLocalRows<Person>({ stages: localStagesOf([]) });
        expect(Object.keys(resultOf(local, []).props)).toEqual(["rows"]);
        expect(Object.keys(resultOf(local, [sorting()]).props).sort()).toEqual([
            "onSortColumnsChange",
            "rows",
            "sortColumns",
        ]);
        const all = createLocalRows<Person>({
            stages: localStagesOf(ALL),
            pageSize: 3,
            defaultFilters: { team: "Data" },
            defaultSearch: "",
        });
        const { props } = resultOf(all, ALL);
        expect(props).toMatchObject({
            sortColumns: [],
            columnFilters: { team: "Data" },
            searchText: "",
            pageIndex: 0,
            pageSize: 3,
            totalRowCount: 2,
        });
        // no page size: `null`, a page size controlled as none
        const single = createLocalRows<Person>({ stages: localStagesOf(ALL) });
        expect(resultOf(single, ALL).props.pageSize).toBeNull();
    });

    it("carry the expanded groups grouped, with row grouping", () => {
        const local = createLocalRows<Person>({});
        const grouped = resultOf(local, [], ["team"]).props;
        expect("expandedGroupKeys" in grouped).toBe(false);
        expect(grouped.rowCount).toBe(2);
        const toggled = resultOf(local, [rowGrouping()], ["team"]).props;
        expect(toggled).toMatchObject({ expandedGroupKeys: [] });
    });

    it("bring a command run on the root's model back to the pipeline, the page first", () => {
        const local = createLocalRows<Person>({
            stages: localStagesOf(ALL),
            pageSize: 1,
            defaultPageIndex: 2,
        });
        const listener = vi.fn();
        local.subscribe(listener);
        const root = bindGridRoot(() => ({
            columns,
            features: ALL,
            ...resultOf(local, ALL).props,
        }));
        root.sync();
        expect(root.model.get("page-info")).toMatchObject({
            pageIndex: 2,
            pageSize: 1,
            pageCount: 4,
        });
        root.model.run("column-filter.set", {
            columnKey: "team",
            value: "Data",
        });
        expect(local.state.filters).toEqual({ team: "Data" });
        expect(local.state.pageIndex).toBe(0);
        expect(listener).toHaveBeenCalledTimes(1);
        root.model.run("search.set", { text: "cy" });
        expect(local.state.search).toBe("cy");
        root.model.run("page-size.set", { pageSize: undefined });
        expect(local.state.pageSize).toBeUndefined();
        root.model.run("sort-columns.toggle", { columnKey: "name" });
        expect(local.state.sortColumns).toEqual([
            { columnKey: "name", direction: "ascending" },
        ]);
    });
});
