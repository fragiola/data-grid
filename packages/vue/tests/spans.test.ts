import { describe, expect, it } from "vitest";
import { h, type VNodeChild } from "vue";
import {
    type CellInfo,
    type CellState,
    type Column,
    type HeaderCellInfo,
    type RenderSlotProps,
    type RowInfo,
    typedDataGrid,
} from "../src";
import { cellSpans } from "../src/spans";
import {
    cellAt,
    headerAt,
    renderGrid,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// Column spans (Epic #85, E1.2): `Cells` hands one cell per rendered column, a spanning cell
// standing for the ones it covers; the spanning cell is as wide as its columns, with
// `aria-colspan`, and `colSpan` as a table cell; a header cell spanning columns the same.

interface Row {
    id: number;
}

/** Column spans are a feature (Epic #151): these grids install it. */
const SPANS = [cellSpans()] as const;

const G = typedDataGrid<Row, typeof SPANS>();

const rows: Row[] = Array.from({ length: 20 }, (_, id) => ({ id }));

/** "a" spans "b" and "c" on even rows; "d"'s header cell spans "e" */
const columns: Column<Row, VNodeChild>[] = [
    {
        key: "a",
        name: "A",
        width: 100,
        colSpan: (args) =>
            args.type === "row" && args.row.id % 2 === 0 ? 3 : undefined,
    },
    { key: "b", name: "B", width: 100 },
    { key: "c", name: "C", width: 100 },
    {
        key: "d",
        name: "D",
        width: 100,
        colSpan: ({ type }) => (type === "header" ? 2 : undefined),
    },
    { key: "e", name: "E", width: 100 },
];

stubViewportSize(800, 235);

function grid({
    table = false,
    seen,
}: {
    table?: boolean;
    seen?: (cell: CellInfo<Row>) => void;
} = {}) {
    const tag = tags(table);
    const row = ({ row }: { row: RowInfo<Row> }) => [
        h(
            G.Row,
            { row, as: tag.row },
            {
                default: () => [
                    h(G.Cells, null, {
                        default: ({ cell }: { cell: CellInfo<Row> }) => {
                            seen?.(cell);
                            return [h(G.Cell, { cell, as: tag.cell })];
                        },
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
                        default: ({ cell }: { cell: HeaderCellInfo<Row> }) => [
                            h(G.HeaderCell, { cell, as: tag.headerCell }),
                        ],
                    }),
                ],
            },
        );
    return h(
        G.Root,
        { features: SPANS, columns, rows, rowHeight: 20 },
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
                                        h(G.Rows, null, { default: row }),
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

const cellsOf = (container: ParentNode, rowIndex: number) =>
    [
        ...container.querySelectorAll(
            `[data-grid-part="cell"][data-row-index="${rowIndex}"]`,
        ),
    ].map((cell) => cell.getAttribute("data-column-index"));

describe("column spans", () => {
    for (const table of [false, true]) {
        it(`render a spanning cell as wide as its columns, the covered ones left out${table ? ", as table cells" : ""}`, async () => {
            const { container } = renderGrid(() => grid({ table }));
            await settled();
            expect(cellsOf(container, 0)).toEqual(["0", "3", "4"]);
            expect(cellsOf(container, 1)).toEqual(["0", "1", "2", "3", "4"]);
            const span = cellAt(container, 0, 0);
            expect(span).toHaveAttribute("aria-colspan", "3");
            expect(span.style.width).toBe("300px");
            expect(cellAt(container, 0, 3).style.left).toBe("300px");
            expect(cellAt(container, 1, 0)).not.toHaveAttribute("aria-colspan");
            const header = headerAt(container, 3);
            expect(header).toHaveAttribute("aria-colspan", "2");
            expect(header.style.width).toBe("200px");
            expect(
                container.querySelector(
                    '[data-grid-part="header-cell"][data-column-index="4"]',
                ),
            ).toBeNull();
            if (table) {
                expect(span.tagName).toBe("TD");
                expect(span).toHaveAttribute("colspan", "3");
                expect(header).toHaveAttribute("colspan", "2");
                expect(cellAt(container, 1, 0)).not.toHaveAttribute("colspan");
            }
        });
    }

    it("hand the children one cell per rendered column, a span for the ones it covers", async () => {
        const seen: string[] = [];
        renderGrid(() =>
            grid({
                seen: (cell) => {
                    if (cell.rowIndex === 2) seen.push(cell.column.key);
                },
            }),
        );
        await settled();
        expect([...new Set(seen)]).toEqual(["a", "d", "e"]);
    });
});

describe("a render function (the epic review)", () => {
    it("finds a body cell's span in its props' aria-colspan", async () => {
        const seen = new Map<string, unknown>();
        const cell = ({ cell }: { cell: CellInfo<Row> }) => [
            h(
                G.Cell,
                { cell },
                {
                    render: ({ props }: RenderSlotProps<CellState>) => {
                        seen.set(
                            `${cell.rowIndex}:${cell.columnIndex}`,
                            props["aria-colspan"],
                        );
                        return [h("div", props)];
                    },
                },
            ),
        ];
        const row = ({ row }: { row: RowInfo<Row> }) => [
            h(
                G.Row,
                { row },
                { default: () => [h(G.Cells, null, { default: cell })] },
            ),
        ];
        renderGrid(() =>
            h(
                G.Root,
                { features: SPANS, columns, rows, rowHeight: 20 },
                {
                    default: () => [
                        h(G.Grid, null, {
                            default: () => [
                                h(G.Body, null, {
                                    default: () => [
                                        h(G.Rows, null, { default: row }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                },
            ),
        );
        await settled();
        // row 0 is even: "a" spans 3
        expect(seen.get("0:0")).toBe(3);
        expect(seen.get("1:0")).toBeUndefined();
    });
});
