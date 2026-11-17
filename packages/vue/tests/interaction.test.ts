import { describe, expect, it } from "vitest";
import { mergeProps, type VNodeChild } from "vue";
import {
    type CellInfo,
    type CellState,
    type Column,
    type HeaderCellInfo,
    type HeaderCellState,
    type RenderSlotProps,
    type RowInfo,
    typedDataGrid,
} from "../src";
import {
    cellAt,
    FEATURES,
    type Features,
    h,
    keyDown,
    renderGrid,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// Interactive cells (Epic #52, I5): the cell whose controls have the keys carries
// `data-interacting`, its composables report `interacting`, and the cells' controls stay out of
// the tab order outside it, as divs or as a table.

interface Task {
    id: number;
    title: string;
}

const G = typedDataGrid<Task, Features>();

const tasks: Task[] = Array.from({ length: 20 }, (_, id) => ({
    id,
    title: `Task ${id}`,
}));

const columns: Column<Task, VNodeChild>[] = [
    { key: "title", name: "Title", width: 160 },
    {
        key: "actions",
        name: "Actions",
        width: 160,
        renderCell: ({ row }) => [
            h("button", { type: "button" }, `Edit ${row.id}`),
            h("a", { href: `#task-${row.id}` }, `Open ${row.id}`),
        ],
    },
];

stubViewportSize(400, 300);

let headerStates: HeaderCellState[] = [];

// React's `className` functions read the state: here the `render` slot's state does

/** A header cell rendered as `tag`, its state recorded. */
const headerCellAs =
    (tag: string) =>
    ({ props, state, children }: RenderSlotProps<HeaderCellState>) => {
        headerStates.push(state);
        return [h(tag, props, [h(children)])];
    };

/** A cell rendered as `tag`, classed `interacting` while its controls have the keys. */
const cellAs =
    (tag: string) =>
    ({ props, state, children }: RenderSlotProps<CellState>) => [
        h(
            tag,
            mergeProps(props, {
                class: state.interacting ? "interacting" : undefined,
            }),
            [h(children)],
        ),
    ];

function grid({
    table = false,
    cells = columns,
}: {
    table?: boolean;
    cells?: Column<Task, VNodeChild>[];
} = {}) {
    const tag = tags(table);
    const header = () =>
        h(
            G.Header,
            { as: tag.header },
            {
                default: () => [
                    h(
                        G.HeaderRow,
                        { as: tag.headerRow },
                        {
                            default: () => [
                                h(
                                    G.HeaderCells,
                                    {},
                                    {
                                        default: ({
                                            cell,
                                        }: {
                                            cell: HeaderCellInfo<Task>;
                                        }) => [
                                            h(
                                                G.HeaderCell,
                                                { cell },
                                                {
                                                    render: headerCellAs(
                                                        tag.headerCell ?? "div",
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
            },
        );
    const body = () =>
        h(
            G.Body,
            { as: tag.body },
            {
                default: () => [
                    h(
                        G.Rows,
                        {},
                        {
                            default: ({ row }: { row: RowInfo<Task> }) => [
                                h(
                                    G.Row,
                                    { row, as: tag.row },
                                    {
                                        default: () => [
                                            h(
                                                G.Cells,
                                                {},
                                                {
                                                    default: ({
                                                        cell,
                                                    }: {
                                                        cell: CellInfo<Task>;
                                                    }) => [
                                                        h(
                                                            G.Cell,
                                                            { cell },
                                                            {
                                                                render: cellAs(
                                                                    tag.cell ??
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
                        },
                    ),
                ],
            },
        );
    return h(
        G.Root,
        { features: FEATURES, columns: cells, rows: tasks, rowHeight: 24 },
        {
            default: () => [
                h(
                    G.Grid,
                    { as: tag.grid },
                    { default: () => [header(), body()] },
                ),
            ],
        },
    );
}

for (const table of [false, true]) {
    describe(`interactive cells, as ${table ? "a table" : "divs"}`, () => {
        it("keeps the cells' controls out of the tab order", async () => {
            const { container } = renderGrid(() => grid({ table }));
            await settled();
            const controls = container.querySelectorAll(
                '[data-grid-part="cell"] button, [data-grid-part="cell"] a',
            );
            expect(controls.length).toBeGreaterThan(0);
            for (const control of controls) {
                expect(control.getAttribute("tabindex")).toBe("-1");
            }
        });

        it("marks the cell whose controls have the keys, and its state", async () => {
            const { container } = renderGrid(() => grid({ table }));
            await settled();
            const actions = cellAt(container, 2, 1);
            actions.focus();
            await settled();
            keyDown(actions, { key: "Enter" });
            await settled();
            const cell = cellAt(container, 2, 1);
            expect(cell).toHaveAttribute("data-interacting", "");
            expect(cell).toHaveClass("interacting");
            const edit = cell.querySelector("button");
            expect(document.activeElement).toBe(edit);
            expect(edit?.hasAttribute("tabindex")).toBe(false);
            keyDown(edit as HTMLElement, { key: "Escape" });
            await settled();
            expect(cellAt(container, 2, 1)).not.toHaveAttribute(
                "data-interacting",
            );
            expect(document.activeElement).toBe(cellAt(container, 2, 1));
            await settled();
            expect(
                cellAt(container, 2, 1)
                    .querySelector("button")
                    ?.getAttribute("tabindex"),
            ).toBe("-1");
        });
    });
}

describe("interactive header cells", () => {
    it("report interacting on a header cell entered with F2", async () => {
        headerStates = [];
        const withMenu: Column<Task, VNodeChild>[] = [
            {
                key: "title",
                name: "Title",
                width: 160,
                sortable: true,
                renderHeaderCell: () => [
                    "Title ",
                    h("button", { type: "button" }, "Menu"),
                ],
            },
        ];
        const { container } = renderGrid(() => grid({ cells: withMenu }));
        await settled();
        const header = container.querySelector(
            '[data-grid-part="header-cell"]',
        ) as HTMLElement;
        header.focus();
        await settled();
        keyDown(header, { key: "F2" });
        await settled();
        expect(header).toHaveAttribute("data-interacting", "");
        expect(headerStates.at(-1)?.interacting).toBe(true);
    });
});

describe("a grid without controls in its cells", () => {
    it("carries no interaction attribute, and lets Enter through", async () => {
        const plain: Column<Task, VNodeChild>[] = [
            { key: "title", name: "Title", width: 160 },
        ];
        const { container } = renderGrid(() => grid({ cells: plain }));
        await settled();
        const cell = cellAt(container, 0, 0);
        cell.focus();
        await settled();
        keyDown(cell, { key: "Enter" });
        await settled();
        expect(container.querySelectorAll("[data-interacting]")).toHaveLength(
            0,
        );
    });
});
