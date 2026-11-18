import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineComponent, h, type PropType, type VNodeChild } from "vue";
import {
    type CellInfo,
    type Column,
    type ColumnOrGroup,
    type HeaderCellInfo,
    type HeaderRowInfo,
    type RootProps,
    type RowInfo,
    type RowKey,
    typedDataGrid,
    useGroupLabel,
} from "../src";
import { useFillHandle } from "../src/fill";
import { groupKeyOf, useLocalRows } from "../src/local";
import { RowDetail } from "../src/row-expansion";
import { typedSummaryRows } from "../src/summary-rows";
import {
    FEATURES,
    type Features,
    renderGrid,
    root,
    scrollRoot,
    settled,
    stubViewportSize,
} from "./helpers";

// D9 across features (Epic #89, E5.3, for Vue): a scroll that keeps the rendered windows renders
// no component at all, whichever feature is on (the engine writes the layers' offsets and the
// sticky insets itself); a scroll past them renders the parts the new windows hold, a bounded
// number of times. Each grid holds 2,000 rows and 40 columns, scrolled into the middle first,
// then moved a few pixels at a time on the axes the feature lives on.
//
// React counts commits with a Profiler; Vue counts component renders (`renderGrid`'s mixin:
// every component's beforeMount and beforeUpdate, by name). Inside the windows: React's 0
// commits is 0 renders of any component (no `DataGridCell` in particular). Past them: React's
// `crossing` commits (1, or 2 with measured heights) is, in Vue, some renders, cells among them
// (the window changed), and each cell at most `crossing` times: `DataGridCell` renders at most
// `crossing` × the cell elements the DOM held during the crossing (mounted or updated once a pass).

interface Item {
    id: number;
    team: string;
    children?: Item[];
}

const G = {
    ...typedDataGrid<Item, Features>(),
    RowDetail,
    ...typedSummaryRows<Item>(),
};

const TEAMS = ["A", "B", "C", "D"];
const items: Item[] = Array.from({ length: 2_000 }, (_, id) => ({
    id,
    team: TEAMS[id % TEAMS.length] ?? "A",
}));
const rowKey = (row: Item) => row.id;

type ItemColumn = Column<Item, VNodeChild>;

const column = (key: string, extra: Partial<ItemColumn> = {}): ItemColumn => ({
    key,
    name: key,
    width: 100,
    getValue: (row) => `${row.id}-${key}`,
    ...extra,
});

const COLUMNS: ItemColumn[] = [
    column("team", { getValue: (row) => row.team }),
    ...Array.from({ length: 39 }, (_, i) => column(`c${i}`)),
];

stubViewportSize(400, 300);

/** The app's fill handle, shown in the cell that has it. */
const Handle = defineComponent({
    name: "AppFillHandle",
    props: {
        cell: { type: Object as PropType<CellInfo<Item>>, required: true },
    },
    setup(props) {
        const { state, props: handle } = useFillHandle(() => props.cell);
        return () => (state.value.visible ? h("span", handle.value) : null);
    },
});

/** A group's sticky label, as an app writes it. */
const Label = defineComponent({
    name: "AppGroupLabel",
    props: {
        cell: {
            type: Object as PropType<HeaderCellInfo<Item>>,
            required: true,
        },
    },
    setup(props) {
        const { props: label } = useGroupLabel(() => props.cell);
        return () => h("span", label.value, props.cell.group?.name);
    },
});

type GridProps = Partial<
    Omit<RootProps<Item, Features>, "rows" | "rowCount" | "getRow">
> & { rows?: readonly Item[]; fillHandle?: boolean };

/** Every part rendered: the header with group labels, summary rows, cells, details. */
function grid({ fillHandle = false, rows = items, ...props }: GridProps) {
    return h(
        G.Root,
        {
            features: FEATURES,
            columns: COLUMNS,
            rowKey,
            rowHeight: 20,
            ...props,
            rows,
        },
        {
            default: () => [
                h(G.Grid, null, {
                    default: () => [
                        h(G.Header, null, {
                            default: () => [
                                h(G.HeaderRows, null, {
                                    default: ({
                                        row,
                                    }: {
                                        row: HeaderRowInfo<Item>;
                                    }) => [
                                        h(
                                            G.HeaderRow,
                                            { row },
                                            {
                                                default: () => [
                                                    h(G.HeaderCells, null, {
                                                        default: ({
                                                            cell,
                                                        }: {
                                                            cell: HeaderCellInfo<Item>;
                                                        }) => [
                                                            h(
                                                                G.HeaderCell,
                                                                { cell },
                                                                cell.group
                                                                    ? {
                                                                          default:
                                                                              () => [
                                                                                  h(
                                                                                      Label,
                                                                                      {
                                                                                          cell,
                                                                                      },
                                                                                  ),
                                                                              ],
                                                                      }
                                                                    : undefined,
                                                            ),
                                                        ],
                                                    }),
                                                ],
                                            },
                                        ),
                                    ],
                                }),
                            ],
                        }),
                        h(G.Summary, { position: "top" }),
                        h(G.Body, null, {
                            default: () => [
                                h(G.Rows, null, {
                                    default: ({
                                        row,
                                    }: {
                                        row: RowInfo<Item>;
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
                                                            cell: CellInfo<Item>;
                                                        }) => [
                                                            h(
                                                                G.Cell,
                                                                { cell },
                                                                fillHandle
                                                                    ? {
                                                                          default:
                                                                              () => [
                                                                                  String(
                                                                                      cell.value ??
                                                                                          "",
                                                                                  ),
                                                                                  h(
                                                                                      Handle,
                                                                                      {
                                                                                          cell,
                                                                                      },
                                                                                  ),
                                                                              ],
                                                                      }
                                                                    : undefined,
                                                            ),
                                                        ],
                                                    }),
                                                    h(G.RowDetail, null, {
                                                        default: () => [
                                                            h(
                                                                "p",
                                                                String(
                                                                    row.row?.id,
                                                                ),
                                                            ),
                                                        ],
                                                    }),
                                                ],
                                            },
                                        ),
                                    ],
                                }),
                            ],
                        }),
                        h(G.Summary, { position: "bottom" }),
                    ],
                }),
            ],
        },
    );
}

/** Rows grouped by team, every group expanded, through `useLocalRows`. */
const TEAM_KEYS: readonly RowKey[] = TEAMS.map((team) =>
    groupKeyOf([["team", team]]),
);
const grouped = (props: GridProps = {}) =>
    defineComponent({
        name: "GroupedGrid",
        setup() {
            const local = useLocalRows(items, COLUMNS, {
                groupBy: ["team"],
                rowKey,
                expandedGroupKeys: TEAM_KEYS,
            });
            return () => grid({ ...props, ...local.props });
        },
    });

/** A tree: 200 parents of 9 rows each, every parent expanded, through `useLocalRows`. */
const parents: Item[] = Array.from({ length: 200 }, (_, p) => ({
    ...(items[p * 10] as Item),
    children: items.slice(p * 10 + 1, p * 10 + 10),
}));
const PARENT_KEYS: readonly RowKey[] = parents.map(rowKey);
const getSubRows = (row: Item) => row.children;
const tree = (props: GridProps = {}) =>
    defineComponent({
        name: "TreeGrid",
        setup() {
            const local = useLocalRows(parents, COLUMNS, {
                getSubRows,
                rowKey,
                expandedGroupKeys: PARENT_KEYS,
            });
            return () => grid({ ...props, ...local.props });
        },
    });

interface Scrolls {
    /** the axes moved a few pixels at a time inside the rendered windows */
    axes: "x" | "y" | "both";
    /** right to left: `scrollLeft` is negative */
    rtl?: boolean;
    /** the passes a scroll past the rendered windows makes (React's commits; default 1) */
    crossing?: number;
    /** a part the grid shows through the scrolls inside the windows (its selector) */
    shown?: string;
}

/**
 * Mounts `ui`, scrolls into the middle (row 20, column 6) and a few pixels on, settling the
 * rendered windows there, then 15px at a time three times on `axes` (the visible ranges move
 * inside the rendered ones, the overscan): no component renders; then far down and sideways: the
 * new windows' parts render, cells at most `crossing` times each.
 */
async function expectNoRenderOnScroll(
    ui: Parameters<typeof renderGrid>[0],
    { axes, rtl = false, crossing = 1, shown }: Scrolls,
) {
    const { container, renders, rendersOf, resetRenders } = renderGrid(ui);
    await settled();
    const viewport = root(container);
    const sign = rtl ? -1 : 1;
    const top = 400;
    const left = 600;
    for (const offset of [0, 5]) {
        scrollRoot(viewport, {
            top: top + offset,
            left: sign * (left + offset),
        });
        await settled();
    }
    resetRenders();
    for (let step = 1; step <= 3; step++) {
        scrollRoot(viewport, {
            ...(axes !== "x" ? { top: top + 5 + step * 15 } : {}),
            ...(axes !== "y" ? { left: sign * (left + 5 + step * 15) } : {}),
        });
        await settled();
    }
    expect(rendersOf("DataGridCell")).toBe(0);
    expect(renders()).toBe(0);
    if (shown) expect(container.querySelector(shown)).not.toBeNull();
    // every cell element in the DOM during the crossing: those added on the way (a pass's
    // window the next one replaced, measured heights) and those there at the end
    const cells = new Set<Element>();
    const collect = (records: MutationRecord[]) => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.matches(CELL)) cells.add(node);
                for (const cell of node.querySelectorAll(CELL)) cells.add(cell);
            }
        }
    };
    const observer = new MutationObserver(collect);
    observer.observe(container, { childList: true, subtree: true });
    scrollRoot(viewport, { top: top + 2_000, left: sign * (left + 1_500) });
    await settled();
    collect(observer.takeRecords());
    observer.disconnect();
    for (const cell of container.querySelectorAll(CELL)) cells.add(cell);
    expect(rendersOf("DataGridCell")).toBeGreaterThan(0);
    expect(rendersOf("DataGridCell")).toBeLessThanOrEqual(
        crossing * cells.size,
    );
}

const CELL = '[data-grid-part="cell"]';

const RANGE = {
    anchor: { rowIndex: 22, columnIndex: 7 },
    focus: { rowIndex: 26, columnIndex: 9 },
};

describe("no Vue render on a scroll inside the rendered windows (D9)", () => {
    it("with no feature on", async () => {
        await expectNoRenderOnScroll(() => grid({}), { axes: "both" });
    });

    it("with columns pinned at the start and at the end", async () => {
        const columns = COLUMNS.map((entry, i) =>
            i === 0
                ? { ...entry, pinned: "start" as const }
                : i === COLUMNS.length - 1
                  ? { ...entry, pinned: "end" as const }
                  : entry,
        );
        await expectNoRenderOnScroll(() => grid({ columns }), {
            axes: "both",
            shown: '[data-pinned="end"]',
        });
    });

    it("with column groups, one collapsible, and sticky labels", async () => {
        const [first, ...rest] = COLUMNS;
        const groups: ColumnOrGroup<Item, VNodeChild>[] = [
            first as ItemColumn,
            ...Array.from({ length: 13 }, (_, g) => ({
                key: `g${g}`,
                name: `G${g}`,
                ...(g === 2
                    ? {
                          collapsible: true,
                          children: rest
                              .slice(g * 3, g * 3 + 3)
                              .map((child, i) =>
                                  i === 0
                                      ? child
                                      : {
                                            ...child,
                                            groupShow: "expanded" as const,
                                        },
                              ),
                      }
                    : { children: rest.slice(g * 3, g * 3 + 3) }),
            })),
        ];
        await expectNoRenderOnScroll(() => grid({ columns: groups }), {
            axes: "both",
            shown: '[data-grid-part="group-label"]',
        });
    });

    it("with column spans", async () => {
        const columns = COLUMNS.map((entry, i) =>
            i % 3 === 1
                ? {
                      ...entry,
                      colSpan: ({
                          type,
                          ...args
                      }: Parameters<NonNullable<ItemColumn["colSpan"]>>[0]) =>
                          type === "row" &&
                          "rowIndex" in args &&
                          args.rowIndex % 2 === 0
                              ? 2
                              : undefined,
                  }
                : entry,
        );
        await expectNoRenderOnScroll(() => grid({ columns }), {
            axes: "both",
            shown: '[aria-colspan="2"]',
        });
    });

    it("with summary rows at the top and the bottom", async () => {
        await expectNoRenderOnScroll(
            () =>
                grid({
                    summaryRows: { top: 1, bottom: 1 },
                    summaryRowHeight: 30,
                }),
            {
                axes: "both",
                shown: '[data-grid-part="summary-row"]',
            },
        );
    });

    it("with row heights of a function", async () => {
        // heights that vary: fewer rows in view than at the last window keep the rendered range
        // (a scroll changes no size: `windowFor`'s `scrolled`)
        await expectNoRenderOnScroll(
            () => grid({ rowHeight: (rowIndex) => 20 + (rowIndex % 4) * 10 }),
            { axes: "both" },
        );
    });

    it("with expanded rows' details", async () => {
        await expectNoRenderOnScroll(
            () => grid({ defaultExpandedRowKeys: [21, 23], detailHeight: 60 }),
            { axes: "both", shown: '[data-grid-part="row-detail"]' },
        );
    });

    it("with row groups", async () => {
        await expectNoRenderOnScroll(grouped(), {
            axes: "both",
            // a group's rows, one level down
            shown: '[data-grid-part="row"][aria-level="2"]',
        });
    });

    it("with tree data", async () => {
        await expectNoRenderOnScroll(tree(), {
            axes: "both",
            shown: '[aria-expanded="true"]',
        });
    });

    it("with row selection", async () => {
        await expectNoRenderOnScroll(
            () =>
                grid({
                    rowSelection: "multiple",
                    defaultSelectedRowKeys: [20, 21, 22, 25],
                }),
            { axes: "both", shown: "[data-selected]" },
        );
    });

    it("with a cell range selected", async () => {
        await expectNoRenderOnScroll(
            () =>
                grid({
                    cellSelection: "range",
                    defaultActivePosition: RANGE.anchor,
                    defaultSelectedRange: RANGE,
                }),
            { axes: "both", shown: "[data-selected-cell]" },
        );
    });

    it("with the fill handle shown", async () => {
        await expectNoRenderOnScroll(
            () =>
                grid({
                    fillHandle: true,
                    cellSelection: "range",
                    defaultActivePosition: RANGE.anchor,
                    defaultSelectedRange: RANGE,
                    onFill: () => {},
                }),
            { axes: "both", shown: '[data-grid-part="fill-handle"]' },
        );
    });

    it("with an editor open", async () => {
        const columns = COLUMNS.map(
            (entry): ItemColumn =>
                entry.key === "c6"
                    ? {
                          ...entry,
                          editable: true,
                          renderEditCell: ({ value, onChange }) =>
                              h("input", {
                                  "aria-label": "Edit",
                                  value: String(value),
                                  onInput: (event: Event) =>
                                      onChange(
                                          (event.target as HTMLInputElement)
                                              .value,
                                      ),
                              }),
                      }
                    : entry,
        );
        const at = { rowIndex: 24, columnIndex: 7 };
        await expectNoRenderOnScroll(
            () =>
                grid({
                    columns,
                    defaultActivePosition: at,
                    defaultEditingCell: at,
                }),
            { axes: "both", shown: "[data-editing] input" },
        );
    });

    it("right to left", async () => {
        const columns = COLUMNS.map((entry, i) =>
            i === 0 ? { ...entry, pinned: "start" as const } : entry,
        );
        await expectNoRenderOnScroll(
            () => grid({ columns, direction: "rtl" }),
            { axes: "both", rtl: true, shown: '[dir="rtl"]' },
        );
    });
});

describe("no Vue render on a scroll inside the rendered windows, measured heights (D9)", () => {
    // jsdom lays nothing out: a row's box is 20 to 50 tall by index, a detail's 80
    const original = HTMLElement.prototype.getBoundingClientRect;
    beforeAll(() => {
        HTMLElement.prototype.getBoundingClientRect = function (
            this: HTMLElement,
        ) {
            const part = this.dataset.gridPart;
            if (part === "row-detail") return DOMRect.fromRect({ height: 80 });
            if (part === "row") {
                const detail = this.querySelector(
                    '[data-grid-part="row-detail"]',
                );
                return DOMRect.fromRect({
                    height:
                        20 +
                        (Number(this.dataset.rowIndex) % 4) * 10 +
                        (detail ? 80 : 0),
                });
            }
            return original.call(this);
        };
    });
    afterAll(() => {
        HTMLElement.prototype.getBoundingClientRect = original;
    });

    it("with rows and details measured", async () => {
        // as with heights of a function: fewer rows in view keep the rendered range
        await expectNoRenderOnScroll(
            () =>
                grid({
                    rowHeight: "auto",
                    estimatedRowHeight: 30,
                    detailHeight: "auto",
                    estimatedDetailHeight: 60,
                    defaultExpandedRowKeys: [21, 23],
                }),
            // the rows rendered for the first time are measured after the render: a second pass
            { axes: "both", crossing: 2 },
        );
    });

    it("with every feature at once", async () => {
        const [first, ...rest] = COLUMNS;
        const columns: ColumnOrGroup<Item, VNodeChild>[] = [
            { ...(first as ItemColumn), pinned: "start" },
            {
                key: "g",
                name: "G",
                collapsible: true,
                children: rest
                    .slice(0, 4)
                    .map((child, i) =>
                        i === 0
                            ? child
                            : { ...child, groupShow: "expanded" as const },
                    ),
            },
            ...rest
                .slice(4, -1)
                .map((entry, i) =>
                    i % 3 === 1 ? { ...entry, colSpan: () => 2 } : entry,
                ),
            { ...(rest.at(-1) as ItemColumn), pinned: "end" },
        ];
        await expectNoRenderOnScroll(
            grouped({
                columns,
                rowHeight: "auto",
                estimatedRowHeight: 30,
                summaryRows: { top: 1, bottom: 1 },
                rowSelection: "multiple",
                cellSelection: "range",
                defaultActivePosition: RANGE.anchor,
                defaultSelectedRange: RANGE,
                onFill: () => {},
                fillHandle: true,
                direction: "rtl",
            }),
            // measured heights: the new rows' measures render again
            { axes: "both", rtl: true, crossing: 2 },
        );
    });
});
