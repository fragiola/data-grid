import { act, fireEvent, render } from "@testing-library/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import {
    type CellEditEvent,
    type Column,
    DataGrid,
    type EditCellRenderProps,
    type EditingCell,
} from "../src";
import { cellAt, stubViewportSize, tags } from "./helpers";

// Cell editing (Epic #88, E4.3): `Root` maps the edited cell (controlled or not) onto the model and
// tells commits through `onCellEdit` with their row; an edited cell carries `data-editing` and
// renders its column's `renderEditCell` with the draft, as divs or as a table; the grid writes no
// data.

interface Item {
    id: number;
    name: string;
}

const items: Item[] = Array.from({ length: 10 }, (_, id) => ({
    id,
    name: `item ${id}`,
}));

const columns: Column<Item>[] = [
    { key: "id", width: 80 },
    {
        key: "name",
        width: 160,
        editable: true,
        renderEditCell: ({ value, startKey, onChange }) => (
            <input
                aria-label="Name"
                data-start={startKey}
                value={String(value)}
                onChange={(event) => onChange(event.target.value)}
            />
        ),
    },
    // editable, with no editor of the grid's: its children are the app's
    { key: "note", width: 80, editable: true },
];

stubViewportSize(400, 300);

type GridProps = Partial<
    Pick<
        React.ComponentProps<typeof DataGrid.Root<Item>>,
        | "editingCell"
        | "defaultEditingCell"
        | "onEditingCellChange"
        | "onCellEdit"
        | "defaultActivePosition"
    >
> & { table?: boolean };

function Grid({ table = false, ...props }: GridProps) {
    const tag = tags(table);
    return (
        <DataGrid.Root columns={columns} rows={items} rowHeight={20} {...props}>
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

const at = (rowIndex: number, columnIndex: number) => ({
    rowIndex,
    columnIndex,
});

for (const table of [false, true]) {
    describe(`editing, as ${table ? "a table" : "divs"}`, () => {
        it("renders the column's editor in the edited cell, focused, and tells a commit with its row", () => {
            const edits: CellEditEvent<Item>[] = [];
            const { container } = render(
                <Grid
                    table={table}
                    defaultActivePosition={at(2, 1)}
                    onCellEdit={(edit) => edits.push(edit)}
                />,
            );
            const cell = cellAt(container, 2, 1);
            expect(cell).toHaveTextContent("item 2");
            fireEvent.keyDown(cell, { key: "Enter" });
            expect(cell).toHaveAttribute("data-editing", "");
            const input = cell.querySelector("input");
            if (!input) throw new Error("no editor");
            expect(input).toHaveValue("item 2");
            expect(input).toHaveFocus();
            fireEvent.change(input, { target: { value: "renamed" } });
            expect(input).toHaveValue("renamed");
            fireEvent.keyDown(input, { key: "Enter" });
            expect(edits).toEqual([
                {
                    ...at(2, 1),
                    columnKey: "name",
                    value: "renamed",
                    row: items[2],
                },
            ]);
            // the grid writes nothing: the app's rows are as they were
            expect(cell).not.toHaveAttribute("data-editing");
            expect(cell).toHaveTextContent("item 2");
            expect(cellAt(container, 3, 1)).toHaveFocus();
        });
    });
}

describe("the edited cell", () => {
    it("starts with the typed key, and Escape cancels, telling nothing", () => {
        const onCellEdit = vi.fn();
        const changes: (EditingCell | null)[] = [];
        const { container } = render(
            <Grid
                defaultActivePosition={at(1, 1)}
                onCellEdit={onCellEdit}
                onEditingCellChange={(editing) => changes.push(editing)}
            />,
        );
        const cell = cellAt(container, 1, 1);
        fireEvent.keyDown(cell, { key: "q" });
        const input = cell.querySelector("input");
        expect(input).toHaveAttribute("data-start", "q");
        if (!input) throw new Error("no editor");
        fireEvent.change(input, { target: { value: "q" } });
        fireEvent.keyDown(input, { key: "Escape" });
        expect(onCellEdit).not.toHaveBeenCalled();
        expect(cell.querySelector("input")).toBeNull();
        expect(cell).toHaveFocus();
        expect(changes).toEqual([{ ...at(1, 1), startKey: "q" }, null]);
    });

    it("cancels an edit with no editor to focus: an editable column without one traps no key", async () => {
        const changes: (EditingCell | null)[] = [];
        const { container } = render(
            <Grid
                defaultActivePosition={at(1, 2)}
                onEditingCellChange={(editing) => changes.push(editing)}
            />,
        );
        const cell = cellAt(container, 1, 2);
        fireEvent.keyDown(cell, { key: "F2" });
        // the next task: an editor focusing itself later would have kept it
        await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
        expect(cell).not.toHaveAttribute("data-editing");
        expect(changes).toEqual([at(1, 2), null]);
        fireEvent.keyDown(cell, { key: "ArrowDown" });
        expect(cellAt(container, 2, 2)).toHaveFocus();
    });

    it("keeps an edit whose portalled editor, marked with its editorProps, takes focus in an effect", async () => {
        function PortalEditor({
            value,
            editorProps,
        }: EditCellRenderProps<Item, ReactNode>) {
            const field = useRef<HTMLInputElement>(null);
            useEffect(() => field.current?.focus(), []);
            return createPortal(
                <div {...editorProps}>
                    <input
                        ref={field}
                        aria-label="Portalled"
                        defaultValue={String(value)}
                    />
                </div>,
                document.body,
            );
        }
        const portalled: Column<Item>[] = [
            { key: "id", width: 80 },
            {
                key: "name",
                width: 160,
                editable: true,
                renderEditCell: (props) => <PortalEditor {...props} />,
            },
        ];
        const { container, getByLabelText } = render(
            <DataGrid.Root
                columns={portalled}
                rows={items}
                rowHeight={20}
                defaultActivePosition={at(1, 1)}
            >
                <DataGrid.Grid>
                    <DataGrid.Body>
                        <DataGrid.Rows<Item>>
                            {(row) => (
                                <DataGrid.Row row={row}>
                                    <DataGrid.Cells<Item>>
                                        {(cell) => (
                                            <DataGrid.Cell cell={cell} />
                                        )}
                                    </DataGrid.Cells>
                                </DataGrid.Row>
                            )}
                        </DataGrid.Rows>
                    </DataGrid.Body>
                </DataGrid.Grid>
            </DataGrid.Root>,
        );
        const cell = cellAt(container, 1, 1);
        fireEvent.keyDown(cell, { key: "F2" });
        const field = getByLabelText("Portalled");
        expect(field.parentElement?.getAttribute("data-grid-editor")).toMatch(
            /^g\d+-\d+$/,
        );
        await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
        expect(field).toHaveFocus();
        expect(cell).toHaveAttribute("data-editing");
    });

    it("tells a controlled parent once per commit, and a kept edit never tells a value twice", () => {
        const changes: (EditingCell | null)[] = [];
        const onCellEdit = vi.fn();
        function Controlled({ keep }: { keep: boolean }) {
            const [editing, setEditing] = useState<EditingCell | null>(null);
            return (
                <Grid
                    defaultActivePosition={at(3, 1)}
                    editingCell={editing}
                    onEditingCellChange={(next) => {
                        changes.push(next);
                        if (next || !keep) setEditing(next);
                    }}
                    onCellEdit={onCellEdit}
                />
            );
        }
        const { container, unmount } = render(<Controlled keep={false} />);
        fireEvent.keyDown(cellAt(container, 3, 1), { key: "Enter" });
        const input = cellAt(container, 3, 1).querySelector("input");
        if (!input) throw new Error("no editor");
        fireEvent.change(input, { target: { value: "once" } });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(changes).toEqual([at(3, 1), null]);
        expect(onCellEdit).toHaveBeenCalledTimes(1);
        unmount();
        changes.length = 0;
        onCellEdit.mockClear();
        // a parent keeping the edit open: each gesture asks once, a value is told once
        const kept = render(<Controlled keep />);
        fireEvent.keyDown(cellAt(kept.container, 3, 1), { key: "Enter" });
        const field = cellAt(kept.container, 3, 1).querySelector("input");
        if (!field) throw new Error("no editor");
        fireEvent.change(field, { target: { value: "kept" } });
        fireEvent.keyDown(field, { key: "Escape" });
        expect(changes).toEqual([at(3, 1), null]);
        const press = () =>
            act(() => {
                document.body.dispatchEvent(
                    new MouseEvent("pointerdown", { bubbles: true }),
                );
            });
        press();
        press();
        expect(onCellEdit).toHaveBeenCalledTimes(1);
        expect(onCellEdit).toHaveBeenCalledWith(
            expect.objectContaining({ value: "kept" }),
        );
        expect(changes).toEqual([at(3, 1), null, null, null]);
    });

    it("asks a controlled parent, and follows its prop", () => {
        const onEditingCellChange = vi.fn();
        function Controlled() {
            const [editing, setEditing] = useState<EditingCell | null>(null);
            return (
                <Grid
                    defaultActivePosition={at(3, 1)}
                    editingCell={editing}
                    onEditingCellChange={(next) => {
                        onEditingCellChange(next);
                        setEditing(next);
                    }}
                />
            );
        }
        const { container } = render(<Controlled />);
        const cell = cellAt(container, 3, 1);
        fireEvent.keyDown(cell, { key: "Enter" });
        expect(onEditingCellChange).toHaveBeenCalledWith(at(3, 1));
        expect(cell).toHaveAttribute("data-editing", "");
        // a parent that ignores it: no edit
        const ignored = vi.fn();
        const { container: other } = render(
            <Grid
                defaultActivePosition={at(3, 1)}
                editingCell={null}
                onEditingCellChange={ignored}
            />,
        );
        fireEvent.keyDown(cellAt(other, 3, 1), { key: "Enter" });
        expect(ignored).toHaveBeenCalledWith(at(3, 1));
        expect(cellAt(other, 3, 1)).not.toHaveAttribute("data-editing");
    });

    it("commits on a press outside the grid", () => {
        const onCellEdit = vi.fn();
        const { container } = render(
            <>
                <Grid
                    defaultActivePosition={at(4, 1)}
                    defaultEditingCell={at(4, 1)}
                    onCellEdit={onCellEdit}
                />
                <button type="button">outside</button>
            </>,
        );
        const input = cellAt(container, 4, 1).querySelector("input");
        if (!input) throw new Error("no editor");
        fireEvent.change(input, { target: { value: "pressed out" } });
        const outside = container.querySelector("button");
        if (!outside) throw new Error("no button");
        act(() => {
            outside.dispatchEvent(
                new MouseEvent("pointerdown", { bubbles: true }),
            );
        });
        expect(onCellEdit).toHaveBeenCalledWith(
            expect.objectContaining({ value: "pressed out", row: items[4] }),
        );
        expect(cellAt(container, 4, 1)).not.toHaveAttribute("data-editing");
    });
});
