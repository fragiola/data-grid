import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    type CellInfo,
    type Column,
    DataGrid,
    type RangeFill,
    useFillHandle,
} from "../src";
import { cellAt, stubViewportSize, tags } from "./helpers";

// The fill handle (Epic #88, E4.4): `Root`'s `onFill` turns filling on; `useFillHandle` gives the
// app's element its mark in the cell at the range's corner (else the active cell), none
// elsewhere; a press on it dragged and released past the source tells `onFill` once, as divs or
// as a table, and the range grows to the filled cells.

interface Item {
    id: number;
}

const items: Item[] = Array.from({ length: 20 }, (_, id) => ({ id }));

const columns: Column<Item>[] = ["a", "b", "c"].map((key) => ({
    key,
    width: 100,
}));

stubViewportSize(400, 300);

function Handle({ cell }: { cell: CellInfo<Item> }) {
    const { state, props } = useFillHandle(cell);
    if (!state.visible) return null;
    return <span {...props} data-testid="handle" />;
}

function Grid({
    table = false,
    onFill,
}: {
    table?: boolean;
    onFill?: (fill: RangeFill) => void;
}) {
    const tag = tags(table);
    return (
        <DataGrid.Root
            columns={columns}
            rows={items}
            rowHeight={20}
            headerRowHeight={0}
            cellSelection="range"
            defaultActivePosition={{ rowIndex: 1, columnIndex: 1 }}
            defaultSelectedRange={{
                anchor: { rowIndex: 1, columnIndex: 1 },
                focus: { rowIndex: 2, columnIndex: 1 },
            }}
            onFill={onFill}
        >
            <DataGrid.Grid render={tag.grid}>
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<Item>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<Item>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            render={tag.cell}
                                        >
                                            {String(cell.value ?? "")}
                                            <Handle cell={cell} />
                                        </DataGrid.Cell>
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

/** A pointer event of the primary button at `x`, `y` (jsdom lays the grid out at 0, 0). */
function pointer(target: EventTarget, type: string, x: number, y: number) {
    act(() => {
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
    });
}

for (const table of [false, true]) {
    describe(`the fill handle, as ${table ? "a table" : "divs"}`, () => {
        it("marks one element, in the range's last cell, and tells a drop once", () => {
            const fills: RangeFill[] = [];
            const { container, getAllByTestId } = render(
                <Grid table={table} onFill={(fill) => fills.push(fill)} />,
            );
            const handles = getAllByTestId("handle");
            expect(handles).toHaveLength(1);
            const handle = handles[0];
            if (!handle) throw new Error("no handle");
            expect(cellAt(container, 2, 1)).toContainElement(handle);
            expect(handle).toHaveAttribute("data-grid-part", "fill-handle");
            expect(handle).toHaveAttribute("data-grid-fill-handle", "2");
            // rows of 20px: row 5 at y 100–120
            pointer(handle, "pointerdown", 150, 50);
            expect(handle).toHaveAttribute("data-filling", "");
            pointer(document, "pointerup", 150, 110);
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
                getAllByTestId("handle")[0] ?? null,
            );
        });
    });
}

describe("without onFill", () => {
    it("renders no handle and marks nothing", () => {
        const { queryAllByTestId, container } = render(<Grid />);
        expect(queryAllByTestId("handle")).toEqual([]);
        expect(
            container.querySelector(
                "[data-fill-target], [data-grid-fill-handle]",
            ),
        ).toBeNull();
    });
});
