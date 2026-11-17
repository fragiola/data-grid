import { describe, expect, it } from "vitest";
import {
    createTextVNode,
    defineComponent,
    h,
    type PropType,
    type VNodeChild,
} from "vue";
import {
    type CellInfo,
    type Column,
    type RangeFill,
    type RowInfo,
    typedDataGrid,
} from "../src";
import { useFillHandle } from "../src/fill";
import {
    cellAt,
    FEATURES,
    type Features,
    renderGrid,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// The fill handle (Epic #88, E4.4): `Root`'s `onFill` turns filling on; `useFillHandle` gives the
// app's element its mark in the cell at the range's corner (else the active cell), none
// elsewhere; a press on it dragged and released past the source tells `onFill` once, as divs or
// as a table, and the range grows to the filled cells.

interface Item {
    id: number;
}

const G = typedDataGrid<Item, Features>();

const items: Item[] = Array.from({ length: 20 }, (_, id) => ({ id }));

const columns: Column<Item, VNodeChild>[] = ["a", "b", "c"].map((key) => ({
    key,
    width: 100,
}));

stubViewportSize(400, 300);

const Handle = defineComponent({
    props: {
        cell: { type: Object as PropType<CellInfo<Item>>, required: true },
    },
    setup(props) {
        const handle = useFillHandle(() => props.cell);
        return () =>
            handle.state.value.visible
                ? h("span", { ...handle.props.value, "data-testid": "handle" })
                : null;
    },
});

function grid({
    table = false,
    onFill,
}: {
    table?: boolean;
    onFill?: (fill: RangeFill) => void;
} = {}) {
    const tag = tags(table);
    const row = ({ row }: { row: RowInfo<Item> }) => [
        h(
            G.Row,
            { row, as: tag.row },
            {
                default: () => [
                    h(G.Cells, null, {
                        default: ({ cell }: { cell: CellInfo<Item> }) => [
                            h(
                                G.Cell,
                                { cell, as: tag.cell },
                                {
                                    default: () => [
                                        createTextVNode(
                                            String(cell.value ?? ""),
                                        ),
                                        h(Handle, { cell }),
                                    ],
                                },
                            ),
                        ],
                    }),
                ],
            },
        ),
    ];
    return h(
        G.Root,
        {
            features: FEATURES,
            columns,
            rows: items,
            rowHeight: 20,
            headerRowHeight: 0,
            cellSelection: "range",
            defaultActivePosition: { rowIndex: 1, columnIndex: 1 },
            defaultSelectedRange: {
                anchor: { rowIndex: 1, columnIndex: 1 },
                focus: { rowIndex: 2, columnIndex: 1 },
            },
            onFill,
        },
        {
            default: () => [
                h(
                    G.Grid,
                    { as: tag.grid },
                    {
                        default: () => [
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

/** A pointer event of the primary button at `x`, `y` (jsdom lays the grid out at 0, 0). */
async function pointer(
    target: EventTarget,
    type: string,
    x: number,
    y: number,
) {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: type === "pointerup" ? 0 : 1,
            pointerId: 1,
            clientX: x,
            clientY: y,
        }),
    );
    await settled();
}

const handlesOf = (container: ParentNode) => [
    ...container.querySelectorAll<HTMLElement>('[data-testid="handle"]'),
];

for (const table of [false, true]) {
    describe(`the fill handle, as ${table ? "a table" : "divs"}`, () => {
        it("marks one element, in the range's last cell, and tells a drop once", async () => {
            const fills: RangeFill[] = [];
            const { container } = renderGrid(() =>
                grid({ table, onFill: (fill) => fills.push(fill) }),
            );
            await settled();
            const handles = handlesOf(container);
            expect(handles).toHaveLength(1);
            const handle = handles[0];
            if (!handle) throw new Error("no handle");
            expect(cellAt(container, 2, 1)).toContainElement(handle);
            expect(handle).toHaveAttribute("data-grid-part", "fill-handle");
            expect(handle).toHaveAttribute("data-grid-fill-handle", "2");
            // rows of 20px: row 5 at y 100–120
            await pointer(handle, "pointerdown", 150, 50);
            expect(handle).toHaveAttribute("data-filling", "");
            await pointer(document, "pointerup", 150, 110);
            expect(fills).toEqual([
                {
                    source: {
                        anchor: { rowIndex: 1, columnIndex: 1 },
                        focus: { rowIndex: 2, columnIndex: 1 },
                    },
                    target: {
                        anchor: { rowIndex: 3, columnIndex: 1 },
                        focus: { rowIndex: 5, columnIndex: 1 },
                    },
                },
            ]);
            // the range grows to the filled cells: the handle at its new corner
            expect(cellAt(container, 5, 1)).toContainElement(
                handlesOf(container)[0] ?? null,
            );
        });
    });
}

describe("without onFill", () => {
    it("renders no handle and marks nothing", async () => {
        const { container } = renderGrid(() => grid());
        await settled();
        expect(handlesOf(container)).toEqual([]);
        expect(
            container.querySelector(
                "[data-fill-target], [data-grid-fill-handle]",
            ),
        ).toBeNull();
    });
});
