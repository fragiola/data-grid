import { describe, expect, it } from "vitest";
import { defineComponent, h, shallowRef, type VNodeChild } from "vue";
import {
    type CellInfo,
    type Column,
    type GridDirection,
    type RowInfo,
    typedDataGrid,
    useDataGrid,
} from "../src";
import {
    cellAt,
    click,
    FEATURES,
    type Features,
    renderGrid,
    root,
    rowAt,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// Pinned end columns and right to left (Epic #85, E1.1): a column pinned at the end is sticky in
// its row's flow like one pinned at the start (`data-pinned="end"`, its part's edge on the first);
// right to left, the root carries `dir` and every structural inset the primitives and the engine
// write is on the right, the same numbers as on the left left to right.

interface Row {
    id: number;
}

const G = typedDataGrid<Row, Features>();

const rows: Row[] = Array.from({ length: 100 }, (_, id) => ({ id }));

const column = (
    key: string,
    pinned?: "start" | "end",
): Column<Row, VNodeChild> => ({
    key,
    name: key,
    width: 100,
    ...(pinned ? { pinned } : {}),
});

/** "a" pinned at the start, 30 that scroll, "y" and "z" pinned at the end */
const columns: Column<Row, VNodeChild>[] = [
    column("a", "start"),
    ...Array.from({ length: 30 }, (_, i) => column(`c${i}`)),
    column("y", "end"),
    column("z", "end"),
];

stubViewportSize(500, 235);

interface GridOptions {
    cells?: Column<Row, VNodeChild>[];
    table?: boolean;
    direction?: GridDirection | undefined;
    expanded?: boolean;
}

function grid({
    cells = columns,
    table = false,
    direction,
    expanded = false,
}: GridOptions = {}) {
    const tag = tags(table);
    const row = ({ row }: { row: RowInfo<Row> }) => [
        h(
            G.Row,
            { row, as: tag.row },
            {
                default: () => [
                    h(G.Cells, null, {
                        default: ({ cell }: { cell: CellInfo<Row> }) => [
                            h(G.Cell, { cell, as: tag.cell }),
                        ],
                    }),
                    h(G.RowDetail, null, { default: () => ["detail"] }),
                ],
            },
        ),
    ];
    return h(
        G.Root,
        {
            features: FEATURES,
            columns: cells,
            rows,
            rowHeight: 20,
            direction,
            defaultExpandedRowKeys: expanded ? [0] : undefined,
        },
        {
            default: () => [
                h(
                    G.Grid,
                    { as: tag.grid },
                    {
                        default: () => [
                            h(G.Header, { as: tag.header }),
                            h(
                                G.Body,
                                { as: tag.body },
                                {
                                    default: () => [
                                        h(G.Rows, null, { default: row }),
                                    ],
                                },
                            ),
                            h(G.Empty),
                        ],
                    },
                ),
            ],
        },
    );
}

const body = (container: ParentNode) =>
    container.querySelector<HTMLElement>('[data-grid-part="body"]');

describe("columns pinned at the end", () => {
    for (const table of [false, true]) {
        it(`are last in each row, sticky in its flow at the engine's inset, the first one their edge${table ? ", as table cells" : ""}`, async () => {
            const { container } = renderGrid(() => grid({ table }));
            await settled();
            for (const rowIndex of [-1, 0]) {
                const y = cellAt(container, rowIndex, 31);
                const z = cellAt(container, rowIndex, 32);
                expect(y).toHaveAttribute("data-pinned", "end");
                expect(y).toHaveAttribute("data-pinned-edge", "");
                expect(z).toHaveAttribute("data-pinned", "end");
                expect(z).not.toHaveAttribute("data-pinned-edge");
                expect(cellAt(container, rowIndex, 0)).toHaveAttribute(
                    "data-pinned",
                    "start",
                );
                expect(y.style.position).toBe("sticky");
                // the view's end less their 200px: 300 and 400 from its start, the layers
                // moved by the rendered columns' base (100px)
                expect(y.style.left).toBe(`${3_100 - 100 + 500 - 3_300}px`);
                expect(z.style.left).toBe(`${3_200 - 100 + 500 - 3_300}px`);
                expect(z.parentElement?.lastElementChild).toBe(z);
            }
            expect(rowAt(container, 0).style.display).toBe("flex");
        });
    }

    it("make every row a flex container, with no column pinned at the start", async () => {
        const { container } = renderGrid(() =>
            grid({
                cells: columns.filter((entry) => entry.pinned !== "start"),
            }),
        );
        await settled();
        expect(rowAt(container, 0).style.display).toBe("flex");
        expect(cellAt(container, 0, 30)).toHaveAttribute("data-pinned", "end");
    });

    it("put a detail at the row's start, before both pinned parts", async () => {
        const { container } = renderGrid(() => grid({ expanded: true }));
        await settled();
        const detail = container.querySelector<HTMLElement>(
            '[data-grid-part="row-detail"][data-row-index="0"]',
        );
        expect(detail?.style.marginLeft).toBe("-300px");
        expect(detail?.style.marginRight).toBe("");
    });
});

describe("right to left", () => {
    it("carries `dir` on the root only when a direction is given", async () => {
        const none = renderGrid(() => grid()).container;
        const ltr = renderGrid(() => grid({ direction: "ltr" })).container;
        const rtl = renderGrid(() => grid({ direction: "rtl" })).container;
        await settled();
        expect(root(none)).not.toHaveAttribute("dir");
        expect(root(ltr)).toHaveAttribute("dir", "ltr");
        expect(root(rtl)).toHaveAttribute("dir", "rtl");
    });

    for (const table of [false, true]) {
        it(`places every part from the right, as left to right from the left${table ? ", as table elements" : ""}`, async () => {
            const ltr = renderGrid(() =>
                grid({ table, expanded: true }),
            ).container;
            const rtl = renderGrid(() =>
                grid({ table, expanded: true, direction: "rtl" }),
            ).container;
            await settled();
            const pairs: [HTMLElement | null, HTMLElement | null][] = [
                [body(ltr), body(rtl)],
                [rowAt(ltr, 1), rowAt(rtl, 1)],
                [cellAt(ltr, 1, 3), cellAt(rtl, 1, 3)],
                [cellAt(ltr, -1, 3), cellAt(rtl, -1, 3)],
                // the engine's insets
                [cellAt(ltr, 1, 0), cellAt(rtl, 1, 0)],
                [cellAt(ltr, -1, 32), cellAt(rtl, -1, 32)],
                [
                    ltr.querySelector('[data-grid-part="row-detail"]'),
                    rtl.querySelector('[data-grid-part="row-detail"]'),
                ],
            ];
            for (const [left, right] of pairs) {
                if (!left || !right) throw new Error("a part is missing");
                expect(left.style.left).toMatch(/px$/);
                expect(right.style.right).toBe(left.style.left);
                expect(right.style.left).toBe("");
            }
            const detail = rtl.querySelector<HTMLElement>(
                '[data-grid-part="row-detail"]',
            );
            expect(detail?.style.marginRight).toBe("-300px");
            expect(detail?.style.marginLeft).toBe("");
            // the layers move toward the start: the left
            expect(body(rtl)?.style.transform).toBe(
                body(ltr)?.style.transform.replace("(", "(-"),
            );
            // ARIA does not change
            expect(cellAt(rtl, 1, 3)).toHaveAttribute("aria-colindex", "4");
        });
    }

    it("takes the page's direction without a prop of its own, adding no `dir`", async () => {
        const { container } = renderGrid(() =>
            h("div", { style: { direction: "rtl" } }, [grid()]),
        );
        await settled();
        expect(root(container)).not.toHaveAttribute("dir");
        expect(cellAt(container, 1, 3).style.right).toMatch(/px$/);
        expect(cellAt(container, 1, 3).style.left).toBe("");
        expect(cellAt(container, 1, 0).style.right).toMatch(/px$/);
    });

    it("lets its prop win over the page's", async () => {
        const { container } = renderGrid(() =>
            h("div", { style: { direction: "rtl" } }, [
                grid({ direction: "ltr" }),
            ]),
        );
        await settled();
        expect(root(container)).toHaveAttribute("dir", "ltr");
        expect(cellAt(container, 1, 3).style.left).toMatch(/px$/);
        expect(cellAt(container, 1, 3).style.right).toBe("");
    });

    it("keeps the empty state at the view's start", async () => {
        const { container } = renderGrid(() =>
            h(
                G.Root,
                { features: FEATURES, columns, rows: [], direction: "rtl" },
                {
                    default: () => [
                        h(G.Grid, null, {
                            default: () => [h(G.Header), h(G.Body), h(G.Empty)],
                        }),
                    ],
                },
            ),
        );
        await settled();
        const empty = container.querySelector<HTMLElement>(
            '[data-grid-part="empty-area"]',
        );
        expect(empty?.style.right).toBe("0px");
        expect(empty?.style.left).toBe("");
    });

    it("follows its prop: the parts and the engine's insets change sides", async () => {
        const direction = shallowRef<GridDirection | undefined>(undefined);
        const { container } = renderGrid(() =>
            grid({ direction: direction.value }),
        );
        await settled();
        const inset = cellAt(container, 1, 0).style.left;
        direction.value = "rtl";
        await settled();
        expect(root(container)).toHaveAttribute("dir", "rtl");
        expect(cellAt(container, 1, 0).style.left).toBe("");
        expect(cellAt(container, 1, 0).style.right).toBe(inset);
        expect(cellAt(container, 1, 3).style.left).toBe("");
        expect(cellAt(container, 1, 3).style.right).toMatch(/px$/);
        direction.value = undefined;
        await settled();
        expect(root(container)).not.toHaveAttribute("dir");
        expect(cellAt(container, 1, 0).style.right).toBe("");
        expect(cellAt(container, 1, 0).style.left).toBe(inset);
    });
});

describe("the root's dir (the epic review)", () => {
    // "is rendered from the direction given, on the server too": server rendering is React's
    // (Vue SSR is out of scope)

    it("follows a direction set by command, and drops it taken back", async () => {
        const Commands = defineComponent({
            setup() {
                const { model } = useDataGrid();
                return () => [
                    h("button", {
                        type: "button",
                        "data-testid": "rtl",
                        onClick: () =>
                            model.run("direction.set", { direction: "rtl" }),
                    }),
                    h("button", {
                        type: "button",
                        "data-testid": "page",
                        onClick: () =>
                            model.run("direction.set", { direction: null }),
                    }),
                ];
            },
        });
        const { container } = renderGrid(() =>
            h(
                G.Root,
                { features: FEATURES, columns, rows: [] },
                { default: () => [h(Commands)] },
            ),
        );
        await settled();
        const button = (id: string) => {
            const element = container.querySelector(`[data-testid="${id}"]`);
            if (!(element instanceof HTMLElement)) throw new Error(id);
            return element;
        };
        expect(root(container)).not.toHaveAttribute("dir");
        click(button("rtl"));
        await settled();
        expect(root(container)).toHaveAttribute("dir", "rtl");
        click(button("page"));
        await settled();
        expect(root(container)).not.toHaveAttribute("dir");
    });
});
