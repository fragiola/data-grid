import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
    type CellRange,
    type CellState,
    type Column,
    DataGrid,
    type DataGridRef,
    type RangePaste,
    useDataGridRef,
} from "../src";
import { cellAt, root, stubViewportSize, tags } from "./helpers";

// Cell ranges and the clipboard (Epic #88, E4.1–E4.2): `Root` maps `cellSelection` and the range
// (controlled or not) onto the model; cells carry `data-selected-cell`, `data-range-edge` and
// `aria-selected`, the grid `aria-multiselectable`, as divs or as a table; a copy on a cell puts
// the range on the clipboard as TSV, after the consumer's `onCopy`; a paste asks
// `onBeforeRangePaste`, then tells `onRangePaste`. A grid without it renders as before.

interface Item {
    id: number;
}

const items: Item[] = Array.from({ length: 20 }, (_, id) => ({ id }));

const columns: Column<Item>[] = ["a", "b", "c", "d"].map((key) => ({
    key,
    name: key.toUpperCase(),
    width: 80,
    getValue: (row: Item) => `${key}${row.id}`,
}));

stubViewportSize(400, 300);

type GridProps = Partial<
    Pick<
        React.ComponentProps<typeof DataGrid.Root<Item>>,
        | "cellSelection"
        | "selectedRange"
        | "defaultSelectedRange"
        | "onSelectedRangeChange"
        | "onRangePaste"
        | "onBeforeRangePaste"
        | "onCopy"
        | "onPaste"
        | "defaultActivePosition"
    >
> & {
    table?: boolean;
    gridRef?: DataGridRef<Item>;
    cellStates?: CellState[];
};

function Grid({ table = false, cellStates, ...props }: GridProps) {
    const tag = tags(table);
    return (
        <DataGrid.Root
            columns={columns}
            rows={items}
            rowHeight={20}
            cellSelection="range"
            {...props}
        >
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Header render={tag.header} />
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<Item>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<Item>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={tag.cell}
                                            className={(state) => {
                                                if (
                                                    cell.rowIndex === 1 &&
                                                    cell.columnIndex === 1
                                                ) {
                                                    cellStates?.push(state);
                                                }
                                                return undefined;
                                            }}
                                        />
                                    )}
                                </DataGrid.Cells>
                            </DataGrid.Row>
                        )}
                    </DataGrid.Rows>
                </DataGrid.Body>
            </DataGrid.Grid>
        </DataGrid.Root>
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
function clipboard(type: "copy" | "paste", target: Element, text = "") {
    const data = new Map([["text/plain", text]]);
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
        value: {
            setData: (format: string, value: string) => data.set(format, value),
            getData: (format: string) => data.get(format) ?? "",
        },
    });
    act(() => {
        target.dispatchEvent(event);
    });
    return { event, data };
}

for (const table of [false, true]) {
    describe(`cell ranges, as ${table ? "a table" : "divs"}`, () => {
        it("mark the range's cells and its edges, the grid aria-multiselectable", () => {
            const cellStates: CellState[] = [];
            const { container } = render(
                <Grid
                    table={table}
                    defaultSelectedRange={range([1, 1], [2, 2])}
                    cellStates={cellStates}
                />,
            );
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

        it("render a grid without cell selection as before", () => {
            const cellStates: CellState[] = [];
            const { container } = render(
                <Grid
                    table={table}
                    cellSelection={undefined}
                    defaultSelectedRange={range([1, 1], [2, 2])}
                    cellStates={cellStates}
                />,
            );
            expect(
                container.querySelector('[data-grid-part="grid"]'),
            ).not.toHaveAttribute("aria-multiselectable");
            const cell = cellAt(container, 1, 1);
            expect(cell).not.toHaveAttribute("aria-selected");
            expect(cell).not.toHaveAttribute("data-selected-cell");
            expect(cell).not.toHaveAttribute("data-range-edge");
            expect(cellStates.at(-1)?.selected).toBeUndefined();
            const copy = clipboard("copy", cell);
            expect(copy.event.defaultPrevented).toBe(false);
        });
    });
}

describe("the selected range", () => {
    it("follows the keys uncontrolled, and tells each change", () => {
        const changes: (CellRange | null)[] = [];
        const { container } = render(
            <Grid
                defaultActivePosition={{ rowIndex: 1, columnIndex: 1 }}
                onSelectedRangeChange={(next) => changes.push(next)}
            />,
        );
        const cell = cellAt(container, 1, 1);
        fireEvent.keyDown(cell, { key: "ArrowDown", shiftKey: true });
        fireEvent.keyDown(cell, { key: "ArrowRight", shiftKey: true });
        expect(changes).toEqual([range([1, 1], [2, 1]), range([1, 1], [2, 2])]);
        expect(cellAt(container, 2, 2)).toHaveAttribute(
            "data-range-edge",
            "bottom end",
        );
        fireEvent.keyDown(cell, { key: "Escape" });
        expect(changes.at(-1)).toBeNull();
        expect(cellAt(container, 2, 2)).not.toHaveAttribute(
            "data-selected-cell",
        );
    });

    it("asks a controlled parent, and follows its prop", () => {
        function Controlled() {
            const [selected, setSelected] = useState<CellRange | null>(
                range([0, 0], [0, 0]),
            );
            return (
                <Grid
                    defaultActivePosition={{ rowIndex: 0, columnIndex: 0 }}
                    selectedRange={selected}
                    onSelectedRangeChange={setSelected}
                />
            );
        }
        const { container } = render(<Controlled />);
        fireEvent.keyDown(cellAt(container, 0, 0), {
            key: "ArrowDown",
            shiftKey: true,
        });
        expect(cellAt(container, 1, 0)).toHaveAttribute(
            "data-range-edge",
            "bottom start end",
        );
        // a parent that ignores it: the prop stands
        const ignored = vi.fn();
        const { container: other } = render(
            <Grid
                defaultActivePosition={{ rowIndex: 0, columnIndex: 0 }}
                selectedRange={range([0, 0], [0, 0])}
                onSelectedRangeChange={ignored}
            />,
        );
        fireEvent.keyDown(cellAt(other, 0, 0), {
            key: "ArrowDown",
            shiftKey: true,
        });
        expect(ignored).toHaveBeenCalledWith(range([0, 0], [1, 0]));
        expect(cellAt(other, 1, 0)).not.toHaveAttribute("data-selected-cell");
    });

    it("goes when the active cell moves off its anchor, a controlled parent told", () => {
        function Controlled({
            onChange,
        }: {
            onChange: (range: CellRange | null) => void;
        }) {
            const [selected, setSelected] = useState<CellRange | null>(
                range([1, 1], [2, 2]),
            );
            return (
                <Grid
                    defaultActivePosition={{ rowIndex: 1, columnIndex: 1 }}
                    selectedRange={selected}
                    onSelectedRangeChange={(next) => {
                        onChange(next);
                        setSelected(next);
                    }}
                />
            );
        }
        const onChange = vi.fn();
        const { container } = render(<Controlled onChange={onChange} />);
        expect(cellAt(container, 2, 2)).toHaveAttribute("data-selected-cell");
        // a cell taking focus (a click, a Tab, a control in it): another active cell
        act(() => {
            cellAt(container, 4, 0).focus();
        });
        expect(onChange).toHaveBeenLastCalledWith(null);
        expect(cellAt(container, 2, 2)).not.toHaveAttribute(
            "data-selected-cell",
        );
    });

    it("tells an uncontrolled range to start with that the body could not hold", () => {
        const onChange = vi.fn();
        render(
            <Grid
                defaultSelectedRange={range([18, 2], [40, 9])}
                onSelectedRangeChange={onChange}
            />,
        );
        expect(onChange).toHaveBeenCalledWith(range([18, 2], [19, 3]));
    });

    it("goes when cellSelection is removed, and is read through a gridRef", () => {
        const held: { ref?: DataGridRef<Item> } = {};
        function App({ on }: { on: boolean }) {
            const gridRef = useDataGridRef<Item>();
            held.ref = gridRef;
            return (
                <Grid
                    gridRef={gridRef}
                    cellSelection={on ? "range" : undefined}
                    defaultSelectedRange={range([0, 0], [1, 1])}
                />
            );
        }
        const { rerender, container } = render(<App on />);
        expect(held.ref?.current?.model.get("selected-range")).toEqual(
            range([0, 0], [1, 1]),
        );
        rerender(<App on={false} />);
        expect(held.ref?.current?.model.get("selected-range")).toBeNull();
        expect(cellAt(container, 0, 0)).not.toHaveAttribute("aria-selected");
    });
});

describe("the clipboard", () => {
    it("copies the range as TSV from a cell, after the consumer's onCopy", () => {
        const onCopy = vi.fn();
        const { container } = render(
            <Grid
                defaultActivePosition={{ rowIndex: 1, columnIndex: 1 }}
                defaultSelectedRange={range([2, 2], [1, 1])}
                onCopy={onCopy}
            />,
        );
        const { event, data } = clipboard("copy", cellAt(container, 1, 1));
        expect(onCopy).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
        expect(data.get("text/plain")).toBe("b1\tc1\nb2\tc2");
    });

    it("leaves a copy the consumer prevented alone", () => {
        const { container } = render(
            <Grid
                defaultActivePosition={{ rowIndex: 1, columnIndex: 1 }}
                onCopy={(event) => {
                    event.preventDefault();
                }}
            />,
        );
        const { data } = clipboard("copy", cellAt(container, 1, 1));
        expect(data.get("text/plain")).toBe("");
    });

    it("asks onBeforeRangePaste, then tells onRangePaste once with the parsed values", () => {
        const pastes: RangePaste[] = [];
        const refuse = { current: false };
        const { container } = render(
            <Grid
                defaultActivePosition={{ rowIndex: 3, columnIndex: 2 }}
                onBeforeRangePaste={() => !refuse.current}
                onRangePaste={(paste) => pastes.push(paste)}
            />,
        );
        const cell = cellAt(container, 3, 2);
        const { event } = clipboard("paste", cell, "x\ty\tz\r\n1\t2\t3\r\n");
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
        clipboard("paste", cell, "q");
        expect(pastes).toHaveLength(1);
        // the root itself, a field: not the grid's
        clipboard("paste", root(container), "q");
        expect(pastes).toHaveLength(1);
    });
});
