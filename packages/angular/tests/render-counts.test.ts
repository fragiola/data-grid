import {
    ChangeDetectionStrategy,
    Component,
    Directive,
    input,
    type Type,
} from "@angular/core";
import type { ComponentFixture } from "@angular/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    DataGridLocalRows,
    groupKeyOf,
    injectLocalRows,
} from "../src/local/index";
import {
    type Column,
    type ColumnOrGroup,
    DATA_GRID,
    type DataGridNode,
    type RowKey,
} from "../src/public-api";
import { type TestProps, TestRootProps } from "./grid";
import {
    render,
    rendered,
    renders,
    rendersOf,
    resetRenders,
    root,
    scrollRoot,
    settled,
    stubViewportSize,
} from "./helpers";

// D9 across features (Epic #89, E5.3, for Angular): a scroll that keeps the rendered windows renders
// no template at all, whichever feature is on (the engine writes the layers' offsets and the sticky
// insets itself), and adds or removes no DOM node; a scroll past them renders the parts the new
// windows hold, a bounded number of times. Each grid holds 2,000 rows and 40 columns, scrolled into
// the middle first, then moved a few pixels at a time on the axes the feature lives on.
//
// React counts commits with a Profiler, Vue component renders; Angular counts template renders:
// every template of the grid (the component's own, each header row and cell, group label, summary
// row and cell, row, cell, detail, fill handle and editor) calls `rendered(name)` in a binding, so
// each change detection pass over its view counts once. Inside the windows: 0 renders of any
// template (React's 0 commits). Past them: React's `crossing` commits (1, or 2 with measured
// heights) is, in Angular, some renders, cells among them (the window changed), each cell at most
// `crossing` times for its own passes plus once per refresh of the component's view (see the
// TODO below): the cell template renders at most that × the cell elements the DOM held during the
// crossing (created or checked once a pass).

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

type ItemColumn = Column<Item, DataGridNode>;

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

/** What the grid renders besides its props: the fill handle, an editor. */
interface Parts {
    /** a fill handle in every cell (`*dataGridFillHandle`, shown in the one that has it) */
    readonly fillHandle?: boolean;
    /** an editor in every cell (`*dataGridCellEdit`, shown in the edited one) */
    readonly editor?: boolean;
}

// Every part rendered: the header with group labels, summary rows, cells, details; every template
// counts its renders. `LOCAL` is the root's local rows, for the grouped grids.
const body = `
    {{ rendered("component") }}
    <div dataGridGrid>
        <div *dataGridHeader>
            <ng-template dataGridHeaderRows let-row>
                <div [dataGridHeaderRow]="row">
                    {{ rendered("header-row") }}
                    <ng-template dataGridHeaderCells let-cell>
                        <div [dataGridHeaderCell]="cell">
                            {{ rendered("header-cell") }}
                            @if (cell.group) {
                                <span [dataGridGroupLabel]="cell">{{ rendered("group-label") }}{{ cell.group.name }}</span>
                            } @else {
                                <ng-container *dataGridCellContent />
                            }
                        </div>
                    </ng-template>
                </div>
            </ng-template>
        </div>
        <div *dataGridSummary="'top'">
            <ng-template dataGridSummaryRows let-row>
                <div [dataGridSummaryRow]="row">
                    {{ rendered("summary-row") }}
                    <ng-template dataGridSummaryCells let-cell>
                        <div [dataGridSummaryCell]="cell">{{ rendered("summary-cell") }}<ng-container *dataGridCellContent /></div>
                    </ng-template>
                </div>
            </ng-template>
        </div>
        <div dataGridBody>
            <ng-template [dataGridRows]="typed" let-row>
                <div [dataGridRow]="row">
                    {{ rendered("row") }}
                    <ng-template dataGridCells let-cell>
                        <div [dataGridCell]="cell">
                            {{ rendered("cell") }}
                            <ng-container *dataGridCellContent />
                            @if (parts().fillHandle) {
                                <span *dataGridFillHandle="cell">{{ rendered("fill-handle") }}</span>
                            }
                            @if (parts().editor) {
                                <input *dataGridCellEdit="let edit" aria-label="Edit"
                                    [value]="text(edit.value)" (input)="edit.onChange(valueOf($event))"
                                    [attr.data-renders]="rendered('editor') || null" />
                            }
                        </div>
                    </ng-template>
                    <div *dataGridRowDetail>{{ rendered("detail") }}<p>{{ row.row?.id }}</p></div>
                </div>
            </ng-template>
        </div>
        <div *dataGridSummary="'bottom'">
            <ng-template dataGridSummaryRows let-row>
                <div [dataGridSummaryRow]="row">
                    {{ rendered("summary-row") }}
                    <ng-template dataGridSummaryCells let-cell>
                        <div [dataGridSummaryCell]="cell">{{ rendered("summary-cell") }}<ng-container *dataGridCellContent /></div>
                    </ng-template>
                </div>
            </ng-template>
        </div>
    </div>
`;

/** What every grid component holds: its props (whole, the core's root props), its parts. */
@Directive()
abstract class Counted {
    readonly props = input.required<TestProps<unknown>>();
    readonly parts = input<Parts>({});
    protected readonly rendered = rendered;
    /** types the rows' template by the row type */
    protected readonly typed = COLUMNS;
    protected text(value: unknown) {
        return String(value ?? "");
    }
    protected valueOf(event: Event) {
        return event.target instanceof HTMLInputElement
            ? event.target.value
            : "";
    }
}

@Component({
    imports: [DATA_GRID, TestRootProps],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div dataGridRoot [columns]="props().columns" [testProps]="props()">${body}</div>`,
})
class PlainGrid extends Counted {}

/** Rows grouped by team, every group expanded, through `injectLocalRows`. */
const TEAM_KEYS: readonly RowKey[] = TEAMS.map((team) =>
    groupKeyOf([["team", team]]),
);

@Component({
    imports: [DATA_GRID, TestRootProps, DataGridLocalRows],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div dataGridRoot [columns]="props().columns" [testProps]="props()" [dataGridLocalRows]="local">${body}</div>`,
})
class GroupedGrid extends Counted {
    protected readonly local = injectLocalRows(items, COLUMNS, {
        groupBy: ["team"],
        rowKey,
        expandedGroupKeys: TEAM_KEYS,
    });
}

/** A tree: 200 parents of 9 rows each, every parent expanded, through `injectLocalRows`. */
const parents: Item[] = Array.from({ length: 200 }, (_, p) => ({
    id: p * 10,
    team: items[p * 10]?.team ?? "A",
    children: items.slice(p * 10 + 1, p * 10 + 10),
}));
const PARENT_KEYS: readonly RowKey[] = parents.map(rowKey);
const getSubRows = (row: Item) => row.children;

@Component({
    imports: [DATA_GRID, TestRootProps, DataGridLocalRows],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div dataGridRoot [columns]="props().columns" [testProps]="props()" [dataGridLocalRows]="local">${body}</div>`,
})
class TreeGrid extends Counted {
    protected readonly local = injectLocalRows(parents, COLUMNS, {
        getSubRows,
        rowKey,
        expandedGroupKeys: PARENT_KEYS,
    });
}

/** A grid's props: the root's but its rows (the items, or the local rows'), `COLUMNS` unless given. */
type GridProps = Omit<
    TestProps<Item>,
    "columns" | "rows" | "rowCount" | "getRow"
> & {
    columns?: readonly ColumnOrGroup<Item, DataGridNode>[];
};

interface Ui {
    /** the grid component: plain (`rows` the items), grouped or a tree (the local rows') */
    readonly grid: Type<Counted>;
    readonly props?: GridProps;
    readonly parts?: Parts;
}

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

const CELL = '[data-grid-part="cell"]';

/**
 * Renders the grid, scrolls into the middle (row 20, column 6) and a few pixels on, settling the
 * rendered windows there, then 15px at a time three times on `axes` (the visible ranges move
 * inside the rendered ones, the overscan): no template renders and no node is added or removed;
 * then far down and sideways: the new windows' parts render, cells at most `crossing` times each.
 */
async function expectNoRenderOnScroll(
    { grid, props = {}, parts = {} }: Ui,
    { axes, rtl = false, crossing = 1, shown }: Scrolls,
) {
    const base = {
        columns: COLUMNS,
        rowKey,
        rowHeight: 20,
        ...props,
    };
    const given: TestProps<Item> =
        grid === PlainGrid ? { ...base, rows: items } : base;
    let fixture: ComponentFixture<Counted> | undefined;
    const { container } = await render(grid, (created) => {
        fixture = created;
        created.componentRef.setInput("props", given);
        created.componentRef.setInput("parts", parts);
    });
    // the grid rendered its parts: the counts below are worth something
    expect(rendersOf("cell")).toBeGreaterThan(0);
    expect(rendersOf("header-cell")).toBeGreaterThan(0);
    const viewport = root(container);
    const sign = rtl ? -1 : 1;
    const top = 400;
    const left = 600;
    for (const offset of [0, 5]) {
        scrollRoot(viewport, {
            top: top + offset,
            left: sign * (left + offset),
        });
        await settled(fixture);
    }
    resetRenders();
    // no node added or removed inside the windows (the engine writes styles only)
    const moved: MutationRecord[] = [];
    const watch = new MutationObserver((records) => moved.push(...records));
    watch.observe(container, { childList: true, subtree: true });
    const before = container.querySelectorAll(CELL).length;
    for (let step = 1; step <= 3; step++) {
        scrollRoot(viewport, {
            ...(axes !== "x" ? { top: top + 5 + step * 15 } : {}),
            ...(axes !== "y" ? { left: sign * (left + 5 + step * 15) } : {}),
        });
        await settled(fixture);
    }
    moved.push(...watch.takeRecords());
    watch.disconnect();
    expect(rendersOf("cell")).toBe(0);
    expect(
        Object.fromEntries(RENDERED.map((name) => [name, rendersOf(name)])),
    ).toEqual(Object.fromEntries(RENDERED.map((name) => [name, 0])));
    expect(renders()).toBe(0);
    expect(moved).toHaveLength(0);
    expect(container.querySelectorAll(CELL)).toHaveLength(before);
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
    await settled(fixture);
    collect(observer.takeRecords());
    observer.disconnect();
    for (const cell of container.querySelectorAll(CELL)) cells.add(cell);
    expect(rendersOf("cell")).toBeGreaterThan(0);
    // TODO(angular): React's and Vue's bound is `crossing` renders per cell. In Angular an embedded
    // view has no reactive consumer of its own (its component's is used): a template context that
    // changes (the header row's, whose cells follow the column window) refreshes the component's
    // whole view, so every cell once more. The bound here is the cell's own passes plus one per
    // refresh of the component, and the component refreshes at most `crossing + 1` times.
    const refreshes = rendersOf("component");
    expect(refreshes).toBeLessThanOrEqual(crossing + 1);
    expect(rendersOf("cell")).toBeLessThanOrEqual(
        (crossing + refreshes) * cells.size,
    );
}

/** The templates that count their renders. */
const RENDERED = [
    "component",
    "header-row",
    "header-cell",
    "group-label",
    "summary-row",
    "summary-cell",
    "row",
    "cell",
    "fill-handle",
    "editor",
    "detail",
];

const RANGE = {
    anchor: { rowIndex: 22, columnIndex: 7 },
    focus: { rowIndex: 26, columnIndex: 9 },
};

describe("no Angular render on a scroll inside the rendered windows (D9)", () => {
    it("with no feature on", async () => {
        await expectNoRenderOnScroll({ grid: PlainGrid }, { axes: "both" });
    });

    it("with columns pinned at the start and at the end", async () => {
        const columns = COLUMNS.map((entry, i) =>
            i === 0
                ? { ...entry, pinned: "start" as const }
                : i === COLUMNS.length - 1
                  ? { ...entry, pinned: "end" as const }
                  : entry,
        );
        await expectNoRenderOnScroll(
            { grid: PlainGrid, props: { columns } },
            { axes: "both", shown: '[data-pinned="end"]' },
        );
    });

    it("with column groups, one collapsible, and sticky labels", async () => {
        const [first, ...rest] = COLUMNS;
        const groups: ColumnOrGroup<Item, DataGridNode>[] = [
            ...(first ? [first] : []),
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
        await expectNoRenderOnScroll(
            { grid: PlainGrid, props: { columns: groups } },
            { axes: "both", shown: '[data-grid-part="group-label"]' },
        );
    });

    it("with column spans", async () => {
        const columns = COLUMNS.map(
            (entry, i): ItemColumn =>
                i % 3 === 1
                    ? {
                          ...entry,
                          colSpan: (args) =>
                              args.type === "row" && args.rowIndex % 2 === 0
                                  ? 2
                                  : undefined,
                      }
                    : entry,
        );
        await expectNoRenderOnScroll(
            { grid: PlainGrid, props: { columns } },
            { axes: "both", shown: '[aria-colspan="2"]' },
        );
    });

    it("with summary rows at the top and the bottom", async () => {
        await expectNoRenderOnScroll(
            {
                grid: PlainGrid,
                props: {
                    summaryRows: { top: 1, bottom: 1 },
                    summaryRowHeight: 30,
                },
            },
            { axes: "both", shown: '[data-grid-part="summary-row"]' },
        );
    });

    it("with row heights of a function", async () => {
        // heights that vary: fewer rows in view than at the last window keep the rendered range
        // (a scroll changes no size: `windowFor`'s `scrolled`)
        await expectNoRenderOnScroll(
            {
                grid: PlainGrid,
                props: { rowHeight: (rowIndex) => 20 + (rowIndex % 4) * 10 },
            },
            { axes: "both" },
        );
    });

    it("with expanded rows' details", async () => {
        await expectNoRenderOnScroll(
            {
                grid: PlainGrid,
                props: { defaultExpandedRowKeys: [21, 23], detailHeight: 60 },
            },
            { axes: "both", shown: '[data-grid-part="row-detail"]' },
        );
    });

    it("with row groups", async () => {
        await expectNoRenderOnScroll(
            { grid: GroupedGrid },
            {
                axes: "both",
                // a group's rows, one level down
                shown: '[data-grid-part="row"][aria-level="2"]',
            },
        );
    });

    it("with tree data", async () => {
        await expectNoRenderOnScroll(
            { grid: TreeGrid },
            { axes: "both", shown: '[aria-expanded="true"]' },
        );
    });

    it("with row selection", async () => {
        await expectNoRenderOnScroll(
            {
                grid: PlainGrid,
                props: {
                    rowSelection: "multiple",
                    defaultSelectedRowKeys: [20, 21, 22, 25],
                },
            },
            { axes: "both", shown: "[data-selected]" },
        );
    });

    it("with a cell range selected", async () => {
        await expectNoRenderOnScroll(
            {
                grid: PlainGrid,
                props: {
                    cellSelection: "range",
                    defaultActivePosition: RANGE.anchor,
                    defaultSelectedRange: RANGE,
                },
            },
            { axes: "both", shown: "[data-selected-cell]" },
        );
    });

    it("with the fill handle shown", async () => {
        await expectNoRenderOnScroll(
            {
                grid: PlainGrid,
                parts: { fillHandle: true },
                props: {
                    cellSelection: "range",
                    defaultActivePosition: RANGE.anchor,
                    defaultSelectedRange: RANGE,
                    onFill: () => {},
                },
            },
            { axes: "both", shown: '[data-grid-part="fill-handle"]' },
        );
    });

    it("with an editor open", async () => {
        // the Angular editor: `*dataGridCellEdit` in the cell (React's and Vue's `renderEditCell`)
        const columns = COLUMNS.map(
            (entry): ItemColumn =>
                entry.key === "c6" ? { ...entry, editable: true } : entry,
        );
        const at = { rowIndex: 24, columnIndex: 7 };
        await expectNoRenderOnScroll(
            {
                grid: PlainGrid,
                parts: { editor: true },
                props: {
                    columns,
                    defaultActivePosition: at,
                    defaultEditingCell: at,
                },
            },
            { axes: "both", shown: "[data-editing] input" },
        );
    });

    it("right to left", async () => {
        const columns = COLUMNS.map((entry, i) =>
            i === 0 ? { ...entry, pinned: "start" as const } : entry,
        );
        await expectNoRenderOnScroll(
            { grid: PlainGrid, props: { columns, direction: "rtl" } },
            { axes: "both", rtl: true, shown: '[dir="rtl"]' },
        );
    });
});

describe("no Angular render on a scroll inside the rendered windows, measured heights (D9)", () => {
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
            {
                grid: PlainGrid,
                props: {
                    rowHeight: "auto",
                    estimatedRowHeight: 30,
                    detailHeight: "auto",
                    estimatedDetailHeight: 60,
                    defaultExpandedRowKeys: [21, 23],
                },
            },
            // the rows rendered for the first time are measured after the render: a second pass
            { axes: "both", crossing: 2 },
        );
    });

    it("with every feature at once", async () => {
        const [first, ...rest] = COLUMNS;
        const last = rest.at(-1);
        const columns: ColumnOrGroup<Item, DataGridNode>[] = [
            ...(first ? [{ ...first, pinned: "start" as const }] : []),
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
            ...(last ? [{ ...last, pinned: "end" as const }] : []),
        ];
        await expectNoRenderOnScroll(
            {
                grid: GroupedGrid,
                parts: { fillHandle: true },
                props: {
                    columns,
                    rowHeight: "auto",
                    estimatedRowHeight: 30,
                    summaryRows: { top: 1, bottom: 1 },
                    rowSelection: "multiple",
                    cellSelection: "range",
                    defaultActivePosition: RANGE.anchor,
                    defaultSelectedRange: RANGE,
                    onFill: () => {},
                    direction: "rtl",
                },
            },
            // measured heights: the new rows' measures render again
            { axes: "both", rtl: true, crossing: 2 },
        );
    });
});
