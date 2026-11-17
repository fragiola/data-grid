import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    inject,
    input,
    type TemplateRef,
    viewChild,
} from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { describe, expect, it, vi } from "vitest";
import {
    type CellEditEvent,
    type CellPosition,
    type Column,
    contextOf,
    DATA_GRID,
    type DataGridNode,
    type EditCellRenderProps,
    type EditingCell,
    type TemplateContext,
    templateContent,
} from "../src/public-api";
import { cellAt, keyDown, render, settled, stubViewportSize } from "./helpers";

// Cell editing (Epic #88, E4.3): the root maps the edited cell (controlled or not) onto the model
// and tells commits through `(cellEdit)` with their row; an edited cell carries `data-editing` and
// renders its column's `renderEditCell` (a template) with the draft, as divs or as a table; the
// grid writes no data.

interface Item {
    id: number;
    name: string;
}

const items: Item[] = Array.from({ length: 10 }, (_, id) => ({
    id,
    name: `item ${id}`,
}));

stubViewportSize(400, 300);

type EditProps = EditCellRenderProps<Item, DataGridNode>;

/** An editor portalled out of the grid (Vue's Teleport, React's portal), focusing itself once rendered. */
@Component({
    selector: "test-portal-editor",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [attr.data-grid-editor]="edit().editorProps['data-grid-editor']">
            <input #field aria-label="Portalled" [value]="text()" />
        </div>
    `,
})
class PortalEditor {
    readonly edit = input.required<EditProps>();
    readonly text = computed(() => String(this.edit().value));
    private readonly field =
        viewChild.required<ElementRef<HTMLInputElement>>("field");

    constructor() {
        const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
        afterNextRender(() => {
            document.body.appendChild(host);
            this.field().nativeElement.focus();
        });
    }
}

/** What the editing grid renders besides its columns. */
interface EditGridOptions {
    readonly table?: boolean;
    /** the portalled editor's columns */
    readonly portalled?: boolean;
    /** a button after the grid */
    readonly outside?: boolean;
    readonly defaultActivePosition?: CellPosition;
    readonly defaultEditingCell?: EditingCell | null;
    readonly onEditingCellChange?: (editing: EditingCell | null) => void;
    readonly onCellEdit?: (edit: CellEditEvent<Item>) => void;
}

@Component({
    selector: "test-edit-grid",
    imports: [DATA_GRID, PortalEditor],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ng-template #nameEditor [dataGridTemplate]="editContext" let-edit>
            <input aria-label="Name" [attr.data-start]="edit.startKey ?? null"
                [value]="text(edit.value)" (input)="onInput(edit, $event)" />
        </ng-template>
        <ng-template #portalEditor [dataGridTemplate]="editContext" let-edit>
            <test-portal-editor [edit]="edit" />
        </ng-template>
        <div dataGridRoot [rows]="rows" [columns]="columns()" [rowHeight]="20"
            [defaultActivePosition]="options().defaultActivePosition"
            [defaultEditingCell]="options().defaultEditingCell"
            [editingCell]="editingCell()"
            (editingCellChange)="options().onEditingCellChange?.($event)"
            (cellEdit)="options().onCellEdit?.($event)">
            @if (options().table) {
                <table dataGridGrid>
                    <tbody dataGridBody>
                        <ng-template dataGridRows let-row>
                            <tr [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <td [dataGridCell]="cell"><ng-container *dataGridCellContent /></td>
                                </ng-template>
                            </tr>
                        </ng-template>
                    </tbody>
                </table>
            } @else {
                <div dataGridGrid>
                    <div dataGridBody>
                        <ng-template dataGridRows let-row>
                            <div [dataGridRow]="row">
                                <ng-template dataGridCells let-cell>
                                    <div [dataGridCell]="cell"><ng-container *dataGridCellContent /></div>
                                </ng-template>
                            </div>
                        </ng-template>
                    </div>
                </div>
            }
        </div>
        @if (options().outside) {
            <button type="button">outside</button>
        }
    `,
})
class EditGrid {
    readonly rows = items;
    readonly options = input<EditGridOptions>({});
    /** controlled: the edited cell; `undefined`, not controlled */
    readonly editingCell = input<EditingCell | null | undefined>(undefined);
    readonly editContext = contextOf<EditProps>();
    private readonly nameEditor =
        viewChild.required<TemplateRef<TemplateContext<EditProps>>>(
            "nameEditor",
        );
    private readonly portalEditor =
        viewChild.required<TemplateRef<TemplateContext<EditProps>>>(
            "portalEditor",
        );

    readonly columns = computed((): Column<Item, DataGridNode>[] => {
        if (this.options().portalled) {
            const portal = this.portalEditor();
            return [
                { key: "id", width: 80 },
                {
                    key: "name",
                    width: 160,
                    editable: true,
                    renderEditCell: (edit) => templateContent(portal, edit),
                },
            ];
        }
        const editor = this.nameEditor();
        return [
            { key: "id", width: 80 },
            {
                key: "name",
                width: 160,
                editable: true,
                renderEditCell: (edit) => templateContent(editor, edit),
            },
            // editable, with no editor of the grid's: its content is the app's
            { key: "note", width: 80, editable: true },
        ];
    });

    text(value: unknown) {
        return String(value);
    }

    onInput(edit: EditProps, event: Event) {
        if (event.target instanceof HTMLInputElement) {
            edit.onChange(event.target.value);
        }
    }
}

/** Renders the editing grid; `setEditingCell` controls its edited cell (rendered later). */
async function renderGrid(
    options: EditGridOptions = {},
    editingCell?: EditingCell | null,
) {
    let fixture: ComponentFixture<EditGrid> | undefined;
    const rendered = await render(EditGrid, (created) => {
        fixture = created;
        created.componentRef.setInput("options", options);
        created.componentRef.setInput("editingCell", editingCell);
    });
    return {
        ...rendered,
        setEditingCell(next: EditingCell | null) {
            fixture?.componentRef.setInput("editingCell", next);
        },
    };
}

const at = (rowIndex: number, columnIndex: number) => ({
    rowIndex,
    columnIndex,
});

/** Types `value` into `input`: its value, and the `input` event an editor listens to. */
function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
}

function editorOf(cell: HTMLElement): HTMLInputElement {
    const input = cell.querySelector("input");
    if (!input) throw new Error("no editor");
    return input;
}

for (const table of [false, true]) {
    describe(`editing, as ${table ? "a table" : "divs"}`, () => {
        it("renders the column's editor in the edited cell, focused, and tells a commit with its row", async () => {
            const edits: CellEditEvent<Item>[] = [];
            const { container } = await renderGrid({
                table,
                defaultActivePosition: at(2, 1),
                onCellEdit: (edit) => edits.push(edit),
            });
            const cell = cellAt(container, 2, 1);
            expect(cell).toHaveTextContent("item 2");
            keyDown(cell, { key: "Enter" });
            await settled();
            expect(cell).toHaveAttribute("data-editing", "");
            const input = editorOf(cell);
            expect(input).toHaveValue("item 2");
            expect(input).toHaveFocus();
            type(input, "renamed");
            await settled();
            expect(input).toHaveValue("renamed");
            keyDown(input, { key: "Enter" });
            await settled();
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
    it("starts with the typed key, and Escape cancels, telling nothing", async () => {
        const onCellEdit = vi.fn();
        const changes: (EditingCell | null)[] = [];
        const { container } = await renderGrid({
            defaultActivePosition: at(1, 1),
            onCellEdit,
            onEditingCellChange: (editing) => changes.push(editing),
        });
        const cell = cellAt(container, 1, 1);
        keyDown(cell, { key: "q" });
        await settled();
        const input = editorOf(cell);
        expect(input).toHaveAttribute("data-start", "q");
        type(input, "q");
        await settled();
        keyDown(input, { key: "Escape" });
        await settled();
        expect(onCellEdit).not.toHaveBeenCalled();
        expect(cell.querySelector("input")).toBeNull();
        expect(cell).toHaveFocus();
        expect(changes).toEqual([{ ...at(1, 1), startKey: "q" }, null]);
    });

    it("cancels an edit with no editor to focus: an editable column without one traps no key", async () => {
        const changes: (EditingCell | null)[] = [];
        const { container } = await renderGrid({
            defaultActivePosition: at(1, 2),
            onEditingCellChange: (editing) => changes.push(editing),
        });
        const cell = cellAt(container, 1, 2);
        keyDown(cell, { key: "F2" });
        // the next task: an editor focusing itself later would have kept it
        await settled();
        expect(cell).not.toHaveAttribute("data-editing");
        expect(changes).toEqual([at(1, 2), null]);
        keyDown(cell, { key: "ArrowDown" });
        await settled();
        expect(cellAt(container, 2, 2)).toHaveFocus();
    });

    it("keeps an edit whose portalled editor, marked with its editorProps, takes focus once rendered", async () => {
        const { container } = await renderGrid({
            portalled: true,
            defaultActivePosition: at(1, 1),
        });
        const cell = cellAt(container, 1, 1);
        keyDown(cell, { key: "F2" });
        await settled();
        const field = document.querySelector('[aria-label="Portalled"]');
        if (!(field instanceof HTMLInputElement)) throw new Error("no field");
        expect(field.parentElement?.getAttribute("data-grid-editor")).toMatch(
            /^g\d+-\d+$/,
        );
        expect(container).not.toContainElement(field);
        await settled();
        expect(field).toHaveFocus();
        expect(cell).toHaveAttribute("data-editing");
    });

    it("tells a controlled parent once per commit, and a kept edit never tells a value twice", async () => {
        const changes: (EditingCell | null)[] = [];
        const onCellEdit = vi.fn();
        const controlled = async (keep: boolean) => {
            const grid = await renderGrid(
                {
                    defaultActivePosition: at(3, 1),
                    onEditingCellChange: (next) => {
                        changes.push(next);
                        if (next || !keep) grid.setEditingCell(next);
                    },
                    onCellEdit,
                },
                null,
            );
            return grid;
        };
        const { container, fixture } = await controlled(false);
        keyDown(cellAt(container, 3, 1), { key: "Enter" });
        await settled();
        type(editorOf(cellAt(container, 3, 1)), "once");
        await settled();
        keyDown(editorOf(cellAt(container, 3, 1)), { key: "Enter" });
        await settled();
        expect(changes).toEqual([at(3, 1), null]);
        expect(onCellEdit).toHaveBeenCalledTimes(1);
        fixture.destroy();
        changes.length = 0;
        onCellEdit.mockClear();
        // a parent keeping the edit open: each gesture asks once, a value is told once
        const kept = await controlled(true);
        keyDown(cellAt(kept.container, 3, 1), { key: "Enter" });
        await settled();
        const field = editorOf(cellAt(kept.container, 3, 1));
        type(field, "kept");
        await settled();
        keyDown(field, { key: "Escape" });
        await settled();
        expect(changes).toEqual([at(3, 1), null]);
        const press = async () => {
            document.body.dispatchEvent(
                new MouseEvent("pointerdown", { bubbles: true }),
            );
            await settled();
        };
        await press();
        await press();
        expect(onCellEdit).toHaveBeenCalledTimes(1);
        expect(onCellEdit).toHaveBeenCalledWith(
            expect.objectContaining({ value: "kept" }),
        );
        expect(changes).toEqual([at(3, 1), null, null, null]);
    });

    it("asks a controlled parent, and follows its input", async () => {
        const onEditingCellChange = vi.fn();
        const grid = await renderGrid(
            {
                defaultActivePosition: at(3, 1),
                onEditingCellChange: (next) => {
                    onEditingCellChange(next);
                    grid.setEditingCell(next);
                },
            },
            null,
        );
        const cell = cellAt(grid.container, 3, 1);
        keyDown(cell, { key: "Enter" });
        await settled();
        expect(onEditingCellChange).toHaveBeenCalledWith(at(3, 1));
        expect(cell).toHaveAttribute("data-editing", "");
        // a parent that ignores it: no edit
        const ignored = vi.fn();
        const { container: other } = await renderGrid(
            { defaultActivePosition: at(3, 1), onEditingCellChange: ignored },
            null,
        );
        keyDown(cellAt(other, 3, 1), { key: "Enter" });
        await settled();
        expect(ignored).toHaveBeenCalledWith(at(3, 1));
        expect(cellAt(other, 3, 1)).not.toHaveAttribute("data-editing");
    });

    it("commits on a press outside the grid", async () => {
        const onCellEdit = vi.fn();
        const { container } = await renderGrid({
            outside: true,
            defaultActivePosition: at(4, 1),
            defaultEditingCell: at(4, 1),
            onCellEdit,
        });
        type(editorOf(cellAt(container, 4, 1)), "pressed out");
        await settled();
        const outside = container.querySelector("button");
        if (!outside) throw new Error("no button");
        outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
        await settled();
        expect(onCellEdit).toHaveBeenCalledWith(
            expect.objectContaining({ value: "pressed out", row: items[4] }),
        );
        expect(cellAt(container, 4, 1)).not.toHaveAttribute("data-editing");
    });
});
