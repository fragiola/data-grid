import { describe, expect, it, vi } from "vitest";
import {
    defineComponent,
    type PropType,
    shallowRef,
    type VNodeChild,
} from "vue";
import {
    type CellInfo,
    type Column,
    type DataGridRef,
    type HeaderCellInfo,
    type RowInfo,
    type RowKey,
    type RowSelection,
    type RowState,
    typedDataGrid,
    useDataGridRef,
} from "../src";
import { useLocalRows } from "../src/local";
import { useSelectAll } from "../src/row-selection";
import {
    cellAt,
    click,
    FEATURES,
    type Features,
    h,
    keyDown,
    renderGrid,
    rowAt,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// Row selection (Epic #57, R1–R8): `Root` maps the selection (controlled or not), its mode and
// `isRowSelectable` onto the model; rows carry `data-selected` and `aria-selected`, the grid
// `aria-multiselectable`, as divs or as a table; `useSelectAll` drives a "select all" control.

interface Person {
    id: string;
    locked: boolean;
}

const people: Person[] = Array.from({ length: 20 }, (_, i) => ({
    id: `p${i}`,
    locked: i === 3,
}));

const columns: Column<Person, VNodeChild>[] = [
    { key: "id", name: "Id", width: 120 },
];

const G = typedDataGrid<Person, Features>();

stubViewportSize(400, 300);

const KEYS = people.map((person) => person.id);

/** A header checkbox through useSelectAll, as an app writes it. */
const SelectAll = defineComponent({
    props: {
        gridRef: {
            type: Object as PropType<DataGridRef<Person, Features>>,
            default: undefined,
        },
    },
    setup(props) {
        const all = useSelectAll(KEYS, props.gridRef);
        return () =>
            h("input", {
                type: "checkbox",
                "aria-label": "Select all",
                "data-status": all.status,
                "data-count": all.count,
                "data-can-toggle": all.canToggle ? "" : undefined,
                checked: all.status === "all",
                onChange: all.toggle,
            });
    },
});

type GridProps = {
    table?: boolean;
    /** `null`: rows not selectable */
    rowSelection?: RowSelection | null;
    selectedRowKeys?: readonly RowKey[];
    defaultSelectedRowKeys?: readonly RowKey[];
    onSelectedRowKeysChange?: (keys: readonly RowKey[]) => void;
    isRowSelectable?: (row: Person) => boolean;
    gridRef?: DataGridRef<Person, Features>;
    rowStates?: boolean[];
};

function grid({
    table = false,
    rowSelection = "multiple",
    rowStates,
    ...props
}: GridProps = {}) {
    const tag = tags(table);
    return h(
        G.Root,
        {
            features: FEATURES,
            columns,
            rows: people,
            rowKey: (row: Person) => row.id,
            rowHeight: 20,
            rowSelection: rowSelection ?? undefined,
            ...props,
        },
        {
            default: () => [
                h(
                    G.Grid,
                    { as: tag.grid },
                    {
                        default: () => [
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
                                                    h(G.HeaderCells, null, {
                                                        default: ({
                                                            cell,
                                                        }: {
                                                            cell: HeaderCellInfo<Person>;
                                                        }) => [
                                                            h(
                                                                G.HeaderCell,
                                                                {
                                                                    cell,
                                                                    as: tag.headerCell,
                                                                },
                                                                {
                                                                    default:
                                                                        () => [
                                                                            h(
                                                                                SelectAll,
                                                                            ),
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
                            h(
                                G.Body,
                                { as: tag.body },
                                {
                                    default: () => [
                                        h(G.Rows, null, {
                                            default: ({
                                                row,
                                            }: {
                                                row: RowInfo<Person>;
                                            }) => [
                                                h(
                                                    G.Row,
                                                    { row, as: tag.row },
                                                    {
                                                        // the row's state, as React's className function reads it
                                                        default: ({
                                                            state,
                                                        }: {
                                                            state: RowState;
                                                        }) => {
                                                            if (
                                                                row.rowIndex ===
                                                                1
                                                            ) {
                                                                rowStates?.push(
                                                                    state.selected,
                                                                );
                                                            }
                                                            return [
                                                                h(
                                                                    G.Cells,
                                                                    null,
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
                                                                                        as: tag.cell,
                                                                                    },
                                                                                ),
                                                                            ],
                                                                    },
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
                    },
                ),
            ],
        },
    );
}

const shiftSpace = (target: HTMLElement) =>
    keyDown(target, { key: " ", shiftKey: true });

const selectAllBox = (container: ParentNode) =>
    container.querySelector(
        'input[aria-label="Select all"]',
    ) as HTMLInputElement;

for (const table of [false, true]) {
    describe(`selected rows, as ${table ? "a table" : "divs"}`, () => {
        it("carry data-selected and aria-selected, the grid aria-multiselectable", async () => {
            const { container } = renderGrid(() =>
                grid({ table, defaultSelectedRowKeys: ["p1"] }),
            );
            await settled();
            const gridElement = container.querySelector(
                '[data-grid-part="grid"]',
            );
            expect(gridElement).toHaveAttribute("aria-multiselectable", "true");
            expect(rowAt(container, 1)).toHaveAttribute("data-selected", "");
            expect(rowAt(container, 1)).toHaveAttribute(
                "aria-selected",
                "true",
            );
            expect(rowAt(container, 2)).not.toHaveAttribute("data-selected");
            expect(rowAt(container, 2)).toHaveAttribute(
                "aria-selected",
                "false",
            );
        });

        it("toggle on Shift+Space, uncontrolled, telling the app", async () => {
            const onChange = vi.fn();
            const { container } = renderGrid(() =>
                grid({ table, onSelectedRowKeysChange: onChange }),
            );
            await settled();
            const cell = cellAt(container, 2);
            cell.focus();
            await settled();
            shiftSpace(cell);
            await settled();
            expect(onChange).toHaveBeenLastCalledWith(["p2"]);
            expect(rowAt(container, 2)).toHaveAttribute("data-selected", "");
        });
    });
}

describe("controlled selection", () => {
    it("follows the keys, asks for a toggle, and keeps the anchor for a range", async () => {
        const keys = shallowRef<readonly RowKey[]>([]);
        const { container } = renderGrid(() =>
            grid({
                selectedRowKeys: keys.value,
                onSelectedRowKeysChange: (next) => {
                    keys.value = next;
                },
            }),
        );
        await settled();
        const start = cellAt(container, 2);
        start.focus();
        await settled();
        shiftSpace(start);
        await settled();
        expect(rowAt(container, 2)).toHaveAttribute("data-selected", "");
        // the parent answered the toggle: the anchor is still row 2
        const cell = cellAt(container, 2);
        keyDown(cell, { key: "ArrowDown", shiftKey: true });
        await settled();
        keyDown(cellAt(container, 3), { key: "ArrowDown", shiftKey: true });
        await settled();
        for (const index of [2, 3, 4]) {
            expect(rowAt(container, index)).toHaveAttribute(
                "data-selected",
                "",
            );
        }
    });

    it("keeps a Shift+click's anchor without one before, as uncontrolled", async () => {
        let run: ((rowIndex: number, extend: boolean) => void) | undefined;
        const Controlled = defineComponent({
            setup() {
                const keys = shallowRef<readonly RowKey[]>([]);
                const gridRef = useDataGridRef<Person, Features>();
                run = (rowIndex, extend) =>
                    gridRef.current?.model.run("selected-rows.toggle", {
                        rowIndex,
                        extend,
                    });
                return () =>
                    grid({
                        gridRef,
                        selectedRowKeys: keys.value,
                        onSelectedRowKeysChange: (next) => {
                            keys.value = next;
                        },
                    });
            },
        });
        const { container } = renderGrid(Controlled);
        await settled();
        run?.(1, true);
        await settled();
        run?.(4, true);
        await settled();
        for (const index of [1, 2, 3, 4]) {
            expect(rowAt(container, index)).toHaveAttribute(
                "data-selected",
                "",
            );
        }
    });

    it("selects nothing the parent does not follow", async () => {
        const onChange = vi.fn();
        const { container } = renderGrid(() =>
            grid({ selectedRowKeys: [], onSelectedRowKeysChange: onChange }),
        );
        await settled();
        const cell = cellAt(container, 2);
        cell.focus();
        await settled();
        shiftSpace(cell);
        await settled();
        expect(onChange).toHaveBeenCalledWith(["p2"]);
        expect(rowAt(container, 2)).not.toHaveAttribute("data-selected");
    });
});

describe("modes and rows that cannot be selected", () => {
    it("single mode: no aria-multiselectable, one row at a time, the trimmed default told", async () => {
        const onChange = vi.fn();
        const { container } = renderGrid(() =>
            grid({
                onSelectedRowKeysChange: onChange,
                rowSelection: "single",
                defaultSelectedRowKeys: ["p1", "p2"],
            }),
        );
        await settled();
        expect(onChange).toHaveBeenCalledWith(["p2"]);
        const gridElement = container.querySelector('[data-grid-part="grid"]');
        expect(gridElement).not.toHaveAttribute("aria-multiselectable");
        expect(rowAt(container, 1)).not.toHaveAttribute("data-selected");
        expect(rowAt(container, 2)).toHaveAttribute("data-selected", "");
    });

    it("a row isRowSelectable refuses carries no aria-selected", async () => {
        const { container } = renderGrid(() =>
            grid({ isRowSelectable: (row) => !row.locked }),
        );
        await settled();
        expect(rowAt(container, 3)).not.toHaveAttribute("aria-selected");
        expect(rowAt(container, 4)).toHaveAttribute("aria-selected", "false");
    });

    it("without rowSelection, rows carry nothing and Shift+Space is not the grid's", async () => {
        const { container } = renderGrid(() =>
            h(
                G.Root,
                { features: FEATURES, columns, rows: people, rowHeight: 20 },
                {
                    default: () => [
                        h(G.Grid, null, {
                            default: () => [
                                h(G.Body, null, {
                                    default: () => [
                                        h(G.Rows, null, {
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
                                                            h(G.Cells, null, {
                                                                default: ({
                                                                    cell,
                                                                }: {
                                                                    cell: CellInfo<Person>;
                                                                }) => [
                                                                    h(G.Cell, {
                                                                        cell,
                                                                    }),
                                                                ],
                                                            }),
                                                        ],
                                                    },
                                                ),
                                            ],
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                },
            ),
        );
        await settled();
        expect(
            container.querySelectorAll("[aria-selected], [data-selected]"),
        ).toHaveLength(0);
        expect(container.querySelector("[aria-multiselectable]")).toBeNull();
        const cell = cellAt(container, 1);
        cell.focus();
        await settled();
        expect(shiftSpace(cell).defaultPrevented).toBe(false);
    });

    it("turns off and on with the prop, the keys kept meanwhile", async () => {
        const props = shallowRef<GridProps>({ defaultSelectedRowKeys: ["p1"] });
        const { container } = renderGrid(() => grid(props.value));
        await settled();
        expect(rowAt(container, 1)).toHaveAttribute("data-selected", "");
        props.value = { defaultSelectedRowKeys: ["p1"], rowSelection: null };
        await settled();
        expect(rowAt(container, 1)).not.toHaveAttribute("data-selected");
        expect(rowAt(container, 1)).not.toHaveAttribute("aria-selected");
        props.value = { defaultSelectedRowKeys: ["p1"] };
        await settled();
        expect(rowAt(container, 1)).toHaveAttribute("data-selected", "");
    });
});

describe("useSelectAll", () => {
    it("tells none, some or all, and toggles every key", async () => {
        const { container } = renderGrid(() => grid());
        await settled();
        const box = selectAllBox(container);
        expect(box.dataset.status).toBe("none");
        click(box);
        await settled();
        expect(box.dataset.status).toBe("all");
        expect(box.dataset.count).toBe("20");
        expect(rowAt(container, 5)).toHaveAttribute("data-selected", "");
        const cell = cellAt(container, 5);
        cell.focus();
        await settled();
        shiftSpace(cell);
        await settled();
        expect(box.dataset.status).toBe("some");
        click(box);
        await settled();
        expect(box.dataset.status).toBe("all");
        click(box);
        await settled();
        expect(box.dataset.status).toBe("none");
    });

    it("only clears in single mode, and selects nothing while rows are not selectable", async () => {
        const props = shallowRef<GridProps>({
            rowSelection: "single",
            defaultSelectedRowKeys: ["p2"],
        });
        const { container } = renderGrid(() => grid(props.value));
        await settled();
        const box = () => selectAllBox(container);
        expect(box().dataset.status).toBe("some");
        expect(box()).toHaveAttribute("data-can-toggle");
        click(box());
        await settled();
        expect(box().dataset.status).toBe("none");
        expect(box()).not.toHaveAttribute("data-can-toggle");
        click(box());
        await settled();
        expect(box().dataset.status).toBe("none");
        props.value = { rowSelection: null, defaultSelectedRowKeys: ["p2"] };
        await settled();
        click(box());
        await settled();
        expect(box().dataset.status).toBe("none");
        expect(container.querySelectorAll("[data-selected]")).toHaveLength(0);
    });

    it("works outside the root through a gridRef", async () => {
        const Outside = defineComponent({
            setup() {
                const gridRef = useDataGridRef<Person, Features>();
                return () => [h(SelectAll, { gridRef }), grid({ gridRef })];
            },
        });
        const { container } = renderGrid(Outside);
        await settled();
        // the fragment's nodes sit in the element the app is mounted on
        const outside = container.querySelector(
            ':scope > div > input[aria-label="Select all"]',
        ) as HTMLInputElement;
        click(outside);
        await settled();
        expect(outside.dataset.status).toBe("all");
        expect(rowAt(container, 0)).toHaveAttribute("data-selected", "");
    });
});

describe("a row's state", () => {
    it("reports selected", async () => {
        const states: boolean[] = [];
        renderGrid(() =>
            grid({ rowStates: states, defaultSelectedRowKeys: ["p1"] }),
        );
        await settled();
        expect(states.at(-1)).toBe(true);
    });
});

describe("useLocalRows", () => {
    it("returns every page's filtered rows", async () => {
        let result: ReturnType<typeof useLocalRows<Person>> | undefined;
        const Local = defineComponent({
            setup() {
                result = useLocalRows(people, columns, { pageSize: 5 });
                return () => null;
            },
        });
        renderGrid(Local);
        await settled();
        expect(result?.rows).toHaveLength(5);
        expect(result?.filteredRows).toHaveLength(20);
        result?.filter.setSearch("p1");
        await settled();
        expect(result?.filteredRows.map((person) => person.id)).toEqual([
            "p1",
            "p10",
            "p11",
            "p12",
            "p13",
            "p14",
            "p15",
            "p16",
            "p17",
            "p18",
            "p19",
        ]);
    });
});
