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
    type RowInfo,
    type RowKey,
    typedDataGrid,
} from "../src";
import { groupKeyOf, type LocalRowsResult, useLocalRows } from "../src/local";
import { useGroupToggle } from "../src/row-grouping";
import {
    cellAt,
    click,
    FEATURES,
    type Features,
    h,
    keyDown,
    renderGrid,
    root,
    rowAt,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// Row groups in Vue (Epic #87, E3.1–E3.2): `useLocalRows` groups by columns and hands the root
// the rows shown with their kinds; the grid is a treegrid, group rows render their value and the
// app's aggregates, the app's toggle and the keys expand them, and a group row selects its rows.

interface Sale {
    id: number;
    country: string;
    city: string;
    amount: number;
}

const G = typedDataGrid<Sale, Features>();

const sales: Sale[] = [
    { id: 1, country: "France", city: "Paris", amount: 10 },
    { id: 2, country: "Brazil", city: "Recife", amount: 5 },
    { id: 3, country: "France", city: "Lyon", amount: 7 },
    { id: 4, country: "Brazil", city: "Natal", amount: 3 },
];

const columns: Column<Sale, VNodeChild>[] = [
    { key: "country", name: "Country", width: 120 },
    { key: "city", name: "City", width: 120 },
    {
        key: "amount",
        name: "Amount",
        width: 100,
        renderGroupCell: ({ value }) => `Σ ${String(value)}`,
    },
];

const aggregates = {
    amount: (rows: readonly Sale[]) =>
        rows.reduce((total, row) => total + row.amount, 0),
};
const rowKey = (row: Sale) => row.id;

const BRAZIL = groupKeyOf([["country", "Brazil"]]);
const FRANCE = groupKeyOf([["country", "France"]]);

stubViewportSize(600, 400);

let latest: LocalRowsResult<Sale> | undefined;

/** The app's toggle: a button in the group row's cell of its column. */
const Toggle = defineComponent({
    props: {
        cell: { type: Object as PropType<CellInfo<Sale>>, required: true },
    },
    setup(props) {
        const { state, props: own } = useGroupToggle(() => props.cell);
        return () =>
            state.value.expandable
                ? h("button", {
                      type: "button",
                      "aria-label": state.value.expanded
                          ? "Collapse"
                          : "Expand",
                      ...own.value,
                  })
                : null;
    },
});

const Sales = defineComponent({
    props: {
        groupBy: {
            type: Array as PropType<string[]>,
            default: () => ["country"],
        },
        table: { type: Boolean, default: false },
        expandedGroupKeys: {
            type: Array as PropType<readonly RowKey[]>,
            default: undefined,
        },
        onExpandedGroupKeysChange: {
            type: Function as PropType<(keys: readonly RowKey[]) => void>,
            default: undefined,
        },
        rowSelection: {
            type: String as PropType<"multiple">,
            default: undefined,
        },
    },
    setup(props) {
        const local = useLocalRows(sales, columns, () => ({
            features: FEATURES,
            groupBy: props.groupBy,
            aggregates,
            rowKey,
            expandedGroupKeys: props.expandedGroupKeys,
            onExpandedGroupKeysChange: props.onExpandedGroupKeysChange,
        }));
        latest = local;
        return () => {
            const tag = tags(props.table);
            return h(
                G.Root,
                {
                    features: FEATURES,
                    columns,
                    rowHeight: 20,
                    rowSelection: props.rowSelection,
                    ...local.props,
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
                                                        row: RowInfo<Sale>;
                                                    }) => [
                                                        h(
                                                            G.Row,
                                                            {
                                                                row,
                                                                as: tag.row,
                                                            },
                                                            {
                                                                default: () => [
                                                                    h(
                                                                        G.Cells,
                                                                        null,
                                                                        {
                                                                            default:
                                                                                ({
                                                                                    cell,
                                                                                }: {
                                                                                    cell: CellInfo<Sale>;
                                                                                }) => [
                                                                                    cell.group &&
                                                                                    cell
                                                                                        .column
                                                                                        .key ===
                                                                                        cell
                                                                                            .group
                                                                                            .columnKey
                                                                                        ? h(
                                                                                              G.Cell,
                                                                                              {
                                                                                                  cell,
                                                                                                  as: tag.cell,
                                                                                              },
                                                                                              {
                                                                                                  default:
                                                                                                      () => [
                                                                                                          h(
                                                                                                              Toggle,
                                                                                                              {
                                                                                                                  cell,
                                                                                                              },
                                                                                                          ),
                                                                                                          `${String(cell.value)} (${cell.group?.childCount})`,
                                                                                                      ],
                                                                                              },
                                                                                          )
                                                                                        : h(
                                                                                              G.Cell,
                                                                                              {
                                                                                                  cell,
                                                                                                  as: tag.cell,
                                                                                              },
                                                                                          ),
                                                                                ],
                                                                        },
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
                    ],
                },
            );
        };
    },
});

const grid = (container: HTMLElement) =>
    root(container).querySelector('[data-grid-part="grid"]');

const rowCount = (container: HTMLElement) =>
    container.querySelectorAll('[data-grid-part="row"]').length;

describe.each([false, true])("row groups (table: %s)", (table) => {
    it("makes a treegrid of group rows, with their value and aggregates", async () => {
        const { container } = renderGrid(() => h(Sales, { table }));
        await settled();
        expect(grid(container)?.getAttribute("role")).toBe("treegrid");
        expect(rowCount(container)).toBe(2);
        const brazil = rowAt(container, 0);
        expect(brazil.hasAttribute("data-group-row")).toBe(true);
        expect(brazil.hasAttribute("data-loading")).toBe(false);
        expect(brazil.hasAttribute("data-group-expanded")).toBe(false);
        expect(brazil.getAttribute("aria-level")).toBe("1");
        expect(brazil.getAttribute("aria-expanded")).toBe("false");
        expect(brazil.getAttribute("aria-setsize")).toBe("2");
        expect(brazil.getAttribute("aria-posinset")).toBe("1");
        expect(brazil.getAttribute("data-depth")).toBe("0");
        expect(cellAt(container, 0, 0).textContent).toBe("Brazil (2)");
        // the column's renderGroupCell, given the aggregate
        expect(cellAt(container, 0, 2).textContent).toBe("Σ 8");
        // a column with no aggregate shows nothing
        expect(cellAt(container, 0, 1).textContent).toBe("");
    });

    it("expands a group by the app's toggle: its rows under it", async () => {
        const { container } = renderGrid(() => h(Sales, { table }));
        await settled();
        const toggle = cellAt(container, 1, 0).querySelector("button");
        if (!toggle) throw new Error("no toggle");
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        click(toggle);
        await settled();
        expect(latest?.group.expandedKeys).toEqual([FRANCE]);
        expect(rowCount(container)).toBe(4);
        const france = rowAt(container, 1);
        expect(france.getAttribute("aria-expanded")).toBe("true");
        expect(france.hasAttribute("data-group-expanded")).toBe(true);
        const paris = rowAt(container, 2);
        expect(paris.getAttribute("aria-level")).toBe("2");
        expect(paris.hasAttribute("data-group-row")).toBe(false);
        expect(cellAt(container, 2, 1).textContent).toBe("Paris");
        expect(
            cellAt(container, 1, 0).querySelector("button")?.dataset.expanded,
        ).toBe("");
    });

    it("toggles a group row with Enter, and goes up the tree with ←", async () => {
        const { container } = renderGrid(() => h(Sales, { table }));
        await settled();
        cellAt(container, 0, 1).focus();
        click(cellAt(container, 0, 1));
        await settled();
        keyDown(cellAt(container, 0, 1), { key: "Enter" });
        await settled();
        expect(latest?.group.expandedKeys).toEqual([BRAZIL]);
        expect(rowCount(container)).toBe(4);
        cellAt(container, 2, 0).focus();
        await settled();
        keyDown(cellAt(container, 2, 0), { key: "ArrowLeft" });
        await settled();
        expect(document.activeElement).toBe(cellAt(container, 0, 0));
        keyDown(cellAt(container, 0, 0), { key: "ArrowLeft" });
        await settled();
        expect(latest?.group.expandedKeys).toEqual([]);
        expect(rowCount(container)).toBe(2);
    });

    it("selects a group row's rows", async () => {
        const { container } = renderGrid(() =>
            h(Sales, { table, rowSelection: "multiple" }),
        );
        await settled();
        const brazil = rowAt(container, 0);
        expect(brazil.getAttribute("aria-selected")).toBe("false");
        cellAt(container, 0, 1).focus();
        await settled();
        keyDown(cellAt(container, 0, 1), { key: " ", shiftKey: true });
        await settled();
        expect(rowAt(container, 0).getAttribute("aria-selected")).toBe("true");
        expect(rowAt(container, 0).hasAttribute("data-selected")).toBe(true);
    });
});

describe("row groups", () => {
    it("leave a grid without groups as it was: a grid, rows without levels", async () => {
        const { container } = renderGrid(() => h(Sales, { groupBy: [] }));
        await settled();
        expect(grid(container)?.getAttribute("role")).toBe("grid");
        expect(rowCount(container)).toBe(4);
        const row = rowAt(container, 0);
        for (const name of [
            "aria-level",
            "aria-expanded",
            "aria-setsize",
            "aria-posinset",
            "data-depth",
            "data-group-row",
        ]) {
            expect(row.hasAttribute(name), name).toBe(false);
        }
        expect(latest?.props).not.toHaveProperty("getRowMeta");
        expect(cellAt(container, 0, 0).querySelector("button")).toBeNull();
    });

    it("follow controlled keys, and ask for the toggle's", async () => {
        const asked = vi.fn();
        const keys = shallowRef<readonly RowKey[]>([BRAZIL]);
        const { container } = renderGrid(() =>
            h(Sales, {
                expandedGroupKeys: keys.value,
                onExpandedGroupKeysChange: (next: readonly RowKey[]) => {
                    asked(next);
                    keys.value = next;
                },
            }),
        );
        await settled();
        expect(rowCount(container)).toBe(4);
        const toggle = cellAt(container, 3, 0).querySelector("button");
        if (toggle) click(toggle);
        await settled();
        expect(asked).toHaveBeenLastCalledWith([BRAZIL, FRANCE]);
        expect(rowCount(container)).toBe(6);
    });

    it("keep the selection by the app's keys once the grouping is off", async () => {
        const groupBy = shallowRef<string[] | undefined>(undefined);
        const { container } = renderGrid(() =>
            h(Sales, {
                rowSelection: "multiple",
                ...(groupBy.value ? { groupBy: groupBy.value } : {}),
            }),
        );
        await settled();
        cellAt(container, 0, 1).focus();
        await settled();
        keyDown(cellAt(container, 0, 1), { key: " ", shiftKey: true });
        await settled();
        // Brazil: the sales 2 and 4
        groupBy.value = [];
        await settled();
        const second = sales[1];
        if (!second) throw new Error("no sale");
        expect(latest?.props.rowKey?.(second, 1)).toBe(2);
        const selected = [0, 1, 2, 3].map(
            (rowIndex) =>
                rowAt(container, rowIndex).getAttribute("aria-selected") ===
                "true",
        );
        expect(selected).toEqual([false, true, false, true]);
    });

    it("drop the row kinds when getRowMeta is removed from the root", async () => {
        const getRowMeta = () => ({ depth: 0 });
        const meta = shallowRef(true);
        const { container } = renderGrid(() =>
            h(
                G.Root,
                {
                    features: FEATURES,
                    columns,
                    rows: sales,
                    rowHeight: 20,
                    getRowMeta: meta.value ? getRowMeta : undefined,
                },
                { default: () => [h(G.Grid)] },
            ),
        );
        await settled();
        expect(grid(container)?.getAttribute("role")).toBe("treegrid");
        meta.value = false;
        await settled();
        expect(grid(container)?.getAttribute("role")).toBe("grid");
    });

    it("nest by two columns, and expand them all", async () => {
        const { container } = renderGrid(() =>
            h(Sales, { groupBy: ["country", "city"] }),
        );
        await settled();
        latest?.group.expandAll();
        await settled();
        // Brazil, Natal, #4, Recife, #2, France, Lyon, #3, Paris, #1
        expect(rowCount(container)).toBe(10);
        expect(rowAt(container, 2).getAttribute("aria-level")).toBe("3");
        latest?.group.collapseAll();
        await settled();
        expect(rowCount(container)).toBe(2);
    });
});
