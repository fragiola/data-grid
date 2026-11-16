import { describe, expect, it } from "vitest";
import {
    createTextVNode,
    defineComponent,
    h,
    type PropType,
    shallowRef,
    type VNodeChild,
} from "vue";
import {
    type CellInfo,
    type Column,
    type RowInfo,
    typedDataGrid,
    useGroupToggle,
} from "../src";
import { type LocalRowsResult, useLocalRows } from "../src/local";
import {
    cellAt,
    click,
    keyDown,
    renderGrid,
    root,
    rowAt,
    settled,
    stubViewportSize,
} from "./helpers";

// Tree data in Vue (Epic #87, E3.3): `useLocalRows` with `getSubRows` hands the root a tree whose
// parents are data rows that expand by their key: the app's toggle, Space and the arrows open
// them, ARIA tells their level, and a parent selects itself (its rows by the app's own checkbox).

interface File {
    name: string;
    children?: File[];
}

const G = typedDataGrid<File>();

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

const columns: Column<File, VNodeChild>[] = [
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

const Toggle = defineComponent({
    props: {
        cell: { type: Object as PropType<CellInfo<File>>, required: true },
    },
    setup(props) {
        const toggle = useGroupToggle(() => props.cell);
        return () =>
            toggle.state.value.expandable
                ? h("button", {
                      type: "button",
                      "aria-label": "Toggle",
                      ...toggle.props.value,
                  })
                : null;
    },
});

/** The first column's cell: the toggle and the name; the others the cell's own content. */
const cellOf = ({ cell }: { cell: CellInfo<File> }) => [
    cell.columnIndex === 0
        ? h(
              G.Cell,
              { cell },
              {
                  default: () => [
                      h(Toggle, { cell }),
                      createTextVNode(cell.row?.name ?? ""),
                  ],
              },
          )
        : h(G.Cell, { cell }),
];

const rowOf = ({ row }: { row: RowInfo<File> }) => [
    h(
        G.Row,
        { row },
        { default: () => [h(G.Cells, null, { default: cellOf })] },
    ),
];

const Files = defineComponent({
    // `tick` only renders it again
    props: { tick: { type: Number, default: 0 } },
    setup(props) {
        const local = useLocalRows(files, columns, { getSubRows, rowKey });
        latest = local;
        return () => {
            props.tick;
            return h(
                G.Root,
                {
                    ...local.props,
                    columns,
                    rowHeight: 20,
                    rowSelection: "multiple",
                },
                {
                    default: () => [
                        h(G.Grid, null, {
                            default: () => [
                                h(G.Body, null, {
                                    default: () => [
                                        h(G.Rows, null, { default: rowOf }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                },
            );
        };
    },
});

const rowCount = (container: HTMLElement) =>
    container.querySelectorAll('[data-grid-part="row"]').length;

describe("tree data", () => {
    it("makes a treegrid of the top rows, a parent a data row that expands", async () => {
        const { container } = renderGrid(Files);
        await settled();
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

    it("expands a parent by its toggle, and by Space; Enter stays its cell's", async () => {
        const { container } = renderGrid(Files);
        await settled();
        const toggle = cellAt(container, 0, 0).querySelector("button");
        if (toggle) click(toggle);
        await settled();
        expect(latest?.group.expandedKeys).toEqual(["src"]);
        expect(rowCount(container)).toBe(4);
        expect(rowAt(container, 2).getAttribute("aria-level")).toBe("2");
        expect(rowAt(container, 2).getAttribute("aria-posinset")).toBe("2");
        cellAt(container, 2, 1).focus();
        await settled();
        keyDown(cellAt(container, 2, 1), { key: "Enter" });
        await settled();
        expect(rowCount(container)).toBe(4);
        keyDown(cellAt(container, 2, 1), { key: " " });
        await settled();
        expect(latest?.group.expandedKeys).toEqual(["src", "lib"]);
        expect(rowCount(container)).toBe(5);
        expect(rowAt(container, 3).getAttribute("aria-level")).toBe("3");
    });

    it("selects a parent alone; its rows' keys are the app's to add", async () => {
        const { container } = renderGrid(Files);
        await settled();
        cellAt(container, 0, 1).focus();
        await settled();
        keyDown(cellAt(container, 0, 1), { key: " ", shiftKey: true });
        await settled();
        expect(rowAt(container, 0).getAttribute("aria-selected")).toBe("true");
        expect(latest?.group.subRowKeysOf(0)).toEqual([
            "app.ts",
            "lib",
            "a.ts",
        ]);
        expect(latest?.group.subRowKeysOf(1)).toEqual([]);
    });

    it("keeps subRowKeysOf while the rows shown stay, and moves no row of a tree", async () => {
        const tick = shallowRef(0);
        renderGrid(() => h(Files, { tick: tick.value }));
        await settled();
        const first = latest?.group.subRowKeysOf;
        tick.value += 1;
        await settled();
        expect(latest?.group.subRowKeysOf).toBe(first);
        expect(latest?.moveRow({ fromIndex: 0, toIndex: 1 })).toBe(files);
    });
});
