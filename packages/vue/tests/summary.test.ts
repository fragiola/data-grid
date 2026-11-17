import { describe, expect, it } from "vitest";
import {
    defineComponent,
    mergeProps,
    type ShallowRef,
    shallowRef,
    type VNodeChild,
} from "vue";
import {
    type Column,
    type DataGridContextValue,
    type RenderSlotProps,
    type SummaryCellInfo,
    type SummaryCellState,
    type SummaryRowInfo,
    type SummaryRowState,
    type SummaryState,
    typedDataGrid,
    useDataGrid,
} from "../src";
import {
    cellAt,
    FEATURES,
    type Features,
    h,
    keyDown,
    renderGrid,
    root,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// Summary rows (Epic #86, E2.1): `Summary` renders a position's rows sticky (the top ones under the
// header, the bottom ones at the visible body's bottom edge), each a `SummaryRow` of
// `SummaryCell`s drawn by the columns' `renderSummaryCell` from the app's own values. Nothing
// renders without them, and a grid without them renders as before.

interface Row {
    id: number;
    amount: number;
}

const G = typedDataGrid<Row, Features>();

const rows: Row[] = Array.from({ length: 20 }, (_, id) => ({
    id,
    amount: id * 10,
}));
const total = rows.reduce((sum, row) => sum + row.amount, 0);

const columns: Column<Row, VNodeChild>[] = [
    {
        key: "id",
        name: "Id",
        width: 100,
        pinned: "start",
        renderSummaryCell: ({ position }) =>
            position === "top" ? "Top" : "Total",
    },
    {
        key: "amount",
        name: "Amount",
        width: 100,
        renderSummaryCell: ({ summaryIndex }) =>
            summaryIndex === 0 ? String(total) : "average",
        colSpan: (args) =>
            args.type === "summary" && args.summaryIndex === 1 ? 2 : undefined,
    },
    { key: "c", name: "C", width: 100 },
];

// a 35px header, two 30px summary rows: 300 − 35 − 30 − 60 = 175 for the body
stubViewportSize(800, 300);

let grid: DataGridContextValue<Row, Features> | null = null;

const Expose = defineComponent({
    setup() {
        grid = useDataGrid<Row, Features>();
        return () => null;
    },
});

const TABLE_SUMMARY = {
    top: "tbody",
    bottom: "tfoot",
    row: "tr",
    cell: "td",
};

/** A position's summary, its rows and cells each rendered as `summary` says. */
function summaryOf(
    position: "top" | "bottom",
    summary: typeof TABLE_SUMMARY | undefined,
) {
    return h(G.Summary, { position, as: summary?.[position] }, () => [
        h(G.SummaryRows, null, {
            default: ({ row }: { row: SummaryRowInfo }) => [
                h(G.SummaryRow, { row, as: summary?.row }, () => [
                    h(G.SummaryCells, null, {
                        default: ({ cell }: { cell: SummaryCellInfo<Row> }) => [
                            h(G.SummaryCell, { cell, as: summary?.cell }),
                        ],
                    }),
                ]),
            ],
        }),
    ]);
}

function gridOf({
    table = false,
    summaryRows,
}: {
    table?: boolean;
    summaryRows: { top?: number; bottom?: number } | undefined;
}) {
    const tag = tags(table);
    const summary = table ? TABLE_SUMMARY : undefined;
    return h(
        G.Root,
        {
            features: FEATURES,
            columns,
            rows,
            rowHeight: 20,
            summaryRows,
            summaryRowHeight: 30,
        },
        () => [
            h(Expose),
            h(G.Grid, { as: tag.grid }, () => [
                h(G.Header, { as: tag.header }),
                summaryOf("top", summary),
                h(G.Body, { as: tag.body }),
                summaryOf("bottom", summary),
            ]),
        ],
    );
}

const summaryCell = (
    container: ParentNode,
    rowIndex: number,
    columnIndex: number,
) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="summary-cell"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
    );

const part = (container: ParentNode, position: string) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="summary"][data-summary="${position}"]`,
    );

/** Mounts what `render` makes of `props`, a ref the test changes (a parent re-rendering). */
function mountWith<P>(props: ShallowRef<P>, render: (props: P) => unknown) {
    const mounted = renderGrid(() => render(props.value));
    return {
        ...mounted,
        update: async (next: P) => {
            props.value = next;
            await settled();
        },
    };
}

describe("summary rows", () => {
    for (const table of [false, true]) {
        it(`render sticky, with the app's values, ARIA and data-summary${table ? ", as table parts" : ""}`, async () => {
            const { container } = renderGrid(() =>
                gridOf({ table, summaryRows: { top: 1, bottom: 2 } }),
            );
            await settled();
            const top = part(container, "top");
            const bottom = part(container, "bottom");
            expect(top?.tagName).toBe(table ? "TBODY" : "DIV");
            expect(bottom?.tagName).toBe(table ? "TFOOT" : "DIV");
            expect(top).toHaveAttribute("role", "rowgroup");
            expect(top?.style.position).toBe("sticky");
            expect(top?.style.top).toBe("35px");
            expect(top?.style.height).toBe("30px");
            // stuck at the view's bottom edge: a percentage of its height, no measure
            expect(bottom?.style.top).toBe("calc(100% - 60px)");
            expect(bottom?.style.height).toBe("60px");
            // the top one's row before the header's: -2; the bottom ones after the body's
            expect(summaryCell(container, -2, 0)).toHaveTextContent("Top");
            expect(summaryCell(container, -2, 1)).toHaveTextContent(
                String(total),
            );
            expect(summaryCell(container, 20, 0)).toHaveTextContent("Total");
            expect(summaryCell(container, 21, 1)).toHaveTextContent("average");
            const row = container.querySelector(
                '[data-grid-part="summary-row"][data-row-index="21"]',
            );
            expect(row).toHaveAttribute("role", "row");
            expect(row).toHaveAttribute("aria-rowindex", "24");
            expect(row).toHaveAttribute("data-summary", "bottom");
            expect((row as HTMLElement).style.top).toBe("30px");
            expect(
                container.querySelector(
                    '[data-grid-part="summary-row"][data-row-index="-2"]',
                ),
            ).toHaveAttribute("aria-rowindex", "2");
            expect(
                cellAt(container, 0, 0).closest('[role="row"]'),
            ).toHaveAttribute("aria-rowindex", "3");
            expect(
                root(container).querySelector('[role="grid"]'),
            ).toHaveAttribute("aria-rowcount", String(1 + 1 + 20 + 2));
            const own = summaryCell(container, 20, 1);
            expect(own).toHaveAttribute("role", "gridcell");
            expect(own).toHaveAttribute("aria-colindex", "2");
            expect(own).toHaveAttribute("data-summary", "bottom");
            expect(own?.style.height).toBe("30px");
            // pinned with the body's
            expect(summaryCell(container, 20, 0)).toHaveAttribute(
                "data-pinned",
                "start",
            );
            expect(summaryCell(container, 20, 0)?.style.position).toBe(
                "sticky",
            );
            // spanning with its column's colSpan
            const span = summaryCell(container, 21, 1);
            expect(span).toHaveAttribute("aria-colspan", "2");
            expect(span?.style.width).toBe("200px");
            if (table) expect(span).toHaveAttribute("colspan", "2");
            expect(summaryCell(container, 21, 2)).toBeNull();
            // the body sits below the header and the top summary row
            const body = container.querySelector<HTMLElement>(
                '[data-grid-part="body"]',
            );
            expect(body?.style.top).toBe("65px");
            const sizer = container.querySelector<HTMLElement>(
                '[data-grid-part="grid"]',
            );
            expect(sizer?.style.height).toBe(`${35 + 90 + 20 * 20}px`);
        });
    }

    it("render nothing without summary rows, the grid as before", async () => {
        const { container } = renderGrid(() =>
            gridOf({ summaryRows: undefined }),
        );
        await settled();
        expect(part(container, "top")).toBeNull();
        expect(part(container, "bottom")).toBeNull();
        expect(container.querySelector('[data-grid-part="body"]')).toHaveStyle({
            top: "35px",
        });
        expect(
            container.querySelector('[data-grid-part="grid"]'),
        ).toHaveAttribute("aria-rowcount", "21");
    });

    it("follow the prop: new counts, and none once it is removed", async () => {
        const { container, update } = mountWith(
            shallowRef<{ top?: number; bottom?: number } | undefined>({
                bottom: 1,
            }),
            (summaryRows) => gridOf({ summaryRows }),
        );
        await settled();
        expect(part(container, "top")).toBeNull();
        expect(grid?.model.get("summary-rows")).toEqual({ top: 0, bottom: 1 });
        await update({ top: 2, bottom: 1 });
        expect(grid?.model.get("summary-rows")).toEqual({ top: 2, bottom: 1 });
        expect(summaryCell(container, -3, 0)).toHaveTextContent("Top");
        await update(undefined);
        expect(grid?.model.get("summary-rows")).toEqual({ top: 0, bottom: 0 });
        expect(part(container, "bottom")).toBeNull();
    });

    it("make a summary cell the roving tab stop, and take the keys", async () => {
        const { container } = renderGrid(() =>
            gridOf({ summaryRows: { top: 1, bottom: 2 } }),
        );
        await settled();
        grid?.model.run("active-position.set", {
            rowIndex: 20,
            columnIndex: 2,
        });
        await settled();
        const active = summaryCell(container, 20, 2);
        expect(active).toHaveAttribute("tabindex", "0");
        expect(active).toHaveAttribute("data-active", "");
        expect(
            container.querySelector(
                '[data-grid-part="summary-row"][data-row-index="20"]',
            ),
        ).toHaveAttribute("data-active", "");
        if (!active) throw new Error("no active cell");
        keyDown(active, { key: "ArrowUp" });
        await settled();
        expect(grid?.model.get("active-position")).toEqual({
            rowIndex: 19,
            columnIndex: 2,
        });
        keyDown(cellAt(container, 19, 2), { key: "ArrowDown" });
        await settled();
        keyDown(summaryCell(container, 20, 2) as HTMLElement, {
            key: "ArrowDown",
        });
        await settled();
        // into the span: it is active on any of its columns
        expect(grid?.model.get("active-position")).toEqual({
            rowIndex: 21,
            columnIndex: 1,
        });
    });

    // Vue: no `ref` prop merging nor `className`/`style` functions (React-only); the element is
    // found by its forwarded attribute, and state-based classes go through the `render` slot
    it("follow the primitive contract: render, ref, className and style functions, forwarded props", async () => {
        const { container } = renderGrid(() =>
            h(
                G.Root,
                { features: FEATURES, columns, rows, summaryRows: { top: 1 } },
                () => [
                    h(G.Grid, null, () => [
                        h(
                            G.Summary,
                            {
                                position: "top",
                                "data-testid": "summary",
                                // structural keys win
                                style: { top: "3px", color: "red" },
                            },
                            {
                                render: ({
                                    props,
                                    state,
                                    children,
                                }: RenderSlotProps<SummaryState>) => [
                                    h(
                                        "div",
                                        mergeProps(props, {
                                            class: `summary-${state.position}`,
                                        }),
                                        [children],
                                    ),
                                ],
                                default: () => [
                                    h(G.SummaryRows, null, {
                                        default: ({
                                            row,
                                        }: {
                                            row: SummaryRowInfo;
                                        }) => [
                                            h(
                                                G.SummaryRow,
                                                {
                                                    row,
                                                    style: {
                                                        transform: "none",
                                                    },
                                                },
                                                {
                                                    render: ({
                                                        props,
                                                        state,
                                                        children,
                                                    }: RenderSlotProps<SummaryRowState>) => [
                                                        h(
                                                            "div",
                                                            mergeProps(props, {
                                                                class: `row-${state.summaryIndex}`,
                                                            }),
                                                            [children],
                                                        ),
                                                    ],
                                                    default: () => [
                                                        h(
                                                            G.SummaryCells,
                                                            null,
                                                            {
                                                                default: ({
                                                                    cell,
                                                                }: {
                                                                    cell: SummaryCellInfo<Row>;
                                                                }) => [
                                                                    summaryCellOf(
                                                                        cell,
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
                    ]),
                ],
            ),
        );
        await settled();
        const summary = container.querySelector<HTMLElement>(
            '[data-testid="summary"]',
        );
        expect(summary).toHaveAttribute("data-grid-part", "summary");
        expect(summary).toHaveClass("summary-top");
        expect(summary?.style.top).toBe("35px");
        expect(summary?.style.color).toBe("red");
        const row = container.querySelector<HTMLElement>(
            '[data-grid-part="summary-row"]',
        );
        expect(row).toHaveClass("row-0");
        // the layer's transform is the engine's
        expect(row?.style.transform).not.toBe("none");
        const own = summaryCell(container, -2, 1);
        expect(own?.tagName).toBe("SPAN");
        expect(own).toHaveAttribute("data-position", "top");
        expect(own).toHaveTextContent("1");
        // no name of its own
        expect(summary).not.toHaveAttribute("aria-label");
        expect(own).not.toHaveAttribute("aria-label");
    });

    it("render a summary cell empty without renderSummaryCell, and keep a nested grid's rows its own", async () => {
        const plain: Column<Row, VNodeChild>[] = [{ key: "id", width: 100 }];
        const { container } = renderGrid(() =>
            h(
                G.Root,
                {
                    features: FEATURES,
                    columns: plain,
                    rows,
                    summaryRows: { bottom: 1 },
                },
                () => [
                    h(G.Grid, null, () => [
                        h(G.Summary, { position: "bottom" }),
                    ]),
                ],
            ),
        );
        await settled();
        const own = summaryCell(container, 20, 0);
        expect(own).toBeEmptyDOMElement();
        expect(() =>
            renderGrid(() =>
                h(G.Root, { features: FEATURES, columns: plain, rows }, () => [
                    h(G.SummaryCells),
                ]),
            ),
        ).toThrow(/SummaryRow/);
    });

    it("tell a controlled parent where its active summary row went when the rows change", async () => {
        const changes: unknown[] = [];
        const { update } = mountWith(shallowRef(20), (count) =>
            h(
                G.Root,
                {
                    features: FEATURES,
                    columns,
                    rows: rows.slice(0, count),
                    summaryRows: { bottom: 1 },
                    activePosition: { rowIndex: 20, columnIndex: 2 },
                    onActivePositionChange: (position) =>
                        changes.push(position),
                },
                () => [
                    h(Expose),
                    h(G.Grid, null, () => [
                        h(G.Body),
                        h(G.Summary, { position: "bottom" }),
                    ]),
                ],
            ),
        );
        await settled();
        expect(changes).toEqual([]);
        await update(5);
        // the bottom summary row is at 5 now: the parent is told
        expect(grid?.model.get("active-position")).toEqual({
            rowIndex: 5,
            columnIndex: 2,
        });
        expect(changes.length).toBeGreaterThan(0);
        for (const change of changes) {
            expect(change).toEqual({ rowIndex: 5, columnIndex: 2 });
        }
    });

    it("draw their cells again for summary-rows.changed, and with the app's own children", async () => {
        const figures = { total: 1 };
        const live: Column<Row, VNodeChild>[] = [
            {
                key: "id",
                width: 100,
                renderSummaryCell: () => `total ${figures.total}`,
            },
        ];
        const { container, update } = mountWith(shallowRef("a"), (note) =>
            h(
                G.Root,
                {
                    features: FEATURES,
                    columns: live,
                    rows,
                    summaryRows: { top: 1 },
                },
                () => [
                    h(Expose),
                    h(G.Grid, null, () => [
                        h(G.Summary, { position: "top" }, () => [
                            h(G.SummaryRows, null, {
                                default: ({ row }: { row: SummaryRowInfo }) => [
                                    h(G.SummaryRow, { row }, () => [
                                        h(G.SummaryCells, null, {
                                            default: ({
                                                cell,
                                            }: {
                                                cell: SummaryCellInfo<Row>;
                                            }) => [
                                                h(
                                                    G.SummaryCell,
                                                    { cell },
                                                    () => [
                                                        note,
                                                        " ",
                                                        cell.column.renderSummaryCell?.(
                                                            cell,
                                                        ),
                                                    ],
                                                ),
                                            ],
                                        }),
                                    ]),
                                ],
                            }),
                        ]),
                    ]),
                ],
            ),
        );
        await settled();
        const own = () => summaryCell(container, -2, 0);
        expect(own()).toHaveTextContent("a total 1");
        // the app's state, read where it renders the cell
        await update("b");
        expect(own()).toHaveTextContent("b total 1");
        // data behind the same columns: told to the grid
        figures.total = 2;
        grid?.model.run("summary-rows.changed");
        await settled();
        expect(own()).toHaveTextContent("b total 2");
    });
});

/** A summary cell rendered as a `span` through its `render` slot, its column index inside. */
function summaryCellOf(cell: SummaryCellInfo<Row>) {
    return h(
        G.SummaryCell,
        { cell },
        {
            render: ({
                props,
                state,
                children,
            }: RenderSlotProps<SummaryCellState>) => [
                h(
                    "span",
                    mergeProps(props, { "data-position": state.position }),
                    [children],
                ),
            ],
            default: () => [String(cell.columnIndex)],
        },
    );
}

describe("a summary cell's controls", () => {
    function editable(count: number) {
        return h(
            G.Root,
            {
                features: FEATURES,
                columns,
                rows: rows.slice(0, count),
                rowHeight: 20,
                summaryRows: { bottom: 1 },
                summaryRowHeight: 30,
            },
            () => [
                h(Expose),
                h(G.Grid, null, () => [
                    h(G.Header),
                    h(G.Body),
                    h(G.Summary, { position: "bottom" }, () => [
                        h(G.SummaryRows, null, {
                            default: ({ row }: { row: SummaryRowInfo }) => [
                                h(G.SummaryRow, { row }, () => [
                                    h(G.SummaryCells, null, {
                                        default: ({
                                            cell,
                                        }: {
                                            cell: SummaryCellInfo<Row>;
                                        }) => [
                                            h(G.SummaryCell, { cell }, () =>
                                                cell.columnIndex === 2
                                                    ? [
                                                          h("input", {
                                                              "aria-label":
                                                                  "Note",
                                                          }),
                                                      ]
                                                    : [],
                                            ),
                                        ],
                                    }),
                                ]),
                            ],
                        }),
                    ]),
                ]),
            ],
        );
    }

    it("keep the keys and focus while rows are added above them", async () => {
        const { container, update } = mountWith(shallowRef(10), editable);
        await settled();
        const input = container.querySelector("input");
        if (!input) throw new Error("no input");
        input.focus();
        await settled();
        expect(grid?.engine.get("interaction")).toEqual({
            rowIndex: 10,
            columnIndex: 2,
        });
        await update(15);
        expect(grid?.model.get("active-position")).toEqual({
            rowIndex: 15,
            columnIndex: 2,
        });
        expect(grid?.engine.get("interaction")).toEqual({
            rowIndex: 15,
            columnIndex: 2,
        });
        expect(document.activeElement).toBe(input);
        expect(input.closest("[data-interacting]")).not.toBeNull();
    });
});
