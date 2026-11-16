import { describe, expect, it } from "vitest";
import { mergeProps, shallowRef, type VNode, type VNodeChild } from "vue";
import {
    type CellInfo,
    type CellState,
    type Column,
    type ColumnOrGroup,
    type HeaderCellInfo,
    type HeaderRowInfo,
    type RenderSlotProps,
    type RowInfo,
    typedDataGrid,
} from "../src";
import {
    cellAt,
    h,
    renderGrid,
    scrollRoot,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// Pinned columns (Epic #31, P3 and P5; Epic #38): pinned cells and header cells carry
// `data-pinned` and `data-pinned-edge`, sit sticky in their row's flow (rows are flex containers
// then) at the inset the engine writes (a consumer's transform and insets are dropped), and a grid
// without pinned columns renders as before.

interface Row {
    id: number;
}

const G = typedDataGrid<Row>();

const rows: Row[] = Array.from({ length: 100 }, (_, id) => ({ id }));

const plain = (key: string): Column<Row, VNodeChild> => ({
    key,
    name: key,
    width: 100,
});
const pinned = (key: string): Column<Row, VNodeChild> => ({
    ...plain(key),
    pinned: "start",
});

const columns: Column<Row, VNodeChild>[] = [
    pinned("a"),
    pinned("b"),
    ...Array.from({ length: 30 }, (_, i) => plain(`c${i}`)),
];

stubViewportSize(500, 235);

/** What a consumer might give a cell: a transform and insets (dropped on pinned cells), a colour. */
const CONSUMER_STYLE = {
    transform: "scale(2)",
    top: "3px",
    left: "7px",
    right: "9px",
    color: "red",
} as const;

/** The pinned classes of a cell's state (React's `className` function, through the render slot). */
const pinnedClass = (state: {
    pinned: boolean;
    pinnedEdge: boolean;
}): string | undefined =>
    state.pinned ? (state.pinnedEdge ? "pinned edge" : "pinned") : undefined;

/** A `render` slot rendering `tag` with the pinned classes of the part's state. */
const withPinnedClass =
    (tag: string) =>
    ({
        props,
        state,
        children,
    }: {
        props: Record<string, unknown>;
        state: { pinned: boolean; pinnedEdge: boolean };
        children: VNode;
    }) => [
        h(tag, mergeProps(props, { class: pinnedClass(state) }), [h(children)]),
    ];

function grid({
    cells = columns,
    table = false,
}: {
    cells?: ColumnOrGroup<Row, VNodeChild>[];
    table?: boolean;
} = {}) {
    const tag = tags(table);
    return h(
        G.Root,
        { columns: cells, rows, rowHeight: 20 },
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
                                {
                                    default: () => [
                                        h(G.HeaderRows, null, {
                                            default: ({
                                                row,
                                            }: {
                                                row: HeaderRowInfo<Row>;
                                            }) => [
                                                h(
                                                    G.HeaderRow,
                                                    {
                                                        row,
                                                        as: tag.headerRow,
                                                    },
                                                    {
                                                        default: () => [
                                                            h(
                                                                G.HeaderCells,
                                                                null,
                                                                {
                                                                    default: ({
                                                                        cell,
                                                                    }: {
                                                                        cell: HeaderCellInfo<Row>;
                                                                    }) => [
                                                                        h(
                                                                            G.HeaderCell,
                                                                            {
                                                                                cell,
                                                                                style: CONSUMER_STYLE,
                                                                            },
                                                                            {
                                                                                render: withPinnedClass(
                                                                                    tag.headerCell ??
                                                                                        "div",
                                                                                ),
                                                                            },
                                                                        ),
                                                                    ],
                                                                },
                                                            ),
                                                        ],
                                                    },
                                                ),
                                            ],
                                        }),
                                    ],
                                },
                            ),
                            h(
                                G.Body,
                                { as: tag.body },
                                {
                                    default: () => [
                                        h(G.Rows, null, {
                                            default: ({
                                                row,
                                            }: {
                                                row: RowInfo<Row>;
                                            }) => [
                                                h(
                                                    G.Row,
                                                    { row, as: tag.row },
                                                    {
                                                        default: () => [
                                                            h(G.Cells, null, {
                                                                default: ({
                                                                    cell,
                                                                }: {
                                                                    cell: CellInfo<Row>;
                                                                }) => [
                                                                    h(
                                                                        G.Cell,
                                                                        {
                                                                            cell,
                                                                            style: CONSUMER_STYLE,
                                                                        },
                                                                        {
                                                                            render: withPinnedClass(
                                                                                tag.cell ??
                                                                                    "div",
                                                                            ),
                                                                        },
                                                                    ),
                                                                ],
                                                            }),
                                                        ],
                                                    },
                                                ),
                                            ],
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
}

const part = (container: ParentNode, name: string) =>
    container.querySelector(`[data-grid-part="${name}"]`) as HTMLElement;

describe("pinned cells", () => {
    it("mark pinned cells and header cells, and the last pinned column's edge", async () => {
        const { container } = renderGrid(() => grid());
        await settled();
        for (const rowIndex of [-1, 0, 5]) {
            const a = cellAt(container, rowIndex, 0);
            const b = cellAt(container, rowIndex, 1);
            const c = cellAt(container, rowIndex, 2);
            expect(a).toHaveAttribute("data-pinned", "start");
            expect(a).not.toHaveAttribute("data-pinned-edge");
            expect(a).toHaveClass("pinned");
            expect(b).toHaveAttribute("data-pinned-edge", "");
            expect(b).toHaveClass("pinned", "edge");
            expect(c).not.toHaveAttribute("data-pinned");
            expect(c).not.toHaveAttribute("data-pinned-edge");
        }
    });

    for (const table of [false, true]) {
        it(`are sticky in their row's flow at the engine's inset, a consumer's transform and insets dropped${table ? ", as table cells" : ""}`, async () => {
            const { container } = renderGrid(() => grid({ table }));
            await settled();
            for (const rowIndex of [-1, 0]) {
                const a = cellAt(container, rowIndex, 0);
                const b = cellAt(container, rowIndex, 1);
                expect(a.tagName).toBe(
                    table ? (rowIndex < 0 ? "TH" : "TD") : "DIV",
                );
                expect(a.style.position).toBe("sticky");
                expect(a.style.width).toBe("100px");
                // the rendered columns start at column 2: the layers are moved right by 200px, and
                // the insets are each column's offset less that
                expect(a.style.left).toBe("-200px");
                expect(b.style.left).toBe("-100px");
                for (const property of ["transform", "top", "right"] as const) {
                    expect(a.style[property]).toBe("");
                }
                expect(a.style.color).toBe("red");
                // a cell that scrolls keeps what the consumer gave it, under the structure
                const c = cellAt(container, rowIndex, 2);
                expect(c.style.position).toBe("absolute");
                expect(c.style.transform).toBe("scale(2)");
                // the row starts the pinned and the rendered columns' width (200 + 500) before
                // its layer
                expect(c.style.left).toBe("700px");
            }
            const row = part(container, "row");
            const headerRow = part(container, "header-row");
            expect(row.tagName).toBe(table ? "TR" : "DIV");
            for (const element of [row, headerRow]) {
                expect(element.style.display).toBe("flex");
                expect(element.style.position).toBe("absolute");
            }
        });
    }

    it("are not written while scrolling inside the rendered window, and follow a new one", async () => {
        const { container } = renderGrid(() => grid());
        await settled();
        const root = part(container, "root");
        const pinnedCells = [...container.querySelectorAll("[data-pinned]")];
        const writes = new MutationObserver(() => {});
        for (const cell of pinnedCells) {
            writes.observe(cell, { attributeFilter: ["style"] });
        }
        scrollRoot(root, { left: 40 });
        await settled();
        expect(writes.takeRecords()).toEqual([]);
        expect(cellAt(container, 0, 0).style.left).toBe("-200px");
        writes.disconnect();
        // far right: a new column window, the layers' x is its base
        scrollRoot(root, { left: 2_000 });
        await settled();
        const body = part(container, "body");
        const x = Number(
            /translate3d\(([-\d.]+)px/.exec(body.style.transform)?.[1],
        );
        expect(x).toBeGreaterThan(1_000);
        expect(cellAt(container, 0, 1).style.left).toBe(`${100 - x}px`);
        expect(cellAt(container, -1, 1).style.left).toBe(`${100 - x}px`);
    });

    // React merges a `render` element's own props; in Vue the `render` slot gets the merged props
    // (the consumer's style, dropped keys gone) to bind on its element
    it("drop a transform and insets on their render element too", async () => {
        const { container } = renderGrid(() =>
            h(
                G.Root,
                { columns, rows, rowHeight: 20 },
                {
                    default: () => [
                        h(G.Grid, null, {
                            default: () => [
                                h(G.Body, null, {
                                    default: () => [
                                        h(G.Rows, null, {
                                            default: ({
                                                row,
                                            }: {
                                                row: RowInfo<Row>;
                                            }) => [
                                                h(
                                                    G.Row,
                                                    { row },
                                                    {
                                                        default: () => [
                                                            h(G.Cells, null, {
                                                                default: ({
                                                                    cell,
                                                                }: {
                                                                    cell: CellInfo<Row>;
                                                                }) => [
                                                                    h(
                                                                        G.Cell,
                                                                        {
                                                                            cell,
                                                                            style: {
                                                                                transform:
                                                                                    "scale(3)",
                                                                                top: "4px",
                                                                                color: "red",
                                                                            },
                                                                        },
                                                                        {
                                                                            render: ({
                                                                                props,
                                                                                children,
                                                                            }: RenderSlotProps<CellState>) => [
                                                                                h(
                                                                                    "div",
                                                                                    props,
                                                                                    [
                                                                                        h(
                                                                                            children,
                                                                                        ),
                                                                                    ],
                                                                                ),
                                                                            ],
                                                                        },
                                                                    ),
                                                                ],
                                                            }),
                                                        ],
                                                    },
                                                ),
                                            ],
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                },
            ),
        );
        await settled();
        const a = cellAt(container, 0, 0);
        expect(a.style.transform).toBe("");
        expect(a.style.top).toBe("");
        expect(a.style.left).toBe("-200px");
        expect(a.style.color).toBe("red");
        expect(cellAt(container, 0, 2).style.transform).toBe("scale(3)");
    });

    it("render far from the column window, as table cells too", async () => {
        const { container } = renderGrid(() => grid({ table: true }));
        await settled();
        scrollRoot(part(container, "root"), { left: 2_000 });
        await settled();
        const a = cellAt(container, 0, 0);
        expect(a.tagName).toBe("TD");
        expect(a).toHaveAttribute("data-pinned", "start");
        expect(a).toHaveAttribute("aria-colindex", "1");
        expect(cellAt(container, -1, 1).tagName).toBe("TH");
    });

    it("mark a pinned group's header cell", async () => {
        const { container } = renderGrid(() =>
            grid({
                cells: [
                    {
                        key: "who",
                        name: "Who",
                        children: [pinned("a"), pinned("b")],
                    },
                    ...Array.from({ length: 10 }, (_, i) => plain(`c${i}`)),
                ],
            }),
        );
        await settled();
        const group = cellAt(container, -2, 0);
        expect(group).toHaveAttribute("data-group", "");
        expect(group).toHaveAttribute("data-pinned", "start");
        expect(group).toHaveAttribute("data-pinned-edge", "");
    });

    it("sit inside their row's box: a row starts the pinned and rendered columns' width before its layer", async () => {
        const { container } = renderGrid(() => grid());
        await settled();
        const row = container.querySelector(
            '[data-grid-part="row"][data-row-index="0"]',
        ) as HTMLElement;
        // 200px pinned, columns 2 to 7 rendered (the view's 300px and 2 of overscan)
        expect(row.style.left).toBe("-700px");
        const headerRow = part(container, "header-row");
        expect(headerRow.style.left).toBe("-700px");
        expect(headerRow.style.width).toBe(row.style.width);
    });

    // "get their insets back when the grid is shown again (Activity)": React's <Activity> has no
    // Vue counterpart (a hidden subtree keeping its elements while its effects are cleaned up)

    it("become cells that scroll once their column is unpinned", async () => {
        const cells = shallowRef<ColumnOrGroup<Row, VNodeChild>[]>(columns);
        const { container } = renderGrid(() => grid({ cells: cells.value }));
        await settled();
        expect(cellAt(container, 0, 0).style.position).toBe("sticky");
        cells.value = [
            plain("a"),
            plain("b"),
            ...Array.from({ length: 30 }, (_, i) => plain(`c${i}`)),
        ];
        await settled();
        const a = cellAt(container, 0, 0);
        expect(a).not.toHaveAttribute("data-pinned");
        expect(a.style.position).toBe("absolute");
        expect(a.style.left).toBe("0px");
        expect(cellAt(container, 0, 1).style.left).toBe("100px");
        const row = part(container, "row");
        expect(row.style.display).toBe("");
        expect(row.style.left).toBe("0px");
    });

    it("leave a grid without pinned columns as it was", async () => {
        const { container } = renderGrid(() =>
            grid({ cells: columns.map(({ pinned: _, ...column }) => column) }),
        );
        await settled();
        expect(
            container.querySelectorAll("[data-pinned], [data-pinned-edge]"),
        ).toHaveLength(0);
        const a = cellAt(container, 0, 0);
        expect(a.style.transform).toBe("scale(2)");
        expect(a.style.position).toBe("absolute");
        // no new structural key: no `display` on rows
        for (const name of ["row", "header-row"]) {
            const element = part(container, name);
            expect(element.style.display).toBe("");
            expect(element.style.left).toBe("0px");
        }
    });
});
