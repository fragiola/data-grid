import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Column, ColumnOrGroup } from "../../src";
import {
    compareValues,
    createLocalRows,
    filterRows,
    isEmptyValue,
    matchesFilter,
    pageCount,
    pageRows,
    searchRows,
    sortRows,
} from "../../src/local";

// The local pipeline (Epic #47, L4–L7): rows in memory, filtered, searched, sorted and paged, each
// stage computed again only when its own inputs change.

interface Person {
    id: number;
    name: string;
    city: string | null;
    age: number;
    joined: Date;
    tags: string[];
}

const people: Person[] = [
    {
        id: 1,
        name: "Élodie",
        city: "Paris",
        age: 31,
        joined: new Date(2020, 0, 1),
        tags: ["a"],
    },
    {
        id: 2,
        name: "bruno",
        city: "Lisboa",
        age: 9,
        joined: new Date(2019, 5, 1),
        tags: ["b"],
    },
    {
        id: 3,
        name: "Ana",
        city: null,
        age: 31,
        joined: new Date(2021, 2, 1),
        tags: ["a", "c"],
    },
    {
        id: 4,
        name: "item 10",
        city: "Porto",
        age: 70,
        joined: new Date(2018, 1, 1),
        tags: [],
    },
    {
        id: 5,
        name: "item 2",
        city: "",
        age: 18,
        joined: new Date(2022, 7, 1),
        tags: ["c"],
    },
];

const columns: Column<Person>[] = [
    { key: "name", width: 100, sortable: true },
    { key: "city", width: 100, sortable: true },
    { key: "age", width: 100, sortable: true },
    { key: "joined", width: 100, sortable: true },
    { key: "tags", width: 100 },
    {
        key: "decade",
        width: 100,
        sortable: true,
        getValue: (row) => Math.floor(row.age / 10) * 10,
    },
];

const ids = (rows: readonly Person[]) => rows.map((row) => row.id);

describe("comparing values", () => {
    it("compares by type: numbers, dates, booleans, then text in the reader's order", () => {
        expect(compareValues(2, 10)).toBeLessThan(0);
        expect(compareValues(10n, 2)).toBeGreaterThan(0);
        expect(
            compareValues(new Date(2020, 0, 1), new Date(2019, 0, 1)),
        ).toBeGreaterThan(0);
        expect(compareValues(false, true)).toBeLessThan(0);
        expect(compareValues("item 2", "item 10")).toBeLessThan(0);
        expect(compareValues("ana", "Ana")).toBe(0);
        expect(compareValues("é", "e")).toBe(0);
        // different types: numbers first
        expect(compareValues(5, "a")).toBeLessThan(0);
    });

    it("knows what is empty", () => {
        for (const value of [
            undefined,
            null,
            "",
            Number.NaN,
            new Date("nope"),
        ]) {
            expect(isEmptyValue(value)).toBe(true);
        }
        for (const value of [0, false, " ", [], new Date(0)]) {
            expect(isEmptyValue(value)).toBe(false);
        }
    });
});

describe("sorting", () => {
    it("sorts by a column's values, both ways, empty values last either way", () => {
        const up = sortRows(
            people,
            [{ columnKey: "city", direction: "ascending" }],
            columns,
        );
        expect(up.map((row) => row.city)).toEqual([
            "Lisboa",
            "Paris",
            "Porto",
            null,
            "",
        ]);
        const down = sortRows(
            people,
            [{ columnKey: "city", direction: "descending" }],
            columns,
        );
        expect(down.map((row) => row.city)).toEqual([
            "Porto",
            "Paris",
            "Lisboa",
            null,
            "",
        ]);
    });

    it("sorts text in the reader's order and dates by time", () => {
        expect(
            ids(
                sortRows(
                    people,
                    [{ columnKey: "name", direction: "ascending" }],
                    columns,
                ),
            ),
        ).toEqual([3, 2, 1, 5, 4]);
        expect(
            ids(
                sortRows(
                    people,
                    [{ columnKey: "joined", direction: "ascending" }],
                    columns,
                ),
            ),
        ).toEqual([4, 2, 1, 3, 5]);
    });

    it("breaks ties with the next columns, keeps the input order last (stable), reads getValue", () => {
        // ages 31 and 31 tie: by name descending, Élodie before Ana
        expect(
            ids(
                sortRows(
                    people,
                    [
                        { columnKey: "age", direction: "descending" },
                        { columnKey: "name", direction: "descending" },
                    ],
                    columns,
                ),
            ),
        ).toEqual([4, 1, 3, 5, 2]);
        // decades 30 and 30 tie, nothing else: the input order
        expect(
            ids(
                sortRows(
                    people,
                    [{ columnKey: "decade", direction: "ascending" }],
                    columns,
                ),
            ),
        ).toEqual([2, 5, 1, 3, 4]);
    });

    it("uses a column's compare, in the direction asked", () => {
        const byNameLength: Column<Person>[] = [
            {
                key: "name",
                width: 100,
                compare: (a, b) => a.name.length - b.name.length,
            },
        ];
        expect(
            ids(
                sortRows(
                    people,
                    [{ columnKey: "name", direction: "ascending" }],
                    byNameLength,
                ),
            ),
        ).toEqual([3, 2, 1, 5, 4]);
        expect(
            ids(
                sortRows(
                    people,
                    [{ columnKey: "name", direction: "descending" }],
                    byNameLength,
                ),
            ),
        ).toEqual([4, 1, 5, 2, 3]);
    });

    it("skips a key no column has, reads columns under groups, and leaves the input alone", () => {
        const grouped: ColumnOrGroup<Person>[] = [
            { key: "who", children: columns },
        ];
        const input = [...people];
        expect(
            ids(
                sortRows(
                    input,
                    [
                        { columnKey: "nope", direction: "ascending" },
                        { columnKey: "age", direction: "ascending" },
                    ],
                    grouped,
                ),
            ),
        ).toEqual([2, 5, 1, 3, 4]);
        expect(input).toEqual(people);
    });
});

describe("filtering", () => {
    it("matches a text by containing it, case and accents aside", () => {
        expect(matchesFilter("Élodie", "elo")).toBe(true);
        expect(matchesFilter("Lisboa", "BOA")).toBe(true);
        expect(matchesFilter(31, "3")).toBe(true);
        expect(matchesFilter(null, "a")).toBe(false);
    });

    it("matches a list by holding the value, or one of a cell's values", () => {
        expect(matchesFilter("Paris", ["Porto", "Paris"])).toBe(true);
        expect(matchesFilter("Pa", ["Paris"])).toBe(false);
        expect(matchesFilter(["a", "c"], ["c"])).toBe(true);
        expect(matchesFilter([], ["c"])).toBe(false);
    });

    it("matches anything else by equality, dates by time; an empty filter matches all", () => {
        expect(matchesFilter(31, 31)).toBe(true);
        expect(matchesFilter(31, 3)).toBe(false);
        expect(matchesFilter(new Date(2020, 0, 1), new Date(2020, 0, 1))).toBe(
            true,
        );
        for (const empty of [undefined, null, "", []]) {
            expect(matchesFilter("x", empty)).toBe(true);
        }
    });

    it("keeps the rows passing every column's filter, ignoring unknown and empty ones", () => {
        expect(
            ids(filterRows(people, { age: 31, name: "a" }, columns)),
        ).toEqual([3]);
        expect(ids(filterRows(people, { tags: ["a"] }, columns))).toEqual([
            1, 3,
        ]);
        expect(
            ids(filterRows(people, { nope: "x", city: "" }, columns)),
        ).toEqual(ids(people));
    });

    it("uses a column's filter with the cell's value, the filter value and the row", () => {
        const filter = vi.fn(
            (value: unknown, range: unknown) =>
                typeof value === "number" &&
                typeof range === "object" &&
                range !== null &&
                "min" in range &&
                typeof range.min === "number" &&
                value >= range.min,
        );
        const ranged: Column<Person>[] = [{ key: "age", width: 100, filter }];
        expect(ids(filterRows(people, { age: { min: 30 } }, ranged))).toEqual([
            1, 3, 4,
        ]);
        expect(filter).toHaveBeenCalledWith(31, { min: 30 }, people[0]);
    });

    it("searches every column's value as text", () => {
        expect(ids(searchRows(people, "port", columns))).toEqual([4]);
        expect(ids(searchRows(people, "ELO", columns))).toEqual([1]);
        // a getValue counts: decade 70
        expect(ids(searchRows(people, "70", columns))).toEqual([4]);
        expect(ids(searchRows(people, "   ", columns))).toEqual(ids(people));
    });
});

describe("odd input", () => {
    it("takes an invalid date as empty: last in a sort, nothing to search, no throw", () => {
        const dated = people.map((row) =>
            row.id === 2 ? { ...row, joined: new Date("not a date") } : row,
        );
        const sorted = sortRows(
            dated,
            [{ columnKey: "joined", direction: "ascending" }],
            columns,
        );
        expect(ids(sorted)).toEqual([4, 1, 3, 5, 2]);
        expect(() => searchRows(dated, "2020", columns)).not.toThrow();
        expect(ids(searchRows(dated, "2020", columns))).toEqual([1]);
    });

    it("finds no inherited function behind a column keyed like one", () => {
        const odd: Column<Person>[] = [
            { key: "constructor", width: 100, getValue: (row) => row.name },
            { key: "toString", width: 100, getValue: (row) => row.city },
        ];
        expect(ids(filterRows(people, {}, odd))).toEqual(ids(people));
    });

    it("keeps a page index that is not a number on the first page", () => {
        const local = createLocalRows<Person>({
            pageSize: 2,
            defaultPageIndex: Number.NaN,
        });
        expect(local.derive(people, columns).pageIndex).toBe(0);
        local.setPageIndex(1);
        local.setPageIndex(Number.POSITIVE_INFINITY);
        expect(local.state.pageIndex).toBe(0);
    });
});

describe("pages", () => {
    it("counts and cuts pages, keeping the index inside them", () => {
        expect(pageCount(5, 2)).toBe(3);
        expect(pageCount(0, 2)).toBe(1);
        expect(pageCount(5, undefined)).toBe(1);
        expect(ids(pageRows(people, 1, 2))).toEqual([3, 4]);
        expect(ids(pageRows(people, 9, 2))).toEqual([5]);
        expect(ids(pageRows(people, 0, undefined))).toEqual(ids(people));
    });
});

describe("the pipeline", () => {
    it("filters, searches, sorts and pages, with the counts", () => {
        const local = createLocalRows<Person>({
            defaultSortColumns: [{ columnKey: "age", direction: "ascending" }],
            pageSize: 2,
        });
        const first = local.derive(people, columns);
        expect(ids(first.rows)).toEqual([2, 5]);
        expect(first).toMatchObject({
            total: 5,
            filteredCount: 5,
            pageIndex: 0,
            pageCount: 3,
        });
        local.setPageIndex(2);
        expect(ids(local.derive(people, columns).rows)).toEqual([4]);
        local.setFilter("tags", ["a", "c"]);
        // a filter goes back to the first page: 5, 1, 3 by age
        const filtered = local.derive(people, columns);
        expect(filtered.pageIndex).toBe(0);
        expect(filtered.filteredCount).toBe(3);
        expect(ids(filtered.rows)).toEqual([5, 1]);
        local.setSearch("ana");
        expect(ids(local.derive(people, columns).rows)).toEqual([3]);
        local.clearFilters();
        local.setSearch("");
        expect(local.derive(people, columns).filteredCount).toBe(5);
    });

    it("keeps the page inside the pages left when the rows shrink", () => {
        const local = createLocalRows<Person>({ pageSize: 2 });
        local.setPageIndex(2);
        const view = local.derive(people.slice(0, 3), columns);
        expect(view.pageIndex).toBe(1);
        expect(ids(view.rows)).toEqual([3]);
    });

    it("tells its listeners on a change, never for the same state", () => {
        const local = createLocalRows<Person>({ pageSize: 2 });
        const listener = vi.fn();
        local.subscribe(listener);
        const state = local.state;
        local.setSearch("");
        local.setFilter("name", "");
        local.clearFilters();
        local.setPageIndex(0);
        expect(listener).not.toHaveBeenCalled();
        expect(local.state).toBe(state);
        local.setFilter("name", "a");
        local.setPageSize(3);
        expect(listener).toHaveBeenCalledTimes(2);
        expect(local.state.filters).toEqual({ name: "a" });
        expect(local.state.pageSize).toBe(3);
        local.setFilter("name", undefined);
        expect(local.state.filters).toEqual({});
    });

    it("computes a stage again only when its own inputs change", () => {
        const compare = vi.fn((a: Person, b: Person) => a.age - b.age);
        const filter = vi.fn((value: unknown) => value !== "Porto");
        const counted: Column<Person>[] = [
            { key: "age", width: 100, compare },
            { key: "city", width: 100, filter },
        ];
        const local = createLocalRows<Person>({
            defaultSortColumns: [{ columnKey: "age", direction: "ascending" }],
            defaultFilters: { city: "any" },
            pageSize: 2,
        });
        const first = local.derive(people, counted);
        const sorts = compare.mock.calls.length;
        const filters = filter.mock.calls.length;
        expect(sorts).toBeGreaterThan(0);
        expect(filters).toBe(people.length);
        // nothing changed: the same object, nothing computed
        expect(local.derive(people, counted)).toBe(first);
        // a page turn neither filters nor sorts again
        local.setPageIndex(1);
        local.derive(people, counted);
        expect(compare.mock.calls.length).toBe(sorts);
        expect(filter.mock.calls.length).toBe(filters);
        // a sort sorts again, and does not filter again
        local.setSortColumns([{ columnKey: "age", direction: "descending" }]);
        local.derive(people, counted);
        expect(compare.mock.calls.length).toBeGreaterThan(sorts);
        expect(filter.mock.calls.length).toBe(filters);
        // new rows go through every stage
        local.derive([...people], counted);
        expect(filter.mock.calls.length).toBe(filters * 2);
    });
});

describe("the entry point", () => {
    it("is not part of the grid's own entry", () => {
        const main = readFileSync(
            join(import.meta.dirname, "../../src/index.ts"),
            "utf8",
        );
        expect(main).not.toMatch(/["']\.\/local/);
    });
});
