import { describe, expect, it, vi } from "vitest";
import {
    createTextVNode,
    defineComponent,
    mergeProps,
    ref,
    shallowRef,
    Teleport,
    type VNode,
    type VNodeChild,
} from "vue";
import {
    type CellInfo,
    type CellPosition,
    type Column,
    type ColumnOrGroup,
    DataGrid,
    type DataGridContextValue,
    type GridState,
    type HeaderCellInfo,
    type HeaderCellState,
    type HeaderRowInfo,
    type RenderSlotProps,
    type RootProps,
    type RowInfo,
    type RowState,
    typedDataGrid,
    useDataGrid,
} from "../src";
import {
    click,
    FEATURES,
    type Features,
    h,
    keyDown,
    renderGrid,
    scrollRoot,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// The primitive contract (AGENTS.md): `as` and the `render` slot, never asChild; attributes
// forwarded and listeners composed; structural inline style only (it wins over the consumer's);
// state through data-* and ARIA; no text and no names of their own. jsdom lays nothing out: the
// viewport's size is faked on the root element.

interface Person {
    id: number;
    name: string;
    age: number;
}

const G = typedDataGrid<Person, Features>();

const people: Person[] = Array.from({ length: 1_000 }, (_, i) => ({
    id: i,
    name: `Person ${i}`,
    age: 20 + (i % 50),
}));

const columns: Column<Person, VNodeChild>[] = [
    { key: "name", name: "Name", width: 200 },
    { key: "age", name: "Age", width: 100 },
    {
        key: "label",
        width: 150,
        renderCell: ({ row }) => h("b", row.name.toUpperCase()),
        renderHeaderCell: () => h("i", "Label"),
    },
];

const VIEWPORT = { width: 400, height: 235 };

stubViewportSize(VIEWPORT.width, VIEWPORT.height);

/** The allowed structural inline style keys (AGENTS.md, the primitive contract). */
const STRUCTURAL = new Set([
    "position",
    "top",
    "left",
    "width",
    "height",
    "inset",
    "transform",
    "display",
    "overflow",
    "contain",
    "box-sizing",
    "z-index",
]);

type DivGridProps = Pick<
    RootProps<Person, Features>,
    | "headerRowHeight"
    | "activePosition"
    | "defaultActivePosition"
    | "onActivePositionChange"
    | "onRowWindowChange"
    | "onColumnWindowChange"
> & { rows?: Person[] };

function divGrid({ rows = people, ...props }: DivGridProps = {}) {
    return h(
        G.Root,
        { features: FEATURES, columns, rows, rowHeight: 20, ...props },
        {
            default: () => [
                h(
                    G.Grid,
                    { "aria-label": "People" },
                    { default: () => [h(G.Header), h(G.Body)] },
                ),
            ],
        },
    );
}

function tableGrid() {
    return h(
        G.Root,
        { features: FEATURES, columns, rows: people, rowHeight: 20 },
        {
            default: () => [
                h(
                    G.Grid,
                    { "aria-label": "People", as: "table" },
                    {
                        default: () => [
                            h(
                                G.Header,
                                { as: "thead" },
                                {
                                    default: () => [
                                        h(
                                            G.HeaderRow,
                                            { as: "tr" },
                                            {
                                                default: () => [
                                                    h(
                                                        G.HeaderCells,
                                                        {},
                                                        {
                                                            default: ({
                                                                cell,
                                                            }: {
                                                                cell: HeaderCellInfo<Person>;
                                                            }) => [
                                                                h(
                                                                    G.HeaderCell,
                                                                    {
                                                                        cell,
                                                                        as: "th",
                                                                    },
                                                                ),
                                                            ],
                                                        },
                                                    ),
                                                ],
                                            },
                                        ),
                                    ],
                                },
                            ),
                            h(
                                G.Body,
                                { as: "tbody" },
                                {
                                    default: () => [
                                        h(
                                            G.Rows,
                                            {},
                                            {
                                                default: ({
                                                    row,
                                                }: {
                                                    row: RowInfo<Person>;
                                                }) => [
                                                    h(
                                                        G.Row,
                                                        { row, as: "tr" },
                                                        {
                                                            default: () => [
                                                                h(
                                                                    G.Cells,
                                                                    {},
                                                                    {
                                                                        default:
                                                                            ({
                                                                                cell,
                                                                            }: {
                                                                                cell: CellInfo<Person>;
                                                                            }) => [
                                                                                h(
                                                                                    G.Cell,
                                                                                    {
                                                                                        cell,
                                                                                        as: "td",
                                                                                    },
                                                                                ),
                                                                            ],
                                                                    },
                                                                ),
                                                            ],
                                                        },
                                                    ),
                                                ],
                                            },
                                        ),
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

/** A grid of `columns` and `rows` (and the root's other props) holding `children`. */
function grid(
    props: Partial<
        Pick<
            RootProps<Person, Features>,
            | "defaultActivePosition"
            | "onActivePositionChange"
            | "summaryRows"
            | "rowHeight"
        >
    > & { columns?: ColumnOrGroup<Person, VNodeChild>[]; rows?: Person[] },
    children: () => VNode[],
    gridProps: Record<string, unknown> = {},
) {
    return h(
        G.Root,
        { features: FEATURES, columns, rows: people, ...props },
        { default: () => [h(G.Grid, gridProps, { default: children })] },
    );
}

const parts = (container: HTMLElement, name: string) => [
    ...container.querySelectorAll<HTMLElement>(`[data-grid-part="${name}"]`),
];

const expectStructuralOnly = (container: HTMLElement) => {
    for (const element of container.querySelectorAll<HTMLElement>(
        "[data-grid-part]",
    )) {
        for (const property of [...element.style]) {
            expect(
                STRUCTURAL.has(property),
                `${element.dataset.gridPart}: ${property}`,
            ).toBe(true);
        }
    }
};

describe("the structure", () => {
    it("renders divs by default, with the grid's roles and ARIA", async () => {
        const { container } = renderGrid(() => divGrid());
        await settled();
        const [grid] = parts(container, "grid");
        expect(grid?.tagName).toBe("DIV");
        expect(grid).toHaveAttribute("role", "grid");
        expect(grid).toHaveAttribute("aria-rowcount", "1001");
        expect(grid).toHaveAttribute("aria-colcount", "3");
        expect(parts(container, "header")[0]).toHaveAttribute(
            "role",
            "rowgroup",
        );
        expect(parts(container, "header-row")[0]).toHaveAttribute(
            "aria-rowindex",
            "1",
        );
        const headers = parts(container, "header-cell");
        expect(headers.map((h) => h.getAttribute("role"))).toEqual([
            "columnheader",
            "columnheader",
            "columnheader",
        ]);
        expect(headers.map((h) => h.textContent)).toEqual([
            "Name",
            "Age",
            "Label",
        ]);
        const rows = parts(container, "row");
        // 235px − 35px of header = 200px: 10 rows in view, 4 of overscan below
        expect(rows).toHaveLength(14);
        expect(rows[0]).toHaveAttribute("aria-rowindex", "2");
        const cells = parts(rows[0] as HTMLElement, "cell");
        expect(cells.map((c) => c.getAttribute("aria-colindex"))).toEqual([
            "1",
            "2",
            "3",
        ]);
        expect(cells.map((c) => c.textContent)).toEqual([
            "Person 0",
            "20",
            "PERSON 0",
        ]);
    });

    it("renders real table elements through render, with the same ARIA", async () => {
        const { container } = renderGrid(() => tableGrid());
        await settled();
        expect(container.querySelector("table")).toHaveAttribute(
            "role",
            "grid",
        );
        expect(container.querySelectorAll("thead > tr > th")).toHaveLength(3);
        expect(container.querySelectorAll("tbody > tr")).toHaveLength(14);
        expect(container.querySelectorAll("tbody > tr > td")).toHaveLength(42);
        const td = container.querySelector("td");
        expect(td).toHaveAttribute("role", "gridcell");
        expect(td).toHaveAttribute("data-row-index", "0");
        expect(td).toHaveAttribute("data-column-index", "0");
    });

    it("sizes the grid for the whole dataset", async () => {
        const { container } = renderGrid(() => divGrid());
        await settled();
        const grid = parts(container, "grid")[0];
        expect(grid?.style.width).toBe("450px");
        expect(grid?.style.height).toBe(`${35 + 1_000 * 20}px`);
    });

    it("renders no header without a header row", async () => {
        const { container } = renderGrid(() => divGrid({ headerRowHeight: 0 }));
        await settled();
        expect(parts(container, "header")).toHaveLength(0);
        expect(parts(container, "grid")[0]).toHaveAttribute(
            "aria-rowcount",
            "1000",
        );
    });
});

describe("the primitive contract", () => {
    it("applies only structural inline style", async () => {
        const { container } = renderGrid(() => divGrid());
        await settled();
        expectStructuralOnly(container);
    });

    it("applies only structural inline style with pinned columns: sticky cells, flex rows", async () => {
        const { container } = renderGrid(() =>
            h(
                G.Root,
                {
                    features: FEATURES,
                    columns: columns.map((column, index) =>
                        index === 0
                            ? { ...column, pinned: "start" as const }
                            : column,
                    ),
                    rows: people,
                    rowHeight: 20,
                },
                {
                    default: () => [
                        h(
                            G.Grid,
                            { "aria-label": "People" },
                            { default: () => [h(G.Header), h(G.Body)] },
                        ),
                    ],
                },
            ),
        );
        await settled();
        const pinned = container.querySelectorAll<HTMLElement>("[data-pinned]");
        expect(pinned.length).toBeGreaterThan(1);
        for (const element of pinned) {
            expect(element.style.position).toBe("sticky");
        }
        expectStructuralOnly(container);
    });

    it("sets no accessible name of its own", async () => {
        const { container } = renderGrid(() =>
            grid({}, () => [h(G.Header), h(G.Body)]),
        );
        await settled();
        expect(container.querySelectorAll("[aria-label]")).toHaveLength(0);
    });

    // Vue has no `className`/`style` functions: the state-based class goes through the `render`
    // slot's state; a plain class and style are merged, and the structural keys still win
    it("resolves className and style functions against the state; structural keys win", async () => {
        const { container } = renderGrid(() =>
            grid(
                { defaultActivePosition: { rowIndex: 1, columnIndex: 1 } },
                () => [
                    h(
                        G.Body,
                        {},
                        {
                            default: () => [
                                h(
                                    G.Rows,
                                    {},
                                    {
                                        default: ({
                                            row,
                                        }: {
                                            row: RowInfo<Person>;
                                        }) => [
                                            h(
                                                G.Row,
                                                { row },
                                                {
                                                    render: ({
                                                        props,
                                                        state,
                                                        children,
                                                    }: RenderSlotProps<RowState>) => [
                                                        h(
                                                            "div",
                                                            mergeProps(props, {
                                                                class: state.active
                                                                    ? "row is-active"
                                                                    : "row",
                                                            }),
                                                            [h(children)],
                                                        ),
                                                    ],
                                                },
                                            ),
                                        ],
                                    },
                                ),
                            ],
                        },
                    ),
                ],
                { class: "grid", style: { color: "red", width: "1px" } },
            ),
        );
        await settled();
        const grid0 = parts(container, "grid")[0];
        expect(grid0).toHaveClass("grid");
        expect(grid0?.style.color).toBe("red");
        expect(grid0?.style.width).not.toBe("1px");
        const rows = parts(container, "row");
        expect(rows[1]).toHaveClass("row", "is-active");
        expect(rows[0]).not.toHaveClass("is-active");
        expect(rows[0]).toHaveClass("row");

        // a cell's own style: merged, its `position` the structural one
        const cells = renderGrid(() =>
            grid(
                { defaultActivePosition: { rowIndex: 1, columnIndex: 1 } },
                () => [
                    h(
                        G.Body,
                        {},
                        {
                            default: () => [
                                h(
                                    G.Rows,
                                    {},
                                    {
                                        default: ({
                                            row,
                                        }: {
                                            row: RowInfo<Person>;
                                        }) => [
                                            h(
                                                G.Row,
                                                { row },
                                                {
                                                    default: () => [
                                                        h(
                                                            G.Cells,
                                                            {},
                                                            {
                                                                default: ({
                                                                    cell,
                                                                }: {
                                                                    cell: CellInfo<Person>;
                                                                }) => [
                                                                    h(G.Cell, {
                                                                        cell,
                                                                        style: {
                                                                            outlineWidth:
                                                                                "2px",
                                                                            position:
                                                                                "static",
                                                                        },
                                                                    }),
                                                                ],
                                                            },
                                                        ),
                                                    ],
                                                },
                                            ),
                                        ],
                                    },
                                ),
                            ],
                        },
                    ),
                ],
            ),
        );
        await settled();
        const active = cells.container.querySelector<HTMLElement>(
            "[data-active][data-grid-part=cell]",
        );
        expect(active?.style.outlineWidth).toBe("2px");
        expect(active?.style.position).toBe("absolute");
    });

    it("renders through a render function with the props and the state", async () => {
        const { container } = renderGrid(() =>
            h(
                G.Root,
                { features: FEATURES, columns, rows: people },
                {
                    default: () => [
                        h(
                            G.Grid,
                            {},
                            {
                                render: ({
                                    props,
                                    state,
                                    children,
                                }: RenderSlotProps<GridState>) => [
                                    h(
                                        "section",
                                        {
                                            ...props,
                                            "data-count": state.rowCount,
                                        },
                                        [h(children)],
                                    ),
                                ],
                                default: () => [h(G.Body)],
                            },
                        ),
                    ],
                },
            ),
        );
        await settled();
        const section = container.querySelector("section");
        expect(section).toHaveAttribute("role", "grid");
        expect(section).toHaveAttribute("data-count", "1000");
    });

    // React's `ref` merging has no Vue counterpart (a template ref is the component): the
    // attributes and the listeners still go through
    it("merges refs, forwards props and composes handlers", async () => {
        const onClick = vi.fn();
        const { container } = renderGrid(() =>
            grid({}, () => [h(G.Body)], { id: "people", onClick }),
        );
        await settled();
        const grid0 = parts(container, "grid")[0];
        expect(grid0).toHaveAttribute("id", "people");
        click(grid0 as HTMLElement);
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('marks state with present-or-absent data attributes, never "false"', async () => {
        const loaded = new Map([[0, people[0]]]);
        const { container } = renderGrid(() =>
            h(
                G.Root,
                {
                    features: FEATURES,
                    columns,
                    rowCount: 100,
                    getRow: (index: number) => loaded.get(index),
                    defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
                },
                {
                    default: () => [
                        h(G.Grid, {}, { default: () => [h(G.Body)] }),
                    ],
                },
            ),
        );
        await settled();
        const rows = parts(container, "row");
        expect(rows[0]).not.toHaveAttribute("data-loading");
        expect(rows[0]).toHaveAttribute("data-active", "");
        expect(rows[1]).toHaveAttribute("data-loading", "");
        expect(rows[1]).not.toHaveAttribute("data-active");
        expect(container.innerHTML).not.toContain('="false"');
        // a row not loaded renders its cells, empty
        expect(
            parts(rows[1] as HTMLElement, "cell").map((c) => c.textContent),
        ).toEqual(["", "", ""]);
    });
});

describe("the active cell", () => {
    it("works uncontrolled: the keyboard moves it, and the change is reported", async () => {
        const onChange = vi.fn();
        const { container } = renderGrid(() =>
            divGrid({
                defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
                onActivePositionChange: onChange,
            }),
        );
        await settled();
        const cell = container.querySelector<HTMLElement>(
            '[data-row-index="0"][data-column-index="0"]',
        );
        expect(cell).toHaveAttribute("tabindex", "0");
        keyDown(cell as HTMLElement, { key: "ArrowRight" });
        await settled();
        expect(onChange).toHaveBeenLastCalledWith({
            rowIndex: 0,
            columnIndex: 1,
        });
        expect(
            container.querySelector(
                '[data-row-index="0"][data-column-index="1"]',
            ),
        ).toHaveAttribute("data-active", "");
        expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    });

    it("works controlled: a move asks, and only the prop moves it", async () => {
        const onChange = vi.fn();
        const position = shallowRef<CellPosition>({
            rowIndex: 2,
            columnIndex: 0,
        });
        const { container } = renderGrid(() =>
            divGrid({
                activePosition: position.value,
                onActivePositionChange: onChange,
            }),
        );
        await settled();
        const at = (row: number, column: number) =>
            container.querySelector(
                `[data-row-index="${row}"][data-column-index="${column}"]`,
            );
        keyDown(at(2, 0) as HTMLElement, { key: "ArrowDown" });
        await settled();
        expect(onChange).toHaveBeenCalledWith({ rowIndex: 3, columnIndex: 0 });
        // the parent did not follow: still on row 2
        expect(at(2, 0)).toHaveAttribute("data-active", "");
        position.value = { rowIndex: 3, columnIndex: 0 };
        await settled();
        expect(at(3, 0)).toHaveAttribute("data-active", "");
    });

    it("follows the model: useDataGrid().model.run changes the same state, through onChange when controlled", async () => {
        let grid: DataGridContextValue<Person, Features> | null = null;
        const Probe = defineComponent({
            setup() {
                grid = useDataGrid<Person, Features>();
                return () => null;
            },
        });
        const position = ref<CellPosition | null>(null);
        const { container } = renderGrid(() =>
            h(
                G.Root,
                {
                    features: FEATURES,
                    columns,
                    rows: people,
                    activePosition: position.value,
                    onActivePositionChange: (next: CellPosition | null) => {
                        position.value = next;
                    },
                },
                {
                    default: () => [
                        h(Probe),
                        h(G.Grid, {}, { default: () => [h(G.Body)] }),
                    ],
                },
            ),
        );
        await settled();
        (grid as DataGridContextValue<Person, Features> | null)?.model.run(
            "active-position.set",
            { rowIndex: 4, columnIndex: 2 },
        );
        await settled();
        expect(
            container.querySelector(
                '[data-row-index="4"][data-column-index="2"]',
            ),
        ).toHaveAttribute("data-active", "");
    });

    it("lets a cell's own onKeyDown cancel a key", async () => {
        const onChange = vi.fn();
        const { container } = renderGrid(() =>
            grid(
                {
                    defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
                    onActivePositionChange: onChange,
                },
                () => [
                    h(
                        G.Body,
                        {},
                        {
                            default: () => [
                                h(
                                    G.Rows,
                                    {},
                                    {
                                        default: ({
                                            row,
                                        }: {
                                            row: RowInfo<Person>;
                                        }) => [
                                            h(
                                                G.Row,
                                                { row },
                                                {
                                                    default: () => [
                                                        h(
                                                            G.Cells,
                                                            {},
                                                            {
                                                                default: ({
                                                                    cell,
                                                                }: {
                                                                    cell: CellInfo<Person>;
                                                                }) => [
                                                                    h(G.Cell, {
                                                                        cell,
                                                                        onKeydown:
                                                                            (
                                                                                event: KeyboardEvent,
                                                                            ) => {
                                                                                if (
                                                                                    event.key ===
                                                                                    "ArrowRight"
                                                                                )
                                                                                    event.preventDefault();
                                                                            },
                                                                    }),
                                                                ],
                                                            },
                                                        ),
                                                    ],
                                                },
                                            ),
                                        ],
                                    },
                                ),
                            ],
                        },
                    ),
                ],
            ),
        );
        await settled();
        const cell = container.querySelector(
            '[data-row-index="0"][data-column-index="0"]',
        ) as HTMLElement;
        keyDown(cell, { key: "ArrowRight" });
        await settled();
        expect(onChange).not.toHaveBeenCalled();
        keyDown(cell, { key: "ArrowDown" });
        await settled();
        expect(onChange).toHaveBeenCalledWith({ rowIndex: 1, columnIndex: 0 });
    });

    it("makes the grid the tab stop while no cell is active", async () => {
        const { container } = renderGrid(() => divGrid());
        await settled();
        expect(parts(container, "grid")[0]).toHaveAttribute("tabindex", "0");
        expect(
            container.querySelectorAll('[data-grid-part=cell][tabindex="0"]'),
        ).toHaveLength(0);
    });
});

describe("the empty state", () => {
    function emptyGrid(rows: Person[]) {
        return h(
            G.Root,
            { features: FEATURES, columns, rows, rowHeight: 20 },
            {
                default: () => [
                    h(
                        G.Grid,
                        { "aria-label": "People" },
                        {
                            default: () => [
                                h(G.Header),
                                h(G.Body),
                                h(
                                    G.Empty,
                                    { class: "empty" },
                                    { default: () => [h("p", "No people")] },
                                ),
                            ],
                        },
                    ),
                ],
            },
        );
    }

    it("renders its children only while there are no rows, and marks the root and the grid", async () => {
        const rows = shallowRef<Person[]>([]);
        const { container } = renderGrid(() => emptyGrid(rows.value));
        await settled();
        const [empty] = parts(container, "empty");
        expect(empty?.textContent).toBe("No people");
        expect(empty).toHaveClass("empty");
        expect(parts(container, "root")[0]).toHaveAttribute("data-empty", "");
        expect(parts(container, "grid")[0]).toHaveAttribute("data-empty", "");
        expect(parts(container, "row")).toHaveLength(0);
        // the header stays: the columns are still there
        expect(parts(container, "header-cell")).toHaveLength(3);

        rows.value = people.slice(0, 3);
        await settled();
        expect(parts(container, "empty")).toHaveLength(0);
        expect(parts(container, "root")[0]).not.toHaveAttribute("data-empty");
        expect(parts(container, "grid")[0]).not.toHaveAttribute("data-empty");
        expect(parts(container, "row")).toHaveLength(3);
    });

    it("fills the visible body below the header in an area of its own, and stays in view sideways", async () => {
        const { container } = renderGrid(() => emptyGrid([]));
        await settled();
        const [area] = parts(container, "empty-area");
        // the viewport is 400 × 235, the header 35 high
        expect(area?.style.position).toBe("sticky");
        expect(area?.style.left).toBe("0px");
        expect(area?.style.width).toBe("400px");
        expect(area?.style.height).toBe("200px");
        // the empty state is a cell in a row, both as tall as the area (Epic #89, E5.2)
        const [row] = parts(container, "empty-row");
        const [empty] = parts(container, "empty");
        expect(row?.parentElement).toBe(area);
        expect(empty?.parentElement).toBe(row);
        for (const element of [area, row, empty]) {
            for (const property of [...(element?.style ?? [])]) {
                expect(STRUCTURAL.has(property), property).toBe(true);
            }
        }
        expect(empty?.style.height).toBe("100%");
        // the grid is at least as large as the visible area, so the empty state has room
        const [grid0] = parts(container, "grid");
        expect(grid0?.style.width).toBe("450px");
        expect(grid0?.style.height).toBe("235px");
    });

    // React's `ref` merging and `className` function have no Vue counterpart: `as`, the
    // attributes, the listeners, a plain class and style, and the `render` slot
    it("follows the primitive contract: render, ref, handlers, className and style", async () => {
        const onClick = vi.fn();
        const { container } = renderGrid(() =>
            h(
                G.Root,
                { features: FEATURES, columns, rows: [] },
                {
                    default: () => [
                        h(
                            G.Grid,
                            { as: "table" },
                            {
                                default: () => [
                                    h(G.Body, { as: "tbody" }),
                                    h(
                                        G.Empty,
                                        {
                                            as: "td",
                                            id: "nothing",
                                            onClick,
                                            class: "from-a-function",
                                            style: {
                                                color: "red",
                                                display: "flex",
                                                height: "1px",
                                            },
                                        },
                                        {
                                            default: () => [
                                                h("span", "No people"),
                                            ],
                                        },
                                    ),
                                ],
                            },
                        ),
                    ],
                },
            ),
        );
        await settled();
        // a table's cell: in a row and a row group of the table's own
        const [empty] = parts(container, "empty");
        expect(empty?.tagName).toBe("TD");
        expect(empty?.parentElement?.tagName).toBe("TR");
        expect(empty?.parentElement?.parentElement?.tagName).toBe("TBODY");
        expect(empty).toHaveAttribute("colspan", String(columns.length));
        expect(empty).not.toHaveAttribute("role");
        expect(empty).toHaveAttribute("id", "nothing");
        expect(empty).toHaveClass("from-a-function");
        // the consumer's style is merged under the structural one
        expect(empty?.style.color).toBe("red");
        expect(empty?.style.display).toBe("block");
        expect(empty?.style.height).toBe("100%");
        click(empty?.querySelector("span") as HTMLElement);
        expect(onClick).toHaveBeenCalledTimes(1);

        const rendered = vi.fn(
            ({ props }: { props: Record<string, unknown> }) => [
                h("div", props),
            ],
        );
        renderGrid(() =>
            h(
                G.Root,
                { features: FEATURES, columns, rows: [] },
                {
                    default: () => [
                        h(
                            G.Grid,
                            {},
                            {
                                default: () => [
                                    h(G.Empty, {}, { render: rendered }),
                                ],
                            },
                        ),
                    ],
                },
            ),
        );
        await settled();
        expect(rendered).toHaveBeenCalled();
        expect(rendered.mock.calls[0]?.[0].props).toMatchObject({
            "data-grid-part": "empty",
            role: "gridcell",
        });
    });

    it("spans the columns when they are narrower than the view, the view without columns", async () => {
        const narrow: Column<Person, VNodeChild>[] = [
            { key: "name", width: 100 },
            { key: "age", width: 50 },
        ];
        const emptyOf = (cells: Column<Person, VNodeChild>[]) =>
            h(
                G.Root,
                { features: FEATURES, columns: cells, rows: [] },
                {
                    default: () => [
                        h(
                            G.Grid,
                            {},
                            {
                                default: () => [
                                    h(G.Header),
                                    h(G.Body),
                                    h(G.Empty),
                                ],
                            },
                        ),
                    ],
                },
            );
        const { container } = renderGrid(() => emptyOf(narrow));
        await settled();
        // 150px of columns in a 400px viewport: the grid is 400px wide, the empty state sits
        // under the columns (Epic #113)
        expect(parts(container, "grid")[0]?.style.width).toBe("400px");
        expect(parts(container, "empty-area")[0]?.style.width).toBe("150px");
        const none = renderGrid(() => emptyOf([]));
        await settled();
        expect(parts(none.container, "empty-area")[0]?.style.width).toBe(
            "400px",
        );
    });

    it("finds a table's structure from a render function's `<td>` too", async () => {
        const { container } = renderGrid(() =>
            h(
                G.Root,
                { features: FEATURES, columns, rows: [] },
                {
                    default: () => [
                        h(
                            G.Grid,
                            { as: "table" },
                            {
                                default: () => [
                                    h(G.Body, { as: "tbody" }),
                                    h(
                                        G.Empty,
                                        { style: { color: "red" } },
                                        {
                                            render: ({
                                                props,
                                                children,
                                            }: RenderSlotProps<
                                                Record<string, never>
                                            >) => [
                                                h("td", props, [h(children)]),
                                            ],
                                            default: () => [
                                                createTextVNode("No people"),
                                            ],
                                        },
                                    ),
                                ],
                            },
                        ),
                    ],
                },
            ),
        );
        await settled();
        const [empty] = parts(container, "empty");
        expect(empty?.tagName).toBe("TD");
        expect(empty?.parentElement?.tagName).toBe("TR");
        expect(empty?.parentElement?.parentElement?.tagName).toBe("TBODY");
        expect(empty).toHaveAttribute("colspan", String(columns.length));
        expect(empty).not.toHaveAttribute("role");
        expect(empty).not.toHaveAttribute("aria-colspan");
        expect(empty?.style.color).toBe("red");
        expect(empty?.style.display).toBe("block");
    });

    it("takes a table's structure in a table grid, whatever renders its cell (a component)", async () => {
        // the app's own cell component, rendering a `<td>`
        const Td = defineComponent({
            setup(_props, { slots }) {
                return () => h("td", slots.default?.());
            },
        });
        const tableEmpty = (as?: typeof Td) =>
            h(
                G.Root,
                { features: FEATURES, columns, rows: [] },
                {
                    default: () => [
                        h(
                            G.Grid,
                            { as: "table" },
                            {
                                default: () => [
                                    h(G.Body, { as: "tbody" }),
                                    h(G.Empty, as ? { as } : null, {
                                        default: () => [
                                            createTextVNode("No people"),
                                        ],
                                    }),
                                ],
                            },
                        ),
                    ],
                },
            );
        const { container } = renderGrid(() => tableEmpty(Td));
        await settled();
        const [empty] = parts(container, "empty");
        expect(empty?.tagName).toBe("TD");
        expect(empty?.parentElement?.tagName).toBe("TR");
        expect(empty?.parentElement?.parentElement?.tagName).toBe("TBODY");
        expect(empty).toHaveAttribute("colspan", String(columns.length));
        expect(empty).not.toHaveAttribute("role");
        // without `as`, a table grid's empty state is a `<td>` too
        const plain = renderGrid(() => tableEmpty());
        await settled();
        const [cell] = parts(plain.container, "empty");
        expect(cell?.tagName).toBe("TD");
        expect(cell?.parentElement?.tagName).toBe("TR");
    });

    it("counts no empty line in ARIA without an empty state", async () => {
        const { container } = renderGrid(() =>
            grid({ rows: [] }, () => [h(G.Header), h(G.Body)]),
        );
        await settled();
        // the header row only
        expect(parts(container, "grid")[0]).toHaveAttribute(
            "aria-rowcount",
            "1",
        );
    });

    it("counts its row in ARIA, after the header rows and before the bottom summary rows", async () => {
        const { container } = renderGrid(() =>
            grid({ rows: [], summaryRows: { top: 1, bottom: 1 } }, () => [
                h(G.Header),
                h(G.Summary, { position: "top" }),
                h(G.Body),
                h(G.Summary, { position: "bottom" }),
                h(G.Empty),
            ]),
        );
        await settled();
        // the header row, the top summary row, the empty state's row, the bottom summary row
        expect(parts(container, "grid")[0]).toHaveAttribute(
            "aria-rowcount",
            "4",
        );
        expect(parts(container, "empty-row")[0]).toHaveAttribute(
            "aria-rowindex",
            "3",
        );
        const summaryRows = container.querySelectorAll(
            '[data-grid-part="summary-row"]',
        );
        expect(
            [...summaryRows].map((row) => row.getAttribute("aria-rowindex")),
        ).toEqual(["2", "4"]);
    });

    it("is a row and a cell spanning the columns, with no text or name of its own", async () => {
        const { container } = renderGrid(() =>
            grid({ rows: [] }, () => [h(G.Body), h(G.Empty)]),
        );
        await settled();
        const [empty] = parts(container, "empty");
        expect(parts(container, "empty-row")[0]).toHaveAttribute("role", "row");
        expect(parts(container, "empty-area")[0]).not.toHaveAttribute("role");
        expect(empty).toHaveAttribute("role", "gridcell");
        expect(empty).toHaveAttribute("aria-colspan", String(columns.length));
        // not a cell of the grid's: no indexes (the keys and the tab order leave it alone)
        expect(empty).not.toHaveAttribute("data-row-index");
        expect(empty?.textContent).toBe("");
        expect(container.querySelectorAll("[aria-label]")).toHaveLength(0);
    });
});

describe("column groups", () => {
    // "id" spans both header rows; "person" groups name and age; "label" stays a column of its row
    const groupedColumns: ColumnOrGroup<Person, VNodeChild>[] = [
        { key: "id", name: "#", width: 50 },
        {
            key: "person",
            name: "Person",
            children: [
                { key: "name", name: "Name", width: 200 },
                { key: "age", name: "Age", width: 100 },
            ],
        },
    ];

    // React's `className` functions read the state; here the same classes come from the slots'
    // row and cell (a render slot would lose `as`'s table spans)
    function groupedGrid({ table = false }: { table?: boolean } = {}) {
        const tag = tags(table);
        return h(
            G.Root,
            {
                features: FEATURES,
                columns: groupedColumns,
                rows: people,
                rowHeight: 20,
            },
            {
                default: () => [
                    h(
                        G.Grid,
                        { "aria-label": "People", as: tag.grid },
                        {
                            default: () => [
                                h(
                                    G.Header,
                                    { as: tag.header },
                                    {
                                        default: () => [
                                            h(
                                                G.HeaderRows,
                                                {},
                                                {
                                                    default: ({
                                                        row,
                                                    }: {
                                                        row: HeaderRowInfo<Person>;
                                                    }) => [
                                                        h(
                                                            G.HeaderRow,
                                                            {
                                                                row,
                                                                as: tag.headerRow,
                                                                class: `level${row.rowIndex}`,
                                                            },
                                                            {
                                                                default: () => [
                                                                    h(
                                                                        G.HeaderCells,
                                                                        null,
                                                                        {
                                                                            default:
                                                                                ({
                                                                                    cell,
                                                                                }: {
                                                                                    cell: HeaderCellInfo<Person>;
                                                                                }) => [
                                                                                    h(
                                                                                        G.HeaderCell,
                                                                                        {
                                                                                            cell,
                                                                                            as: tag.headerCell,
                                                                                            class: cell.group
                                                                                                ? "group"
                                                                                                : "column",
                                                                                        },
                                                                                    ),
                                                                                ],
                                                                        },
                                                                    ),
                                                                ],
                                                            },
                                                        ),
                                                    ],
                                                },
                                            ),
                                        ],
                                    },
                                ),
                                h(G.Body, { as: tag.body }),
                            ],
                        },
                    ),
                ],
            },
        );
    }

    const headerCell = (container: HTMLElement, row: number, column: number) =>
        container.querySelector<HTMLElement>(
            `[data-grid-part="header-cell"][data-row-index="${row}"][data-column-index="${column}"]`,
        );

    it("renders a header row per level, the group spanning its columns", async () => {
        const { container } = renderGrid(() => groupedGrid());
        await settled();
        const rows = parts(container, "header-row");
        expect(rows.map((row) => row.getAttribute("aria-rowindex"))).toEqual([
            "1",
            "2",
        ]);
        expect(rows.map((row) => row.className)).toEqual([
            "level-2",
            "level-1",
        ]);
        expect(rows.map((row) => [row.style.top, row.style.height])).toEqual([
            ["0px", "35px"],
            ["35px", "35px"],
        ]);
        // an upper row stays above the next: "id" reaches down into it
        expect(rows.map((row) => row.style.zIndex)).toEqual(["2", "1"]);
        expect(parts(container, "header")[0]?.style.height).toBe("70px");
        expect(parts(container, "grid")[0]).toHaveAttribute(
            "aria-rowcount",
            "1002",
        );
        expect(
            parts(rows[0] as HTMLElement, "header-cell").map(
                (c) => c.textContent,
            ),
        ).toEqual(["#", "Person"]);
        expect(
            parts(rows[1] as HTMLElement, "header-cell").map(
                (c) => c.textContent,
            ),
        ).toEqual(["Name", "Age"]);
        const group = headerCell(container, -2, 1);
        expect(group).toHaveAttribute("data-group", "");
        expect(group).toHaveClass("group");
        expect(group).toHaveAttribute("aria-colindex", "2");
        expect(group).toHaveAttribute("aria-colspan", "2");
        expect(group?.style.left).toBe("50px");
        expect(group?.style.width).toBe("300px");
        expect(group?.style.height).toBe("35px");
        const id = headerCell(container, -2, 0);
        expect(id).not.toHaveAttribute("data-group");
        expect(id).toHaveClass("column");
        expect(id).toHaveAttribute("aria-rowspan", "2");
        expect(id?.style.height).toBe("70px");
        // the body starts below both header rows: 165px of it in view
        expect(parts(container, "row")[0]).toHaveAttribute(
            "aria-rowindex",
            "3",
        );
        expect(parts(container, "row")).toHaveLength(13);
    });

    it("keeps a single header row without a z-index", async () => {
        const { container } = renderGrid(() => divGrid());
        await settled();
        expect(parts(container, "header-row")[0]?.style.zIndex).toBe("");
    });

    it("keeps a nested grid's header rows its own", async () => {
        const inner = () =>
            h(
                DataGrid.Root,
                {
                    features: FEATURES,
                    columns: [{ key: "x", name: "X", width: 40 }],
                    rows: people.slice(0, 2),
                },
                {
                    default: () => [
                        h(
                            DataGrid.Grid,
                            { "aria-label": "inner" },
                            {
                                default: () => [
                                    h(
                                        DataGrid.Header,
                                        {},
                                        {
                                            default: () => [
                                                h(DataGrid.HeaderRow),
                                            ],
                                        },
                                    ),
                                ],
                            },
                        ),
                    ],
                },
            );
        const { container } = renderGrid(() =>
            grid({ columns: groupedColumns }, () => [
                h(
                    G.Header,
                    {},
                    {
                        default: () => [
                            h(
                                G.HeaderRows,
                                {},
                                {
                                    default: ({
                                        row,
                                    }: {
                                        row: HeaderRowInfo<Person>;
                                    }) => [
                                        h(
                                            G.HeaderRow,
                                            { row },
                                            {
                                                default: () => [
                                                    h(
                                                        G.HeaderCells,
                                                        {},
                                                        {
                                                            default: ({
                                                                cell,
                                                            }: {
                                                                cell: HeaderCellInfo<Person>;
                                                            }) => [
                                                                h(
                                                                    G.HeaderCell,
                                                                    { cell },
                                                                    {
                                                                        default:
                                                                            () => [
                                                                                cell.key ===
                                                                                "id"
                                                                                    ? inner()
                                                                                    : createTextVNode(
                                                                                          cell.key,
                                                                                      ),
                                                                            ],
                                                                    },
                                                                ),
                                                            ],
                                                        },
                                                    ),
                                                ],
                                            },
                                        ),
                                    ],
                                },
                            ),
                        ],
                    },
                ),
            ]),
        );
        await settled();
        const innerGrid = container.querySelector(
            '[aria-label="inner"]',
        ) as HTMLElement;
        expect(
            parts(innerGrid, "header-cell").map((cell) => cell.textContent),
        ).toEqual(["X"]);
    });

    it("renders by default a header row per level, and only structural inline style", async () => {
        const { container } = renderGrid(() =>
            grid({ columns: groupedColumns }, () => [h(G.Header), h(G.Body)]),
        );
        await settled();
        expect(parts(container, "header-row")).toHaveLength(2);
        expect(parts(container, "header-cell")).toHaveLength(4);
        expectStructuralOnly(container);
    });

    it("spans table cells: th gets colSpan and rowSpan, divs do not", async () => {
        const table = renderGrid(() => groupedGrid({ table: true }));
        await settled();
        expect(headerCell(table.container, -2, 1)?.tagName).toBe("TH");
        expect(headerCell(table.container, -2, 1)).toHaveAttribute(
            "colspan",
            "2",
        );
        expect(headerCell(table.container, -2, 0)).toHaveAttribute(
            "rowspan",
            "2",
        );
        expect(headerCell(table.container, -1, 1)).not.toHaveAttribute(
            "colspan",
        );
        expect(table.container.querySelectorAll("thead > tr")).toHaveLength(2);
        table.unmount();
        const divs = renderGrid(() => groupedGrid());
        await settled();
        expect(headerCell(divs.container, -2, 1)).not.toHaveAttribute(
            "colspan",
        );
    });

    it("renders a group's renderHeaderCell, and hands a render function the spans", async () => {
        const rendered = vi.fn(
            ({
                props,
                children,
            }: {
                props: Record<string, unknown>;
                state: HeaderCellState;
                children: VNode;
            }) => [h("div", props, [h(children)])],
        );
        const grouped: ColumnOrGroup<Person, VNodeChild>[] = [
            {
                key: "person",
                renderHeaderCell: ({ group, columnIndex, columnSpan }) =>
                    h("b", `${group.key} ${columnIndex}+${columnSpan}`),
                children: [
                    { key: "name", width: 100 },
                    { key: "age", width: 100 },
                ],
            },
        ];
        const { container } = renderGrid(() =>
            grid({ columns: grouped }, () => [
                h(
                    G.Header,
                    {},
                    {
                        default: () => [
                            h(
                                G.HeaderRows,
                                {},
                                {
                                    default: ({
                                        row,
                                    }: {
                                        row: HeaderRowInfo<Person>;
                                    }) => [
                                        h(
                                            G.HeaderRow,
                                            { row },
                                            {
                                                default: () => [
                                                    h(
                                                        G.HeaderCells,
                                                        {},
                                                        {
                                                            default: ({
                                                                cell,
                                                            }: {
                                                                cell: HeaderCellInfo<Person>;
                                                            }) => [
                                                                cell.group
                                                                    ? h(
                                                                          G.HeaderCell,
                                                                          {
                                                                              cell,
                                                                          },
                                                                      )
                                                                    : h(
                                                                          G.HeaderCell,
                                                                          {
                                                                              cell,
                                                                          },
                                                                          {
                                                                              render: rendered,
                                                                          },
                                                                      ),
                                                            ],
                                                        },
                                                    ),
                                                ],
                                            },
                                        ),
                                    ],
                                },
                            ),
                        ],
                    },
                ),
            ]),
        );
        await settled();
        expect(headerCell(container, -2, 0)?.innerHTML).toBe(
            "<b>person 0+2</b>",
        );
        expect(rendered.mock.calls[0]?.[0].state).toMatchObject({
            rowIndex: -1,
            columnSpan: 1,
            rowSpan: 1,
            group: false,
        });
    });

    it("marks the active cell: a group, and a column spanning header rows on any of them", async () => {
        const { container } = renderGrid(() => groupedGrid());
        await settled();
        const group = headerCell(container, -2, 1);
        group?.focus();
        await settled();
        expect(group).toHaveAttribute("data-active", "");
        expect(group).toHaveAttribute("tabindex", "0");
        // down to the group's first column, left to "id" on the columns' row: its one element
        keyDown(group as HTMLElement, { key: "ArrowDown" });
        await settled();
        const name = headerCell(container, -1, 1);
        expect(name).toHaveAttribute("data-active", "");
        keyDown(name as HTMLElement, { key: "ArrowLeft" });
        await settled();
        const id = headerCell(container, -2, 0);
        expect(id).toHaveAttribute("data-active", "");
        expect(document.activeElement).toBe(id);
        keyDown(id as HTMLElement, { key: "ArrowRight" });
        await settled();
        expect(document.activeElement).toBe(name);
    });

    it("keeps the columns as given: no columns.set on mount, nor for the same array", async () => {
        let model: DataGridContextValue<Person>["model"] | undefined;
        let firstHeader: unknown;
        const Grab = defineComponent({
            setup() {
                model = useDataGrid<Person, Features>().model;
                // read in setup, before the root's mounted hook runs
                firstHeader ??= model.state.header;
                return () => null;
            },
        });
        const commands: string[] = [];
        const version = ref(0);
        renderGrid(() =>
            h(
                G.Root,
                {
                    features: FEATURES,
                    columns: groupedColumns,
                    rows: people,
                    "data-version": version.value,
                },
                { default: () => [h(Grab)] },
            ),
        );
        await settled();
        // a columns.set on mount would have laid the header out again
        expect(model?.state.header).toBe(firstHeader);
        model?.subscribe(({ command }) => commands.push(command));
        version.value += 1;
        await settled();
        expect(model?.get("column-entries")).toBe(groupedColumns);
        expect(commands).not.toContain("columns.set");
    });
});

describe("regressions", () => {
    it("goes back to the default row height when the prop is removed", async () => {
        const rowHeight = ref<number | undefined>(50);
        const { container } = renderGrid(() =>
            grid(
                rowHeight.value === undefined
                    ? {}
                    : { rowHeight: rowHeight.value },
                () => [h(G.Body)],
            ),
        );
        await settled();
        expect(parts(container, "row")[0]?.style.height).toBe("50px");
        rowHeight.value = undefined;
        await settled();
        expect(parts(container, "row")[0]?.style.height).toBe("35px");
    });

    it("tells a controlled parent when the grid's shape moved the active cell", async () => {
        const onChange = vi.fn();
        const rows = shallowRef(people);
        renderGrid(() =>
            divGrid({
                rows: rows.value,
                activePosition: { rowIndex: 50, columnIndex: 0 },
                onActivePositionChange: onChange,
            }),
        );
        await settled();
        rows.value = people.slice(0, 10);
        await settled();
        expect(onChange).toHaveBeenCalledWith({ rowIndex: 9, columnIndex: 0 });
    });

    it("keeps a row's elements when it loads in place", async () => {
        const loaded = new Map<number, Person>();
        const getRow = shallowRef((index: number) => loaded.get(index));
        const { container } = renderGrid(() =>
            h(
                G.Root,
                {
                    features: FEATURES,
                    columns,
                    rowCount: 100,
                    getRow: getRow.value,
                },
                {
                    default: () => [
                        h(G.Grid, {}, { default: () => [h(G.Body)] }),
                    ],
                },
            ),
        );
        await settled();
        const before = container.querySelector(
            '[data-row-index="3"][data-column-index="0"]',
        );
        loaded.set(3, people[3] as Person);
        getRow.value = (index: number) => loaded.get(index);
        await settled();
        const after = container.querySelector(
            '[data-row-index="3"][data-column-index="0"]',
        );
        expect(after).toBe(before);
        expect(after?.textContent).toBe("Person 3");
    });
});

describe("epic review regressions", () => {
    it("keeps a controlled position the parent changes with the rows in the same update", async () => {
        const onChange = vi.fn();
        const state = shallowRef<{ rows: Person[]; position: CellPosition }>({
            rows: people,
            position: { rowIndex: 500, columnIndex: 0 },
        });
        const { container } = renderGrid(() =>
            divGrid({
                rows: state.value.rows,
                activePosition: state.value.position,
                onActivePositionChange: onChange,
            }),
        );
        await settled();
        state.value = {
            rows: people.slice(0, 10),
            position: { rowIndex: 0, columnIndex: 1 },
        };
        await settled();
        expect(onChange).not.toHaveBeenCalled();
        expect(
            container.querySelector(
                '[data-row-index="0"][data-column-index="1"]',
            ),
        ).toHaveAttribute("data-active", "");
    });

    // React's render element's own onKeyDown: in Vue, a listener on the root (`as="section"`),
    // which runs before the engine's
    it("lets the root's render element cancel a key", async () => {
        const onChange = vi.fn();
        const { container } = renderGrid(() =>
            h(
                G.Root,
                {
                    features: FEATURES,
                    columns,
                    rows: people,
                    defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
                    onActivePositionChange: onChange,
                    as: "section",
                    onKeydown: (event: KeyboardEvent) => {
                        if (event.key === "ArrowDown") event.preventDefault();
                    },
                },
                {
                    default: () => [
                        h(G.Grid, {}, { default: () => [h(G.Body)] }),
                    ],
                },
            ),
        );
        await settled();
        expect(container.querySelector("section")).toHaveAttribute(
            "data-grid-part",
            "root",
        );
        const cell = container.querySelector(
            '[data-row-index="0"][data-column-index="0"]',
        ) as HTMLElement;
        keyDown(cell, { key: "ArrowDown" });
        await settled();
        expect(onChange).not.toHaveBeenCalled();
        keyDown(cell, { key: "ArrowRight" });
        await settled();
        expect(onChange).toHaveBeenCalledOnce();
    });

    it("ignores keys from a portal rendered by a cell", async () => {
        const onChange = vi.fn();
        renderGrid(() =>
            grid(
                {
                    defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
                    onActivePositionChange: onChange,
                },
                () => [
                    h(
                        G.Body,
                        {},
                        {
                            default: () => [
                                h(
                                    G.Rows,
                                    {},
                                    {
                                        default: ({
                                            row,
                                        }: {
                                            row: RowInfo<Person>;
                                        }) => [
                                            h(
                                                G.Row,
                                                { row },
                                                {
                                                    default: () => [
                                                        h(
                                                            G.Cells,
                                                            {},
                                                            {
                                                                default: ({
                                                                    cell,
                                                                }: {
                                                                    cell: CellInfo<Person>;
                                                                }) => [
                                                                    h(
                                                                        G.Cell,
                                                                        {
                                                                            cell,
                                                                        },
                                                                        {
                                                                            default:
                                                                                () =>
                                                                                    cell.rowIndex ===
                                                                                        0 &&
                                                                                    cell.columnIndex ===
                                                                                        0
                                                                                        ? [
                                                                                              h(
                                                                                                  Teleport,
                                                                                                  {
                                                                                                      to: "body",
                                                                                                  },
                                                                                                  [
                                                                                                      h(
                                                                                                          "button",
                                                                                                          {
                                                                                                              type: "button",
                                                                                                          },
                                                                                                          "menu",
                                                                                                      ),
                                                                                                  ],
                                                                                              ),
                                                                                          ]
                                                                                        : [],
                                                                        },
                                                                    ),
                                                                ],
                                                            },
                                                        ),
                                                    ],
                                                },
                                            ),
                                        ],
                                    },
                                ),
                            ],
                        },
                    ),
                ],
            ),
        );
        await settled();
        const menu = [...document.body.querySelectorAll("button")].find(
            (button) => button.textContent === "menu",
        );
        expect(menu).toBeDefined();
        keyDown(menu as HTMLElement, { key: "ArrowDown" });
        await settled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("keeps the engine's transform on a layer whose style has one", async () => {
        const { container } = renderGrid(() =>
            grid({}, () => [
                h(G.Body, {
                    style: { transform: "translateZ(0)", color: "red" },
                }),
            ]),
        );
        await settled();
        const body = parts(container, "body")[0];
        expect(body?.style.color).toBe("red");
        expect(body?.style.transform).toMatch(/^translate3d/);
    });
});

describe("the engine's life", () => {
    // Vue has no StrictMode (no double mount): the engine attaches once all the same
    it("attaches once under StrictMode: one window event per scroll", async () => {
        const onRowWindowChange = vi.fn();
        const { container } = renderGrid(() => divGrid({ onRowWindowChange }));
        await settled();
        const root = parts(container, "root")[0] as HTMLElement;
        onRowWindowChange.mockClear();
        scrollRoot(root, { top: 100 });
        await settled();
        expect(onRowWindowChange).toHaveBeenCalledTimes(1);
        expect(onRowWindowChange.mock.calls[0]?.[0].visible).toEqual({
            start: 5,
            end: 15,
        });
    });

    // React counts commits; Vue counts the components' renders
    it("does not render React for a scroll that keeps the rendered window (D9)", async () => {
        const { container, renders, resetRenders } = renderGrid(() =>
            divGrid(),
        );
        await settled();
        const root = parts(container, "root")[0] as HTMLElement;
        resetRenders();
        // every column is rendered (450px in a 400px view): sideways, the windows stay
        scrollRoot(root, { left: 30 });
        await settled();
        expect(renders()).toBe(0);
        // down past the overscan: a new rendered window, the parts render again
        scrollRoot(root, { top: 200 });
        await settled();
        expect(renders()).toBeGreaterThan(0);
    });

    it("reports the first windows", async () => {
        const onRowWindowChange = vi.fn();
        const onColumnWindowChange = vi.fn();
        renderGrid(() => divGrid({ onRowWindowChange, onColumnWindowChange }));
        await settled();
        expect(onRowWindowChange).toHaveBeenCalledWith({
            visible: { start: 0, end: 10 },
            rendered: { start: 0, end: 14 },
        });
        expect(onColumnWindowChange).toHaveBeenCalledWith({
            // 400px wide: Name (200) and Age (100) fully, Label (from 300) partly
            visible: { start: 0, end: 3 },
            rendered: { start: 0, end: 3 },
        });
    });

    it("renders new rows when the props change", async () => {
        const rows = shallowRef(people.slice(0, 3));
        const { container } = renderGrid(() => divGrid({ rows: rows.value }));
        await settled();
        expect(parts(container, "row")).toHaveLength(3);
        rows.value = people.slice(0, 5);
        await settled();
        expect(parts(container, "row")).toHaveLength(5);
        expect(container.textContent).toContain("Person 4");
    });
});

describe("layering (Epic #89, E5.2)", () => {
    it("stacks the header above the summary rows above the body, inside the grid's own context", async () => {
        const { container } = renderGrid(() =>
            h(
                G.Root,
                {
                    features: FEATURES,
                    columns,
                    rows: people,
                    summaryRows: { top: 1, bottom: 1 },
                    style: { zIndex: 5 },
                },
                {
                    default: () => [
                        h(
                            G.Grid,
                            { style: { zIndex: 9 } },
                            {
                                default: () => [
                                    h(G.Header, { style: { zIndex: 50 } }),
                                    h(G.Summary, { position: "top" }),
                                    h(G.Body),
                                    h(G.Summary, { position: "bottom" }),
                                ],
                            },
                        ),
                    ],
                },
            ),
        );
        await settled();
        // structural: the consumer's own z-index never wins; the grid is the app's to stack
        expect(parts(container, "grid")[0]?.style.zIndex).toBe("9");
        expect(parts(container, "header")[0]?.style.zIndex).toBe("2");
        for (const summary of parts(container, "summary")) {
            expect(summary.style.zIndex).toBe("1");
        }
        expect(parts(container, "body")[0]?.style.zIndex).toBe("");
        // the root is the app's to stack in its page
        expect(parts(container, "root")[0]?.style.zIndex).toBe("5");
    });
});
