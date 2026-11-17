import { describe, expect, it, vi } from "vitest";
import {
    defineComponent,
    onMounted,
    type PropType,
    ref,
    shallowRef,
    Teleport,
    type VNodeChild,
} from "vue";
import {
    type CellInfo,
    type Column,
    type EditCellRenderProps,
    type EditingCell,
    type RootProps,
    type RowInfo,
    typedDataGrid,
} from "../src";
import type { CellEditEvent } from "../src/editing";
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

// Cell editing (Epic #88, E4.3): `Root` maps the edited cell (controlled or not) onto the model and
// tells commits through `onCellEdit` with their row; an edited cell carries `data-editing` and
// renders its column's `renderEditCell` with the draft, as divs or as a table; the grid writes no
// data.

interface Item {
    id: number;
    name: string;
}

const G = typedDataGrid<Item, Features>();

const items: Item[] = Array.from({ length: 10 }, (_, id) => ({
    id,
    name: `item ${id}`,
}));

const columns: Column<Item, VNodeChild>[] = [
    { key: "id", width: 80 },
    {
        key: "name",
        width: 160,
        editable: true,
        renderEditCell: ({ value, startKey, onChange }) =>
            h("input", {
                "aria-label": "Name",
                "data-start": startKey,
                value: String(value),
                onInput: (event: Event) =>
                    onChange((event.target as HTMLInputElement).value),
            }),
    },
    // editable, with no editor of the grid's: its slot is the app's
    { key: "note", width: 80, editable: true },
];

stubViewportSize(400, 300);

type GridProps = Partial<
    Pick<
        RootProps<Item, Features>,
        | "editingCell"
        | "defaultEditingCell"
        | "onEditingCellChange"
        | "onCellEdit"
        | "defaultActivePosition"
    >
> & { table?: boolean };

function grid({ table = false, ...props }: GridProps = {}) {
    const tag = tags(table);
    return h(
        G.Root,
        { features: FEATURES, columns, rows: items, rowHeight: 20, ...props },
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
                                                                    h(G.Cell, {
                                                                        cell,
                                                                        as: tag.cell,
                                                                    }),
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
            const { container } = renderGrid(() =>
                grid({
                    table,
                    defaultActivePosition: at(2, 1),
                    onCellEdit: (edit) => edits.push(edit),
                }),
            );
            await settled();
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
        const { container } = renderGrid(() =>
            grid({
                defaultActivePosition: at(1, 1),
                onCellEdit,
                onEditingCellChange: (editing) => changes.push(editing),
            }),
        );
        await settled();
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
        const { container } = renderGrid(() =>
            grid({
                defaultActivePosition: at(1, 2),
                onEditingCellChange: (editing) => changes.push(editing),
            }),
        );
        await settled();
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

    it("keeps an edit whose portalled editor, marked with its editorProps, takes focus in an effect", async () => {
        const PortalEditor = defineComponent({
            props: {
                edit: {
                    type: Object as PropType<
                        EditCellRenderProps<Item, VNodeChild>
                    >,
                    required: true,
                },
            },
            setup(props) {
                const field = ref<HTMLInputElement | null>(null);
                onMounted(() => field.value?.focus());
                return () =>
                    h(Teleport, { to: "body" }, [
                        h("div", props.edit.editorProps, [
                            h("input", {
                                ref: field,
                                "aria-label": "Portalled",
                                value: String(props.edit.value),
                            }),
                        ]),
                    ]);
            },
        });
        const portalled: Column<Item, VNodeChild>[] = [
            { key: "id", width: 80 },
            {
                key: "name",
                width: 160,
                editable: true,
                renderEditCell: (edit) => h(PortalEditor, { edit }),
            },
        ];
        const { container } = renderGrid(() =>
            h(
                G.Root,
                {
                    features: FEATURES,
                    columns: portalled,
                    rows: items,
                    rowHeight: 20,
                    defaultActivePosition: at(1, 1),
                },
                {
                    default: () => [
                        h(G.Grid, null, {
                            default: () => [
                                h(G.Body, null, {
                                    default: () => [h(G.Rows)],
                                }),
                            ],
                        }),
                    ],
                },
            ),
        );
        await settled();
        const cell = cellAt(container, 1, 1);
        keyDown(cell, { key: "F2" });
        await settled();
        const field = document.querySelector('[aria-label="Portalled"]');
        if (!(field instanceof HTMLInputElement)) throw new Error("no field");
        expect(field.parentElement?.getAttribute("data-grid-editor")).toMatch(
            /^g\d+-\d+$/,
        );
        await settled();
        expect(field).toHaveFocus();
        expect(cell).toHaveAttribute("data-editing");
    });

    it("tells a controlled parent once per commit, and a kept edit never tells a value twice", async () => {
        const changes: (EditingCell | null)[] = [];
        const onCellEdit = vi.fn();
        const controlled = (keep: boolean) => {
            const editing = shallowRef<EditingCell | null>(null);
            return () =>
                grid({
                    defaultActivePosition: at(3, 1),
                    editingCell: editing.value,
                    onEditingCellChange: (next) => {
                        changes.push(next);
                        if (next || !keep) editing.value = next;
                    },
                    onCellEdit,
                });
        };
        const { container, unmount } = renderGrid(controlled(false));
        await settled();
        keyDown(cellAt(container, 3, 1), { key: "Enter" });
        await settled();
        type(editorOf(cellAt(container, 3, 1)), "once");
        await settled();
        keyDown(editorOf(cellAt(container, 3, 1)), { key: "Enter" });
        await settled();
        expect(changes).toEqual([at(3, 1), null]);
        expect(onCellEdit).toHaveBeenCalledTimes(1);
        unmount();
        changes.length = 0;
        onCellEdit.mockClear();
        // a parent keeping the edit open: each gesture asks once, a value is told once
        const kept = renderGrid(controlled(true));
        await settled();
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

    it("asks a controlled parent, and follows its prop", async () => {
        const onEditingCellChange = vi.fn();
        const editing = shallowRef<EditingCell | null>(null);
        const { container } = renderGrid(() =>
            grid({
                defaultActivePosition: at(3, 1),
                editingCell: editing.value,
                onEditingCellChange: (next) => {
                    onEditingCellChange(next);
                    editing.value = next;
                },
            }),
        );
        await settled();
        const cell = cellAt(container, 3, 1);
        keyDown(cell, { key: "Enter" });
        await settled();
        expect(onEditingCellChange).toHaveBeenCalledWith(at(3, 1));
        expect(cell).toHaveAttribute("data-editing", "");
        // a parent that ignores it: no edit
        const ignored = vi.fn();
        const { container: other } = renderGrid(() =>
            grid({
                defaultActivePosition: at(3, 1),
                editingCell: null,
                onEditingCellChange: ignored,
            }),
        );
        await settled();
        keyDown(cellAt(other, 3, 1), { key: "Enter" });
        await settled();
        expect(ignored).toHaveBeenCalledWith(at(3, 1));
        expect(cellAt(other, 3, 1)).not.toHaveAttribute("data-editing");
    });

    it("commits on a press outside the grid", async () => {
        const onCellEdit = vi.fn();
        const { container } = renderGrid(() => [
            grid({
                defaultActivePosition: at(4, 1),
                defaultEditingCell: at(4, 1),
                onCellEdit,
            }),
            h("button", { type: "button" }, "outside"),
        ]);
        await settled();
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
