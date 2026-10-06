import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type CellInfo, type Column, DataGrid, useGroupToggle } from "../src";
import { type LocalRowsResult, useLocalRows } from "../src/local";
import { cellAt, root, rowAt, stubViewportSize } from "./helpers";

// Tree data in React (Epic #87, E3.3): `useLocalRows` with `getSubRows` hands the root a tree whose
// parents are data rows that expand by their key: the app's toggle, Space and the arrows open
// them, ARIA tells their level, and a parent selects itself (its rows by the app's own checkbox).

interface File {
    name: string;
    children?: File[];
}

const files: File[] = [
    {
        name: "src",
        children: [
            { name: "app.ts" },
            { name: "lib", children: [{ name: "a.ts" }] },
        ],
    },
    { name: "package.json" },
];

const columns: Column<File>[] = [
    { key: "name", name: "Name", width: 200 },
    {
        key: "kind",
        name: "Kind",
        width: 100,
        getValue: (file) => (file.children ? "folder" : "file"),
    },
];

const getSubRows = (file: File) => file.children;
const rowKey = (file: File) => file.name;

stubViewportSize(600, 400);

let latest: LocalRowsResult<File> | undefined;

function Toggle({ cell }: { cell: CellInfo<File> }) {
    const { state, props } = useGroupToggle(cell);
    return state.expandable ? (
        <button type="button" aria-label="Toggle" {...props} />
    ) : null;
}

function Files() {
    const local = useLocalRows(files, columns, { getSubRows, rowKey });
    latest = local;
    return (
        <DataGrid.Root
            {...local.props}
            columns={columns}
            rowHeight={20}
            rowSelection="multiple"
        >
            <DataGrid.Grid>
                <DataGrid.Body>
                    <DataGrid.Rows<File>>
                        {(row) => (
                            <DataGrid.Row row={row}>
                                <DataGrid.Cells<File>>
                                    {(cell) => (
                                        <DataGrid.Cell cell={cell}>
                                            {cell.columnIndex === 0 ? (
                                                <>
                                                    <Toggle cell={cell} />
                                                    {cell.row?.name}
                                                </>
                                            ) : undefined}
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

const rowCount = (container: HTMLElement) =>
    container.querySelectorAll('[data-grid-part="row"]').length;

describe("tree data", () => {
    it("makes a treegrid of the top rows, a parent a data row that expands", () => {
        const { container } = render(<Files />);
        expect(
            root(container)
                .querySelector('[data-grid-part="grid"]')
                ?.getAttribute("role"),
        ).toBe("treegrid");
        expect(rowCount(container)).toBe(2);
        const src = rowAt(container, 0);
        expect(src.getAttribute("aria-level")).toBe("1");
        expect(src.getAttribute("aria-expanded")).toBe("false");
        expect(src.getAttribute("aria-setsize")).toBe("2");
        expect(src.hasAttribute("data-group-row")).toBe(false);
        expect(rowAt(container, 1).hasAttribute("aria-expanded")).toBe(false);
        expect(cellAt(container, 0, 1).textContent).toBe("folder");
    });

    it("expands a parent by its toggle, and by Space; Enter stays its cell's", () => {
        const { container } = render(<Files />);
        const toggle = cellAt(container, 0, 0).querySelector("button");
        act(() => {
            if (toggle) fireEvent.click(toggle);
        });
        expect(latest?.group.expandedKeys).toEqual(["src"]);
        expect(rowCount(container)).toBe(4);
        expect(rowAt(container, 2).getAttribute("aria-level")).toBe("2");
        expect(rowAt(container, 2).getAttribute("aria-posinset")).toBe("2");
        act(() => {
            cellAt(container, 2, 1).focus();
        });
        act(() => {
            fireEvent.keyDown(cellAt(container, 2, 1), { key: "Enter" });
        });
        expect(rowCount(container)).toBe(4);
        act(() => {
            fireEvent.keyDown(cellAt(container, 2, 1), { key: " " });
        });
        expect(latest?.group.expandedKeys).toEqual(["src", "lib"]);
        expect(rowCount(container)).toBe(5);
        expect(rowAt(container, 3).getAttribute("aria-level")).toBe("3");
    });

    it("selects a parent alone; its rows' keys are the app's to add", () => {
        const { container } = render(<Files />);
        act(() => {
            cellAt(container, 0, 1).focus();
        });
        act(() => {
            fireEvent.keyDown(cellAt(container, 0, 1), {
                key: " ",
                shiftKey: true,
            });
        });
        expect(rowAt(container, 0).getAttribute("aria-selected")).toBe("true");
        expect(latest?.group.subRowKeysOf(0)).toEqual([
            "app.ts",
            "lib",
            "a.ts",
        ]);
        expect(latest?.group.subRowKeysOf(1)).toEqual([]);
    });

    it("keeps subRowKeysOf while the rows shown stay, and moves no row of a tree", () => {
        const { rerender } = render(<Files />);
        const first = latest?.group.subRowKeysOf;
        rerender(<Files />);
        expect(latest?.group.subRowKeysOf).toBe(first);
        expect(latest?.moveRow({ fromIndex: 0, toIndex: 1 })).toBe(files);
    });
});
