import { act } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CellInfo,
    type Column,
    type ColumnOrGroup,
    DataGrid,
    type HeaderCellInfo,
    type RootProps,
    type RowKey,
    useFillHandle,
    useGroupLabel,
} from "../src";
import { groupKeyOf, useLocalRows } from "../src/local";
import { renderCounting, root, scrollRoot, stubViewportSize } from "./helpers";

// D9 across features (Epic #89, E5.3): a scroll that keeps the rendered windows renders nothing
// in React, whichever feature is on (the engine writes the layers' offsets and the sticky insets
// itself); a scroll past them renders once. Each grid holds 2,000 rows and 40 columns, scrolled
// into the middle first, then moved a few pixels at a time on the axes the feature lives on.

interface Item {
    id: number;
    team: string;
    children?: Item[];
}

const TEAMS = ["A", "B", "C", "D"];
const items: Item[] = Array.from({ length: 2_000 }, (_, id) => ({
    id,
    team: TEAMS[id % TEAMS.length] ?? "A",
}));
const rowKey = (row: Item) => row.id;

const column = (
    key: string,
    extra: Partial<Column<Item>> = {},
): Column<Item> => ({
    key,
    name: key,
    width: 100,
    getValue: (row) => `${row.id}-${key}`,
    ...extra,
});

const COLUMNS: Column<Item>[] = [
    column("team", { getValue: (row) => row.team }),
    ...Array.from({ length: 39 }, (_, i) => column(`c${i}`)),
];

stubViewportSize(400, 300);

/** The app's fill handle, shown in the cell that has it. */
function Handle({ cell }: { cell: CellInfo<Item> }) {
    const { state, props } = useFillHandle(cell);
    return state.visible ? <span {...props} /> : null;
}

/** A group's sticky label, as an app writes it. */
function Label({ cell }: { cell: HeaderCellInfo<Item> }) {
    const { props } = useGroupLabel(cell);
    return <span {...props}>{cell.group?.name}</span>;
}

type GridProps = Partial<
    Omit<RootProps<Item>, "rows" | "rowCount" | "getRow" | "children">
> & { rows?: readonly Item[]; fillHandle?: boolean };

/** Every part rendered: the header with group labels, summary rows, cells, details. */
function Grid({ fillHandle = false, rows = items, ...props }: GridProps) {
    return (
        <DataGrid.Root
            columns={COLUMNS}
            rowKey={rowKey}
            rowHeight={20}
            {...props}
            rows={rows}
        >
            <DataGrid.Grid>
                <DataGrid.Header>
                    <DataGrid.HeaderRows<Item>>
                        {(row) => (
                            <DataGrid.HeaderRow row={row}>
                                <DataGrid.HeaderCells<Item>>
                                    {(cell) => (
                                        <DataGrid.HeaderCell cell={cell}>
                                            {cell.group ? (
                                                <Label cell={cell} />
                                            ) : undefined}
                                        </DataGrid.HeaderCell>
                                    )}
                                </DataGrid.HeaderCells>
                            </DataGrid.HeaderRow>
                        )}
                    </DataGrid.HeaderRows>
                </DataGrid.Header>
                <DataGrid.Summary position="top" />
                <DataGrid.Body>
                    <DataGrid.Rows<Item>>
                        {(row) => (
                            <DataGrid.Row row={row}>
                                <DataGrid.Cells<Item>>
                                    {(cell) => (
                                        <DataGrid.Cell cell={cell}>
                                            {fillHandle ? (
                                                <>
                                                    {String(cell.value ?? "")}
                                                    <Handle cell={cell} />
                                                </>
                                            ) : undefined}
                                        </DataGrid.Cell>
                                    )}
                                </DataGrid.Cells>
                                <DataGrid.RowDetail>
                                    <p>{row.row?.id}</p>
                                </DataGrid.RowDetail>
                            </DataGrid.Row>
                        )}
                    </DataGrid.Rows>
                </DataGrid.Body>
                <DataGrid.Summary position="bottom" />
            </DataGrid.Grid>
        </DataGrid.Root>
    );
}

/** Rows grouped by team, every group expanded, through `useLocalRows`. */
const TEAM_KEYS: readonly RowKey[] = TEAMS.map((team) =>
    groupKeyOf([["team", team]]),
);
function Grouped(props: GridProps) {
    const local = useLocalRows(items, COLUMNS, {
        groupBy: ["team"],
        rowKey,
        expandedGroupKeys: TEAM_KEYS,
    });
    return <Grid {...props} {...local.props} />;
}

/** A tree: 200 parents of 9 rows each, every parent expanded, through `useLocalRows`. */
const parents: Item[] = Array.from({ length: 200 }, (_, p) => ({
    ...(items[p * 10] as Item),
    children: items.slice(p * 10 + 1, p * 10 + 10),
}));
const PARENT_KEYS: readonly RowKey[] = parents.map(rowKey);
const getSubRows = (row: Item) => row.children;
function Tree(props: GridProps) {
    const local = useLocalRows(parents, COLUMNS, {
        getSubRows,
        rowKey,
        expandedGroupKeys: PARENT_KEYS,
    });
    return <Grid {...props} {...local.props} />;
}

interface Scrolls {
    /** the axes moved a few pixels at a time inside the rendered windows */
    axes: "x" | "y" | "both";
    /** right to left: `scrollLeft` is negative */
    rtl?: boolean;
    /** the commits a scroll past the rendered windows makes (default 1) */
    crossing?: number;
    /** a part the grid shows through the scrolls inside the windows (its selector) */
    shown?: string;
}

/**
 * Renders `ui`, scrolls into the middle (row 20, column 6) and a few pixels on, settling the
 * rendered windows there, then 15px at a time three times on `axes` (the visible ranges move
 * inside the rendered ones, the overscan): no commit; then far down and sideways: `crossing`
 * commits.
 */
async function expectNoRenderOnScroll(
    ui: ReactElement,
    { axes, rtl = false, crossing = 1, shown }: Scrolls,
) {
    const { container, commits, resetCommits } = renderCounting(ui);
    await act(async () => {});
    const viewport = root(container);
    const sign = rtl ? -1 : 1;
    const top = 400;
    const left = 600;
    for (const offset of [0, 5]) {
        scrollRoot(viewport, {
            top: top + offset,
            left: sign * (left + offset),
        });
        await act(async () => {});
    }
    resetCommits();
    for (let step = 1; step <= 3; step++) {
        scrollRoot(viewport, {
            ...(axes !== "x" ? { top: top + 5 + step * 15 } : {}),
            ...(axes !== "y" ? { left: sign * (left + 5 + step * 15) } : {}),
        });
    }
    expect(commits()).toBe(0);
    if (shown) expect(container.querySelector(shown)).not.toBeNull();
    scrollRoot(viewport, { top: top + 2_000, left: sign * (left + 1_500) });
    expect(commits()).toBe(crossing);
}

const RANGE = {
    anchor: { rowIndex: 22, columnIndex: 7 },
    focus: { rowIndex: 26, columnIndex: 9 },
};

describe("no React render on a scroll inside the rendered windows (D9)", () => {
    it("with no feature on", async () => {
        await expectNoRenderOnScroll(<Grid />, { axes: "both" });
    });

    it("with columns pinned at the start and at the end", async () => {
        const columns = COLUMNS.map((entry, i) =>
            i === 0
                ? { ...entry, pinned: "start" as const }
                : i === COLUMNS.length - 1
                  ? { ...entry, pinned: "end" as const }
                  : entry,
        );
        await expectNoRenderOnScroll(<Grid columns={columns} />, {
            axes: "both",
            shown: '[data-pinned="end"]',
        });
    });

    it("with column groups, one collapsible, and sticky labels", async () => {
        const [first, ...rest] = COLUMNS;
        const groups: ColumnOrGroup<Item>[] = [
            first as Column<Item>,
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
        await expectNoRenderOnScroll(<Grid columns={groups} />, {
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
                      }: Parameters<
                          NonNullable<Column<Item>["colSpan"]>
                      >[0]) =>
                          type === "row" &&
                          "rowIndex" in args &&
                          args.rowIndex % 2 === 0
                              ? 2
                              : undefined,
                  }
                : entry,
        );
        await expectNoRenderOnScroll(<Grid columns={columns} />, {
            axes: "both",
            shown: '[aria-colspan="2"]',
        });
    });

    it("with summary rows at the top and the bottom", async () => {
        await expectNoRenderOnScroll(
            <Grid summaryRows={{ top: 1, bottom: 1 }} summaryRowHeight={30} />,
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
            <Grid rowHeight={(rowIndex) => 20 + (rowIndex % 4) * 10} />,
            { axes: "both" },
        );
    });

    it("with expanded rows' details", async () => {
        await expectNoRenderOnScroll(
            <Grid defaultExpandedRowKeys={[21, 23]} detailHeight={60} />,
            { axes: "both", shown: '[data-grid-part="row-detail"]' },
        );
    });

    it("with row groups", async () => {
        await expectNoRenderOnScroll(<Grouped />, {
            axes: "both",
            // a group's rows, one level down
            shown: '[data-grid-part="row"][aria-level="2"]',
        });
    });

    it("with tree data", async () => {
        await expectNoRenderOnScroll(<Tree />, {
            axes: "both",
            shown: '[aria-expanded="true"]',
        });
    });

    it("with row selection", async () => {
        await expectNoRenderOnScroll(
            <Grid
                rowSelection="multiple"
                defaultSelectedRowKeys={[20, 21, 22, 25]}
            />,
            { axes: "both", shown: "[data-selected]" },
        );
    });

    it("with a cell range selected", async () => {
        await expectNoRenderOnScroll(
            <Grid
                cellSelection="range"
                defaultActivePosition={RANGE.anchor}
                defaultSelectedRange={RANGE}
            />,
            { axes: "both", shown: "[data-selected-cell]" },
        );
    });

    it("with the fill handle shown", async () => {
        await expectNoRenderOnScroll(
            <Grid
                fillHandle
                cellSelection="range"
                defaultActivePosition={RANGE.anchor}
                defaultSelectedRange={RANGE}
                onFill={() => {}}
            />,
            { axes: "both", shown: '[data-grid-part="fill-handle"]' },
        );
    });

    it("with an editor open", async () => {
        const columns = COLUMNS.map((entry) =>
            entry.key === "c6"
                ? {
                      ...entry,
                      editable: true,
                      renderEditCell: ({
                          value,
                          onChange,
                      }: {
                          value: unknown;
                          onChange: (value: unknown) => void;
                      }) => (
                          <input
                              aria-label="Edit"
                              value={String(value)}
                              onChange={(event) => onChange(event.target.value)}
                          />
                      ),
                  }
                : entry,
        );
        const at = { rowIndex: 24, columnIndex: 7 };
        await expectNoRenderOnScroll(
            <Grid
                columns={columns}
                defaultActivePosition={at}
                defaultEditingCell={at}
            />,
            { axes: "both", shown: "[data-editing] input" },
        );
    });

    it("right to left", async () => {
        const columns = COLUMNS.map((entry, i) =>
            i === 0 ? { ...entry, pinned: "start" as const } : entry,
        );
        await expectNoRenderOnScroll(
            <Grid columns={columns} direction="rtl" />,
            { axes: "both", rtl: true, shown: '[dir="rtl"]' },
        );
    });
});

describe("no React render on a scroll inside the rendered windows, measured heights (D9)", () => {
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
            <Grid
                rowHeight="auto"
                estimatedRowHeight={30}
                detailHeight="auto"
                estimatedDetailHeight={60}
                defaultExpandedRowKeys={[21, 23]}
            />,
            // the rows rendered for the first time are measured at the commit: a second one
            { axes: "both", crossing: 2 },
        );
    });

    it("with every feature at once", async () => {
        const [first, ...rest] = COLUMNS;
        const columns: ColumnOrGroup<Item>[] = [
            { ...(first as Column<Item>), pinned: "start" },
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
            { ...(rest.at(-1) as Column<Item>), pinned: "end" },
        ];
        await expectNoRenderOnScroll(
            <Grouped
                columns={columns}
                rowHeight="auto"
                estimatedRowHeight={30}
                summaryRows={{ top: 1, bottom: 1 }}
                rowSelection="multiple"
                cellSelection="range"
                defaultActivePosition={RANGE.anchor}
                defaultSelectedRange={RANGE}
                onFill={() => {}}
                fillHandle
                direction="rtl"
            />,
            // measured heights: the new rows' measures render again
            { axes: "both", rtl: true, crossing: 2 },
        );
    });
});
