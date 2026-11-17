import { describe, expect, it, vi } from "vitest";
import { mergeProps, shallowRef, type VNodeChild } from "vue";
import {
    type Column,
    createDataGridRef,
    type DataGridRef,
    type HeaderCellInfo,
    type RenderSlot,
    type RootState,
    typedDataGrid,
} from "../src";
import { type SortColumn, sorting } from "../src/sorting";
import {
    click,
    h,
    headerAt,
    keyDown,
    renderGrid,
    root,
    settled,
    stubViewportSize,
} from "./helpers";

// Sorting (Epic #27): `sortable` columns, the sort controlled or not like the active position
// (S5), toggled by a click, Enter or Space on a header cell after the consumer's handlers (S4),
// shown through aria-sort and data-* (S6). The grid never orders the rows (S7). A feature since
// Epic #141: the grid installs it (`features`), its props fallthrough attributes to Vue.

interface Person {
    id: number;
    name: string;
    age: number;
}

const FEATURES = [sorting()] as const;

const G = typedDataGrid<Person, typeof FEATURES>();

const people: Person[] = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
    age: 20 + (i % 7),
}));

const columns: Column<Person, VNodeChild>[] = [
    { key: "name", name: "Name", width: 150, sortable: true },
    { key: "age", name: "Age", width: 80, sortable: true },
    {
        key: "id",
        name: "Id",
        width: 80,
        renderHeaderCell: () => [
            "Id ",
            h("button", { type: "button" }, "menu"),
        ],
    },
];

stubViewportSize(400, 235);

interface GridProps {
    sortColumns?: readonly SortColumn[];
    defaultSortColumns?: readonly SortColumn[];
    onSortColumnsChange?: (sortColumns: readonly SortColumn[]) => void;
    onClick?: (event: MouseEvent) => void;
    /** the root's element: a `render` slot of the consumer's */
    renderRoot?: RenderSlot<RootState>["render"];
    gridRef?: DataGridRef<Person, typeof FEATURES>;
    cells?: Column<Person, VNodeChild>[];
    table?: boolean;
}

function grid({ cells = columns, table, renderRoot, ...props }: GridProps) {
    const rootProps = {
        columns: cells,
        rows: people,
        rowHeight: 20,
        features: FEATURES,
        ...props,
    };
    const slots = renderRoot ? { render: renderRoot } : {};
    return table
        ? h(G.Root, rootProps, {
              ...slots,
              default: () => [
                  h(G.Grid, { as: "table" }, () => [
                      h(G.Header, { as: "thead" }, () => [
                          h(G.HeaderRow, { as: "tr" }, () => [
                              h(G.HeaderCells, null, {
                                  default: ({
                                      cell,
                                  }: {
                                      cell: HeaderCellInfo<Person>;
                                  }) => [h(G.HeaderCell, { cell, as: "th" })],
                              }),
                          ]),
                      ]),
                      h(G.Body, { as: "tbody" }),
                  ]),
              ],
          })
        : h(G.Root, rootProps, {
              ...slots,
              default: () => [h(G.Grid, null, () => [h(G.Header), h(G.Body)])],
          });
}

/** Mounts the grid with `props`; `update` gives it new ones (a parent re-rendering). */
function mountGrid(props: GridProps = {}) {
    const current = shallowRef(props);
    const mounted = renderGrid(() => grid(current.value));
    return {
        ...mounted,
        update: async (next: GridProps) => {
            current.value = next;
            await settled();
        },
    };
}

/** Each header cell's sort, as its attributes show it. */
function shown(container: HTMLElement) {
    return [0, 1, 2].map((columnIndex) => {
        const cell = headerAt(container, columnIndex);
        return [
            cell.getAttribute("aria-sort"),
            cell.getAttribute("data-sort"),
            cell.getAttribute("data-sort-priority"),
            cell.hasAttribute("data-sortable"),
        ];
    });
}

describe("uncontrolled", () => {
    it("toggles on a click, tells the change, and shows it", async () => {
        const onSortColumnsChange = vi.fn();
        const { container } = mountGrid({ onSortColumnsChange });
        await settled();
        expect(shown(container)).toEqual([
            [null, null, null, true],
            [null, null, null, true],
            [null, null, null, false],
        ]);
        click(headerAt(container, 0));
        await settled();
        expect(onSortColumnsChange).toHaveBeenLastCalledWith([
            { columnKey: "name", direction: "ascending" },
        ]);
        expect(shown(container)[0]).toEqual([
            "ascending",
            "ascending",
            "1",
            true,
        ]);
        click(headerAt(container, 0));
        await settled();
        expect(shown(container)[0]).toEqual([
            "descending",
            "descending",
            "1",
            true,
        ]);
    });

    it("adds a column with Ctrl, aria-sort staying on the first one", async () => {
        const { container } = mountGrid({
            defaultSortColumns: [{ columnKey: "age", direction: "descending" }],
        });
        await settled();
        click(headerAt(container, 0), { ctrlKey: true });
        await settled();
        expect(shown(container)).toEqual([
            [null, "ascending", "2", true],
            ["descending", "descending", "1", true],
            [null, null, null, false],
        ]);
    });

    it("toggles on Enter and Space on the active header cell", async () => {
        const { container } = mountGrid();
        await settled();
        const name = headerAt(container, 0);
        name.focus();
        await settled();
        keyDown(name, { key: "Enter" });
        await settled();
        expect(shown(container)[0]?.[1]).toBe("ascending");
        keyDown(headerAt(container, 0), { key: " " });
        await settled();
        expect(shown(container)[0]?.[1]).toBe("descending");
    });

    it("tells the app when its starting sort names a column that is not sortable", async () => {
        const onSortColumnsChange = vi.fn();
        mountGrid({
            defaultSortColumns: [
                { columnKey: "id", direction: "ascending" },
                { columnKey: "age", direction: "descending" },
            ],
            onSortColumnsChange,
        });
        await settled();
        expect(onSortColumnsChange).toHaveBeenCalledTimes(1);
        expect(onSortColumnsChange).toHaveBeenCalledWith([
            { columnKey: "age", direction: "descending" },
        ]);
    });

    it("leaves a control inside a header cell its own clicks", async () => {
        const onSortColumnsChange = vi.fn();
        const { container } = mountGrid({
            cells: [
                {
                    key: "name",
                    width: 150,
                    sortable: true,
                    renderHeaderCell: () => [
                        "Name ",
                        h("button", { type: "button" }, "menu"),
                    ],
                },
            ],
            onSortColumnsChange,
        });
        await settled();
        const button = headerAt(container, 0).querySelector("button");
        if (!button) throw new Error("no button");
        click(button);
        await settled();
        expect(onSortColumnsChange).not.toHaveBeenCalled();
    });
});

describe("controlled", () => {
    it("asks on a click, and shows the sort only when the prop follows", async () => {
        const onSortColumnsChange = vi.fn();
        const { container, update } = mountGrid({
            sortColumns: [],
            onSortColumnsChange,
        });
        await settled();
        click(headerAt(container, 1));
        await settled();
        expect(onSortColumnsChange).toHaveBeenCalledWith([
            { columnKey: "age", direction: "ascending" },
        ]);
        expect(shown(container)[1]?.[1]).toBeNull();
        await update({
            sortColumns: [{ columnKey: "age", direction: "ascending" }],
            onSortColumnsChange,
        });
        expect(shown(container)[1]?.[1]).toBe("ascending");
        expect(onSortColumnsChange).toHaveBeenCalledTimes(1);
    });

    it("works with a parent that follows", async () => {
        const sortColumns = shallowRef<readonly SortColumn[]>([]);
        const { container } = renderGrid(() =>
            grid({
                sortColumns: sortColumns.value,
                onSortColumnsChange: (next) => {
                    sortColumns.value = next;
                },
            }),
        );
        await settled();
        click(headerAt(container, 0));
        await settled();
        click(headerAt(container, 1), { metaKey: true });
        await settled();
        expect(shown(container)).toEqual([
            ["ascending", "ascending", "1", true],
            [null, "ascending", "2", true],
            [null, null, null, false],
        ]);
    });

    it("keeps what it can of a prop naming a column that is not sortable, at mount or later", async () => {
        const onSortColumnsChange = vi.fn();
        const mixed: SortColumn[] = [
            { columnKey: "name", direction: "ascending" },
            { columnKey: "id", direction: "ascending" },
        ];
        const { container, update } = mountGrid({
            sortColumns: [],
            onSortColumnsChange,
        });
        await settled();
        await update({ sortColumns: mixed, onSortColumnsChange });
        expect(shown(container)[0]?.[1]).toBe("ascending");
        expect(onSortColumnsChange).toHaveBeenLastCalledWith([
            { columnKey: "name", direction: "ascending" },
        ]);
    });

    it("tells the parent when the columns drop a sorted column", async () => {
        const onSortColumnsChange = vi.fn();
        const sortColumns: SortColumn[] = [
            { columnKey: "name", direction: "ascending" },
            { columnKey: "age", direction: "descending" },
        ];
        const { update } = mountGrid({ sortColumns, onSortColumnsChange });
        await settled();
        expect(onSortColumnsChange).not.toHaveBeenCalled();
        await update({
            cells: [
                { key: "name", width: 150 },
                { key: "age", width: 80, sortable: true },
            ],
            sortColumns,
            onSortColumnsChange,
        });
        expect(onSortColumnsChange).toHaveBeenLastCalledWith([
            { columnKey: "age", direction: "descending" },
        ]);
    });
});

describe("the model", () => {
    it("drives the same state: sort-columns.set through a gridRef asks or tells", async () => {
        const onSortColumnsChange = vi.fn();
        const gridRef = createDataGridRef<Person, typeof FEATURES>();
        const set = async () => {
            gridRef.current?.model.run("sort-columns.set", {
                sortColumns: [{ columnKey: "age", direction: "descending" }],
            });
            await settled();
        };
        const { container, update } = mountGrid({
            gridRef,
            onSortColumnsChange,
        });
        await settled();
        await set();
        expect(onSortColumnsChange).toHaveBeenCalledTimes(1);
        expect(shown(container)[1]?.[1]).toBe("descending");
        await update({ gridRef, sortColumns: [], onSortColumnsChange });
        // controlled to none: the prop wins over what the model held
        expect(shown(container)[1]?.[1]).toBeNull();
        await set();
        expect(onSortColumnsChange).toHaveBeenCalledTimes(2);
        expect(shown(container)[1]?.[1]).toBeNull();
    });
});

describe("cancelling", () => {
    it("a consumer's preventDefault on the header cell, the root or its render element cancels", async () => {
        const onSortColumnsChange = vi.fn();
        const prevent = (event: { preventDefault(): void }) =>
            event.preventDefault();
        const views = [
            mountGrid({ onClick: prevent, onSortColumnsChange }),
            // the consumer's own element in the root's `render` slot: its listener first
            mountGrid({
                renderRoot: ({ props, children }) => [
                    h("div", mergeProps({ onClick: prevent }, props), [
                        children,
                    ]),
                ],
                onSortColumnsChange,
            }),
        ];
        await settled();
        for (const { container } of views) {
            click(headerAt(container, 0));
        }
        await settled();
        // on the header cell itself: its own onClick runs first (bubbling)
        const { container } = renderGrid(() =>
            h(
                G.Root,
                {
                    columns,
                    rows: people,
                    features: FEATURES,
                    onSortColumnsChange,
                },
                () => [
                    h(G.Grid, null, () => [
                        h(G.Header, null, () => [
                            h(G.HeaderRow, null, () => [
                                h(G.HeaderCells, null, {
                                    default: ({
                                        cell,
                                    }: {
                                        cell: HeaderCellInfo<Person>;
                                    }) => [
                                        h(G.HeaderCell, {
                                            cell,
                                            onClick: prevent,
                                        }),
                                    ],
                                }),
                            ]),
                        ]),
                    ]),
                ],
            ),
        );
        await settled();
        click(headerAt(container, 0));
        await settled();
        expect(onSortColumnsChange).not.toHaveBeenCalled();
    });
});

describe("structure", () => {
    it("puts aria-sort on a th as a table", async () => {
        const { container } = mountGrid({
            table: true,
            defaultSortColumns: [
                { columnKey: "name", direction: "descending" },
            ],
        });
        await settled();
        const th = headerAt(container, 0);
        expect(th.tagName).toBe("TH");
        expect(th).toHaveAttribute("aria-sort", "descending");
    });

    it("adds no attribute to a grid without sortable columns", async () => {
        const { container } = mountGrid({
            cells: columns.map(({ sortable: _, ...column }) => column),
        });
        await settled();
        const sortAttributes = [
            ...container.querySelectorAll(
                "[aria-sort], [data-sortable], [data-sort], [data-sort-priority]",
            ),
        ];
        expect(sortAttributes).toHaveLength(0);
    });
});

describe("installed", () => {
    // a feature's props are fallthrough attributes to Vue: in either casing, read at their
    // latest, never on the root's element
    it("takes sorting's props in kebab-case and as listeners, off the element", async () => {
        const onSortColumnsChange = vi.fn();
        const sort = shallowRef<readonly SortColumn[]>([
            { columnKey: "age", direction: "descending" },
        ]);
        const { container } = renderGrid(() =>
            h(
                G.Root,
                {
                    columns,
                    rows: people,
                    features: FEATURES,
                    "sort-columns": sort.value,
                    onSortColumnsChange,
                    "data-testid": "root",
                },
                () => [h(G.Grid, null, () => [h(G.Header), h(G.Body)])],
            ),
        );
        await settled();
        expect(shown(container)[1]?.[1]).toBe("descending");
        click(headerAt(container, 0));
        await settled();
        expect(onSortColumnsChange).toHaveBeenLastCalledWith([
            { columnKey: "name", direction: "ascending" },
        ]);
        // controlled: the prop holds until the app changes it
        expect(shown(container)[0]?.[1]).toBeNull();
        sort.value = [{ columnKey: "name", direction: "ascending" }];
        await settled();
        expect(shown(container)[0]?.[1]).toBe("ascending");
        const element = root(container);
        expect(element).toHaveAttribute("data-testid", "root");
        for (const name of [
            "sort-columns",
            "sortcolumns",
            "onsortcolumnschange",
            "features",
        ]) {
            expect(element.hasAttribute(name)).toBe(false);
        }
    });

    it("is not there unless installed: a header click sorts nothing", async () => {
        const onSortColumnsChange = vi.fn();
        const { container } = renderGrid(() =>
            h(
                G.Root,
                {
                    columns,
                    rows: people,
                    defaultSortColumns: [
                        { columnKey: "age", direction: "descending" },
                    ],
                    onSortColumnsChange,
                },
                () => [h(G.Grid, null, () => [h(G.Header)])],
            ),
        );
        await settled();
        click(headerAt(container, 0));
        await settled();
        expect(onSortColumnsChange).not.toHaveBeenCalled();
        expect(container.querySelectorAll("[aria-sort]")).toHaveLength(0);
    });
});
