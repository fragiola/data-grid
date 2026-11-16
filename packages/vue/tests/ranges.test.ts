import { describe, expect, it, vi } from "vitest";
import { defineComponent, shallowRef, type VNodeChild } from "vue";
import {
    type CellInfo,
    type CellRange,
    type CellState,
    type Column,
    type DataGridRef,
    type RangePaste,
    type RenderSlotProps,
    type RootProps,
    type RowInfo,
    typedDataGrid,
    useDataGridRef,
} from "../src";
import {
    cellAt,
    h,
    keyDown,
    renderGrid,
    root,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// Cell ranges and the clipboard (Epic #88, E4.1–E4.2): `Root` maps `cellSelection` and the range
// (controlled or not) onto the model; cells carry `data-selected-cell`, `data-range-edge` and
// `aria-selected`, the grid `aria-multiselectable`, as divs or as a table; a copy on a cell puts
// the range on the clipboard as TSV, after the consumer's `onCopy`; a paste asks
// `onBeforeRangePaste`, then tells `onRangePaste`. A grid without it renders as before.

interface Item {
    id: number;
}

const items: Item[] = Array.from({ length: 20 }, (_, id) => ({ id }));

const columns: Column<Item, VNodeChild>[] = ["a", "b", "c", "d"].map((key) => ({
    key,
    name: key.toUpperCase(),
    width: 80,
    getValue: (row: Item) => `${key}${row.id}`,
}));

const G = typedDataGrid<Item>();

stubViewportSize(400, 300);

type GridProps = Partial<
    Pick<
        RootProps<Item>,
        | "cellSelection"
        | "selectedRange"
        | "defaultSelectedRange"
        | "onSelectedRangeChange"
        | "onRangePaste"
        | "onBeforeRangePaste"
        | "defaultActivePosition"
    >
> & {
    // the root's clipboard listeners: fallthrough attributes in Vue
    onCopy?: (event: ClipboardEvent) => void;
    onPaste?: (event: ClipboardEvent) => void;
    table?: boolean;
    gridRef?: DataGridRef<Item>;
    cellStates?: CellState[];
};

function grid({ table = false, cellStates, ...props }: GridProps = {}) {
    const tag = tags(table);
    return h(
        G.Root,
        {
            columns,
            rows: items,
            rowHeight: 20,
            cellSelection: "range",
            ...props,
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
                                        h(G.Rows, null, {
                                            default: ({
                                                row,
                                            }: {
                                                row: RowInfo<Item>;
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
                                                                    cell: CellInfo<Item>;
                                                                }) => [
                                                                    h(
                                                                        G.Cell,
                                                                        {
                                                                            cell,
                                                                            as: tag.cell,
                                                                        },
                                                                        {
                                                                            // the cell's state, as React's className function reads it
                                                                            render: ({
                                                                                props:
                                                                                    own,
                                                                                state,
                                                                                children,
                                                                            }: RenderSlotProps<CellState>) => {
                                                                                if (
                                                                                    cell.rowIndex ===
                                                                                        1 &&
                                                                                    cell.columnIndex ===
                                                                                        1
                                                                                ) {
                                                                                    cellStates?.push(
                                                                                        state,
                                                                                    );
                                                                                }
                                                                                return [
                                                                                    h(
                                                                                        tag.cell ??
                                                                                            "div",
                                                                                        own,
                                                                                        [
                                                                                            children,
                                                                                        ],
                                                                                    ),
                                                                                ];
                                                                            },
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

const range = (
    anchor: [number, number],
    focus: [number, number],
): CellRange => ({
    anchor: { rowIndex: anchor[0], columnIndex: anchor[1] },
    focus: { rowIndex: focus[0], columnIndex: focus[1] },
});

/** A copy or a paste on `target`, its clipboard a store of its own: what the grid wrote. */
async function clipboard(type: "copy" | "paste", target: Element, text = "") {
    const data = new Map([["text/plain", text]]);
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
        value: {
            setData: (format: string, value: string) => data.set(format, value),
            getData: (format: string) => data.get(format) ?? "",
        },
    });
    target.dispatchEvent(event);
    await settled();
    return { event, data };
}

for (const table of [false, true]) {
    describe(`cell ranges, as ${table ? "a table" : "divs"}`, () => {
        it("mark the range's cells and its edges, the grid aria-multiselectable", async () => {
            const cellStates: CellState[] = [];
            const { container } = renderGrid(() =>
                grid({
                    table,
                    defaultSelectedRange: range([1, 1], [2, 2]),
                    cellStates,
                }),
            );
            await settled();
            expect(
                container.querySelector('[data-grid-part="grid"]'),
            ).toHaveAttribute("aria-multiselectable", "true");
            const first = cellAt(container, 1, 1);
            expect(first).toHaveAttribute("data-selected-cell", "");
            expect(first).toHaveAttribute("data-range-edge", "top start");
            expect(first).toHaveAttribute("aria-selected", "true");
            expect(cellAt(container, 2, 2)).toHaveAttribute(
                "data-range-edge",
                "bottom end",
            );
            const outside = cellAt(container, 3, 1);
            expect(outside).not.toHaveAttribute("data-selected-cell");
            expect(outside).not.toHaveAttribute("data-range-edge");
            expect(outside).toHaveAttribute("aria-selected", "false");
            // the header cells are never selected
            expect(
                container.querySelector('[data-grid-part="header-cell"]'),
            ).not.toHaveAttribute("aria-selected");
            expect(cellStates.at(-1)).toMatchObject({
                selected: true,
                rangeEdges: "top start",
            });
        });

        it("render a grid without cell selection as before", async () => {
            const cellStates: CellState[] = [];
            const { container } = renderGrid(() =>
                grid({
                    table,
                    cellSelection: undefined,
                    defaultSelectedRange: range([1, 1], [2, 2]),
                    cellStates,
                }),
            );
            await settled();
            expect(
                container.querySelector('[data-grid-part="grid"]'),
            ).not.toHaveAttribute("aria-multiselectable");
            const cell = cellAt(container, 1, 1);
            expect(cell).not.toHaveAttribute("aria-selected");
            expect(cell).not.toHaveAttribute("data-selected-cell");
            expect(cell).not.toHaveAttribute("data-range-edge");
            expect(cellStates.at(-1)?.selected).toBeUndefined();
            const copy = await clipboard("copy", cell);
            expect(copy.event.defaultPrevented).toBe(false);
        });
    });
}

describe("the selected range", () => {
    it("follows the keys uncontrolled, and tells each change", async () => {
        const changes: (CellRange | null)[] = [];
        const { container } = renderGrid(() =>
            grid({
                defaultActivePosition: { rowIndex: 1, columnIndex: 1 },
                onSelectedRangeChange: (next) => changes.push(next),
            }),
        );
        await settled();
        const cell = cellAt(container, 1, 1);
        keyDown(cell, { key: "ArrowDown", shiftKey: true });
        await settled();
        keyDown(cell, { key: "ArrowRight", shiftKey: true });
        await settled();
        expect(changes).toEqual([range([1, 1], [2, 1]), range([1, 1], [2, 2])]);
        expect(cellAt(container, 2, 2)).toHaveAttribute(
            "data-range-edge",
            "bottom end",
        );
        keyDown(cell, { key: "Escape" });
        await settled();
        expect(changes.at(-1)).toBeNull();
        expect(cellAt(container, 2, 2)).not.toHaveAttribute(
            "data-selected-cell",
        );
    });

    it("asks a controlled parent, and follows its prop", async () => {
        const selected = shallowRef<CellRange | null>(range([0, 0], [0, 0]));
        const { container } = renderGrid(() =>
            grid({
                defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
                selectedRange: selected.value,
                onSelectedRangeChange: (next) => {
                    selected.value = next;
                },
            }),
        );
        await settled();
        keyDown(cellAt(container, 0, 0), { key: "ArrowDown", shiftKey: true });
        await settled();
        expect(cellAt(container, 1, 0)).toHaveAttribute(
            "data-range-edge",
            "bottom start end",
        );
        // a parent that ignores it: the prop stands
        const ignored = vi.fn();
        const { container: other } = renderGrid(() =>
            grid({
                defaultActivePosition: { rowIndex: 0, columnIndex: 0 },
                selectedRange: range([0, 0], [0, 0]),
                onSelectedRangeChange: ignored,
            }),
        );
        await settled();
        keyDown(cellAt(other, 0, 0), { key: "ArrowDown", shiftKey: true });
        await settled();
        expect(ignored).toHaveBeenCalledWith(range([0, 0], [1, 0]));
        expect(cellAt(other, 1, 0)).not.toHaveAttribute("data-selected-cell");
    });

    it("goes when the active cell moves off its anchor, a controlled parent told", async () => {
        const onChange = vi.fn();
        const selected = shallowRef<CellRange | null>(range([1, 1], [2, 2]));
        const { container } = renderGrid(() =>
            grid({
                defaultActivePosition: { rowIndex: 1, columnIndex: 1 },
                selectedRange: selected.value,
                onSelectedRangeChange: (next) => {
                    onChange(next);
                    selected.value = next;
                },
            }),
        );
        await settled();
        expect(cellAt(container, 2, 2)).toHaveAttribute("data-selected-cell");
        // a cell taking focus (a click, a Tab, a control in it): another active cell
        cellAt(container, 4, 0).focus();
        await settled();
        expect(onChange).toHaveBeenLastCalledWith(null);
        expect(cellAt(container, 2, 2)).not.toHaveAttribute(
            "data-selected-cell",
        );
    });

    it("tells an uncontrolled range to start with that the body could not hold", async () => {
        const onChange = vi.fn();
        renderGrid(() =>
            grid({
                defaultSelectedRange: range([18, 2], [40, 9]),
                onSelectedRangeChange: onChange,
            }),
        );
        await settled();
        expect(onChange).toHaveBeenCalledWith(range([18, 2], [19, 3]));
    });

    it("goes when cellSelection is removed, and is read through a gridRef", async () => {
        const held: { ref?: DataGridRef<Item> } = {};
        const on = shallowRef(true);
        const App = defineComponent({
            setup() {
                const gridRef = useDataGridRef<Item>();
                held.ref = gridRef;
                return () =>
                    grid({
                        gridRef,
                        cellSelection: on.value ? "range" : undefined,
                        defaultSelectedRange: range([0, 0], [1, 1]),
                    });
            },
        });
        const { container } = renderGrid(App);
        await settled();
        expect(held.ref?.current?.model.get("selected-range")).toEqual(
            range([0, 0], [1, 1]),
        );
        on.value = false;
        await settled();
        expect(held.ref?.current?.model.get("selected-range")).toBeNull();
        expect(cellAt(container, 0, 0)).not.toHaveAttribute("aria-selected");
    });
});

describe("the clipboard", () => {
    it("copies the range as TSV from a cell, after the consumer's onCopy", async () => {
        const onCopy = vi.fn();
        const { container } = renderGrid(() =>
            grid({
                defaultActivePosition: { rowIndex: 1, columnIndex: 1 },
                defaultSelectedRange: range([2, 2], [1, 1]),
                onCopy,
            }),
        );
        await settled();
        const { event, data } = await clipboard(
            "copy",
            cellAt(container, 1, 1),
        );
        expect(onCopy).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
        expect(data.get("text/plain")).toBe("b1\tc1\nb2\tc2");
    });

    it("leaves a copy the consumer prevented alone", async () => {
        const { container } = renderGrid(() =>
            grid({
                defaultActivePosition: { rowIndex: 1, columnIndex: 1 },
                onCopy: (event) => {
                    event.preventDefault();
                },
            }),
        );
        await settled();
        const { data } = await clipboard("copy", cellAt(container, 1, 1));
        expect(data.get("text/plain")).toBe("");
    });

    it("asks onBeforeRangePaste, then tells onRangePaste once with the parsed values", async () => {
        const pastes: RangePaste[] = [];
        const refuse = { current: false };
        const { container } = renderGrid(() =>
            grid({
                defaultActivePosition: { rowIndex: 3, columnIndex: 2 },
                onBeforeRangePaste: () => !refuse.current,
                onRangePaste: (paste) => pastes.push(paste),
            }),
        );
        await settled();
        const cell = cellAt(container, 3, 2);
        const { event } = await clipboard(
            "paste",
            cell,
            "x\ty\tz\r\n1\t2\t3\r\n",
        );
        expect(event.defaultPrevented).toBe(true);
        expect(pastes).toEqual([
            {
                range: range([3, 2], [4, 3]),
                values: [
                    ["x", "y"],
                    ["1", "2"],
                ],
            },
        ]);
        refuse.current = true;
        await clipboard("paste", cell, "q");
        expect(pastes).toHaveLength(1);
        // the root itself, a field: not the grid's
        await clipboard("paste", root(container), "q");
        expect(pastes).toHaveLength(1);
    });
});
