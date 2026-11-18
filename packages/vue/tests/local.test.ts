import { describe, expect, it } from "vitest";
import {
    defineComponent,
    h,
    type PropType,
    shallowRef,
    type VNodeChild,
} from "vue";
import {
    type CellInfo,
    type Column,
    createDataGridRef,
    type HeaderCellInfo,
    type RowInfo,
    typedDataGrid,
} from "../src";
import { filtering } from "../src/filtering";
import { type LocalRowsResult, useLocalRows } from "../src/local";
import { pagination } from "../src/pagination";
import { search } from "../src/search";
import { type SortColumn, sorting } from "../src/sorting";
import {
    click,
    headerAt,
    renderGrid,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// One composable for rows in memory (Epic #47, L1): its props bound onto Root make the header sort
// the rows, and its controls filter, search and page what the grid shows.

interface Person {
    id: number;
    name: string;
    age: number;
    team: string;
}

const FEATURES = [sorting(), filtering(), search(), pagination()] as const;

const G = typedDataGrid<Person, typeof FEATURES>();

const people: Person[] = [
    { id: 1, name: "Carla", age: 41, team: "Core" },
    { id: 2, name: "Ana", age: 29, team: "Design" },
    { id: 3, name: "Bruno", age: 35, team: "Core" },
    { id: 4, name: "Davi", age: 23, team: "Growth" },
    { id: 5, name: "Élodie", age: 35, team: "Design" },
];

const columns: Column<Person, VNodeChild>[] = [
    { key: "name", name: "Name", width: 120, sortable: true },
    { key: "age", name: "Age", width: 80, sortable: true },
    { key: "team", name: "Team", width: 120 },
];

stubViewportSize(400, 400);

let latest: LocalRowsResult<Person> | undefined;

const People = defineComponent({
    props: {
        rows: { type: Array as PropType<Person[]>, default: () => people },
        pageSize: { type: Number, default: undefined },
        table: { type: Boolean, default: false },
    },
    setup(props) {
        const local = useLocalRows(
            () => props.rows,
            columns,
            () => ({ features: FEATURES, pageSize: props.pageSize }),
        );
        latest = local;
        return () => {
            const tag = tags(props.table);
            const row = ({ row }: { row: RowInfo<Person> }) => [
                h(
                    G.Row,
                    { row, as: tag.row },
                    {
                        default: () => [
                            h(G.Cells, null, {
                                default: ({
                                    cell,
                                }: {
                                    cell: CellInfo<Person>;
                                }) => [h(G.Cell, { cell, as: tag.cell })],
                            }),
                        ],
                    },
                ),
            ];
            const header = () =>
                h(
                    G.HeaderRow,
                    { as: tag.headerRow },
                    {
                        default: () => [
                            h(G.HeaderCells, null, {
                                default: ({
                                    cell,
                                }: {
                                    cell: HeaderCellInfo<Person>;
                                }) => [
                                    h(G.HeaderCell, {
                                        cell,
                                        as: tag.headerCell,
                                    }),
                                ],
                            }),
                        ],
                    },
                );
            return h(
                G.Root,
                { columns, rowHeight: 20, features: FEATURES, ...local.props },
                {
                    default: () => [
                        h(
                            G.Grid,
                            { as: tag.grid },
                            {
                                default: () => [
                                    h(
                                        G.Header,
                                        { as: tag.header },
                                        { default: () => [header()] },
                                    ),
                                    h(
                                        G.Body,
                                        { as: tag.body },
                                        {
                                            default: () => [
                                                h(G.Rows, null, {
                                                    default: row,
                                                }),
                                            ],
                                        },
                                    ),
                                ],
                            },
                        ),
                    ],
                },
            );
        };
    },
});

/** The names the grid renders, in order. */
function names(container: HTMLElement): string[] {
    return [
        ...container.querySelectorAll(
            '[data-grid-part="cell"][data-column-index="0"]',
        ),
    ].map((cell) => cell.textContent ?? "");
}

/** The button whose text is `text`. */
function button(container: HTMLElement, text: string): HTMLElement {
    const found = [...container.querySelectorAll("button")].find(
        (element) => element.textContent === text,
    );
    if (!found) throw new Error(`no ${text} button`);
    return found;
}

for (const table of [false, true]) {
    describe(`useLocalRows, as ${table ? "a table" : "divs"}`, () => {
        it("sorts the rows when the header is clicked, through the spread props", async () => {
            const { container } = renderGrid(() => h(People, { table }));
            await settled();
            expect(names(container)).toEqual(people.map((row) => row.name));
            click(headerAt(container, 0));
            await settled();
            expect(names(container)).toEqual([
                "Ana",
                "Bruno",
                "Carla",
                "Davi",
                "Élodie",
            ]);
            expect(headerAt(container, 0)).toHaveAttribute(
                "aria-sort",
                "ascending",
            );
            click(headerAt(container, 1));
            await settled();
            expect(names(container)).toEqual([
                "Davi",
                "Ana",
                "Bruno",
                "Élodie",
                "Carla",
            ]);
            click(headerAt(container, 1));
            await settled();
            expect(names(container)[0]).toBe("Carla");
            expect(latest?.sort.columns).toEqual([
                { columnKey: "age", direction: "descending" },
            ]);
        });

        it("filters, searches and pages what the grid shows, back to the first page on a filter", async () => {
            const { container } = renderGrid(() =>
                h(People, { table, pageSize: 2 }),
            );
            await settled();
            expect(names(container)).toEqual(["Carla", "Ana"]);
            expect(latest?.page).toMatchObject({
                index: 0,
                count: 3,
                canNext: true,
            });
            latest?.page.next();
            await settled();
            expect(names(container)).toEqual(["Bruno", "Davi"]);
            latest?.page.last();
            await settled();
            expect(names(container)).toEqual(["Élodie"]);
            expect(latest?.page.canNext).toBe(false);
            latest?.filter.set("team", ["Core", "Design"]);
            await settled();
            expect(latest?.page.index).toBe(0);
            expect(latest?.filteredCount).toBe(4);
            expect(names(container)).toEqual(["Carla", "Ana"]);
            latest?.filter.setSearch("elo");
            await settled();
            expect(names(container)).toEqual(["Élodie"]);
            expect(latest).toMatchObject({ total: 5, filteredCount: 1 });
            latest?.filter.clear();
            latest?.filter.setSearch("");
            latest?.page.setSize(undefined);
            await settled();
            expect(names(container)).toHaveLength(5);
        });
    });
}

describe("useLocalRows across renders", () => {
    it("keeps the sort, the filters and the page (inside the pages left) when the rows change", async () => {
        const Deleting = defineComponent({
            setup() {
                const rows = shallowRef(people);
                const local = useLocalRows(() => rows.value, columns, {
                    features: FEATURES,
                    pageSize: 2,
                    defaultSortColumns: [
                        { columnKey: "name", direction: "ascending" },
                    ],
                });
                latest = local;
                return () => [
                    h(
                        "button",
                        {
                            type: "button",
                            onClick: () => {
                                rows.value = rows.value.slice(0, 3);
                            },
                        },
                        "delete",
                    ),
                    h(
                        "button",
                        {
                            type: "button",
                            onClick: () => {
                                rows.value = people;
                            },
                        },
                        "restore",
                    ),
                    h(
                        G.Root,
                        { columns, features: FEATURES, ...local.props },
                        {
                            default: () => [
                                h(G.Grid, null, {
                                    default: () => [h(G.Body)],
                                }),
                            ],
                        },
                    ),
                ];
            },
        });
        const { container } = renderGrid(Deleting);
        await settled();
        latest?.page.last();
        await settled();
        expect(names(container)).toEqual(["Élodie"]);
        click(button(container, "delete"));
        await settled();
        // Carla, Ana, Bruno left: sorted, on the last page there is
        expect(latest?.page).toMatchObject({ index: 1, count: 2 });
        expect(names(container)).toEqual(["Carla"]);
        // the page shown is the page: rows growing back leave the view there
        click(button(container, "restore"));
        await settled();
        expect(latest?.page).toMatchObject({ index: 1, count: 3 });
        expect(latest?.sort.columns).toEqual([
            { columnKey: "name", direction: "ascending" },
        ]);
    });

    it("follows a new pageSize", async () => {
        const pageSize = shallowRef(2);
        const { container } = renderGrid(() =>
            h(People, { pageSize: pageSize.value }),
        );
        await settled();
        expect(names(container)).toHaveLength(2);
        pageSize.value = 4;
        await settled();
        expect(latest?.page).toMatchObject({ size: 4, count: 2 });
        expect(names(container)).toHaveLength(4);
    });

    it("hands the grid the same onSortColumnsChange on every render", async () => {
        const seen = new Set<(sortColumns: readonly SortColumn[]) => void>();
        const Watch = defineComponent({
            setup() {
                const local = useLocalRows(people, columns, {
                    features: FEATURES,
                });
                return () => {
                    seen.add(local.props.onSortColumnsChange);
                    return h(
                        G.Root,
                        { columns, features: FEATURES, ...local.props },
                        {
                            default: () => [
                                h(G.Grid, null, {
                                    default: () => [h(G.Header)],
                                }),
                            ],
                        },
                    );
                };
            },
        });
        const { container } = renderGrid(Watch);
        await settled();
        click(headerAt(container, 0));
        await settled();
        click(headerAt(container, 1));
        await settled();
        expect(seen.size).toBe(1);
    });
});

describe("useLocalRows over the features (Epic #153)", () => {
    it("hands the root's model the state and takes a command run on it back; skips a stage not installed", async () => {
        const gridRef = createDataGridRef<Person, typeof FEATURES>();
        let sortedOnly: LocalRowsResult<Person> | undefined;
        const Grids = defineComponent({
            setup() {
                const local = useLocalRows(people, columns, {
                    features: FEATURES,
                    pageSize: 2,
                    defaultFilters: { team: "Core" },
                });
                latest = local;
                // without filtering nor pagination: every row
                sortedOnly = useLocalRows(people, columns, {
                    features: [sorting()],
                    pageSize: 2,
                    defaultFilters: { team: "Core" },
                }) as LocalRowsResult<Person>;
                return () =>
                    h(G.Root, {
                        columns,
                        features: FEATURES,
                        gridRef,
                        ...local.props,
                    });
            },
        });
        renderGrid(Grids);
        await settled();
        expect(sortedOnly?.rows).toHaveLength(5);
        expect(Object.keys(sortedOnly?.props ?? {}).sort()).toEqual([
            "onSortColumnsChange",
            "rows",
            "sortColumns",
        ]);
        const model = gridRef.current?.model;
        expect(model?.get("column-filters")).toEqual({ team: "Core" });
        expect(model?.get("page-info").pageCount).toBe(1);
        model?.run("column-filters.clear", undefined);
        await settled();
        expect(latest?.rows.map((row) => row.name)).toEqual(["Carla", "Ana"]);
        expect(model?.get("page-count")).toBe(3);
        model?.run("page.set", { pageIndex: 2 });
        await settled();
        expect(latest?.page.index).toBe(2);
        model?.run("search.set", { text: "an" });
        await settled();
        expect(latest?.rows.map((row) => row.name)).toEqual(["Ana"]);
        expect(model?.get("page-info").pageIndex).toBe(0);
    });
});
