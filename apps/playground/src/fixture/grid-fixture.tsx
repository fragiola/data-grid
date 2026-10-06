import { moveRow } from "@fragiola/data-grid/local";
import {
    type CellInfo,
    type ColSpanArgs,
    type Column,
    type ColumnOrder,
    type ColumnOrGroup,
    type ColumnWidths,
    DataGrid,
    type DataGridContextValue,
    type HeaderCellInfo,
    type HeaderRowInfo,
    headerCellContent,
    type RowKey,
    type RowMove,
    type SortColumn,
    useColumnResizer,
    useDataGrid,
    useDataGridRef,
    useGridView,
    useGroupLabel,
    useGroupToggle,
    useHeaderCell,
    useRowDragHandle,
} from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import {
    Profiler,
    type ReactElement,
    StrictMode,
    useCallback,
    useMemo,
    useState,
} from "react";
import { createRoot } from "react-dom/client";

// The unstyled grid Playwright drives (D5): the same grid as real table elements (`table`) or as
// divs (`div`), configured by the query string, so one spec runs against both.
//
//   ?rows=1000000        the row count (rows are computed from their index, nothing is stored);
//                        0 shows the empty state
//   &columns=1000        the column count (100px each)
//   &rowHeight=32        a row's height; &variable=1 makes it vary by index (24–48px); `auto`
//                        measures the rows (&estimate=35 until then): C1's cell holds 1 to 4
//                        lines by index (`lines(index)`), a block each
//   &maxScrollSize=…     the scroll scaling cap
//   &width=800&height=600 the viewport's size
//   &groups=1            column groups (two header rows): C0 spans both rows, then groups of 4
//                        and 12 columns in turn (a 12-column group is wider than the viewport)
//   &sort=1              C0 and C1 sortable (C1's header cell holds a button of its own), the
//                        sort uncontrolled
//   &pinned=2            the first N columns pinned at the start (with groups, 5 pins C0 and
//                        the first group); the two lines of CSS stacking needs are the fixture's
//   &pinnedEnd=2         the last N columns pinned at the end (with groups, a whole last group:
//                        3 of 20 columns, 7 of 60); with &resize=1 they resize, with &reorder=1
//                        they reorder (among themselves)
//   &dir=rtl             the grid right to left (its `direction`): the resizers and the drop
//                        indicator mirrored; &pageDir=rtl lays the page out right to left
//                        instead (`<html dir>`), the grid given no direction
//   &details=1           expandable rows: C0's cell holds an expander (`expand-<row>`); a
//                        detail (&detailHeight=200 tall) holds a grid of its own
//                        (`inner-<row>`, 30 rows × 8 columns) and a button (`detail-button-<row>`);
//                        `auto` measures them (&detailEstimate=300 until then), a block 0, 40 or
//                        80px tall by index (`detail-spacer-<row>`) after the button
//   &controls=1          controls in cells: C2 a button (`edit-<row>`) and a link
//                        (`open-<row>`), C3 a field (`field-<row>`) and a header button
//                        (`header-menu`), C4 of row 0 an app's own tab stop (`kept`)
//   &selection=multiple  selectable rows (or `single`), uncontrolled: C1's cell holds a checkbox
//                        (`select-<row>`, Shift+click extends); &locked=5 makes row 5 not
//                        selectable
//   &resize=1            C0–C3 resizable (C2 between 60 and 200px), C1's values wider than its
//                        minimum (a fit lands under its 100px), the widths uncontrolled: a
//                        resizable header cell (a group's too) holds a resizer (`resizer-<key>`)
//                        at its right edge, placed by the fixture's own CSS; `controlled`
//                        holds the widths in the fixture's state (`columnWidths` and
//                        `onColumnWidthsChange`); a button after the grid (`fit-all`) runs
//                        `fit-columns` through the grid's ref, as an app's would
//   &flex=1              C1 `flex: 1` and C2 `flex: 2`, at most 300px (over &resize=1's 200);
//                        the spec resizes the viewport through its style
//   &autosize=1          C3 `autoSize`, its values wider than its 100px
//   &reorder=1           C1–C5 reorderable (C0 too when pinned), and the groups with &groups=1,
//                        the order uncontrolled: a drop target is marked by the fixture's own
//                        CSS; `controlled` holds the order in the fixture's state
//                        (`columnOrder` and `onColumnOrderChange`)
//   &span=1              column spans: on every fifth row (index % 5 = 0), C1's cell spans 3
//                        columns (C1–C3) and the second to last column's asks for 5 (the last
//                        column and its part keep it to fewer); C5's header cell spans C5–C6
//   &collapsible=1       with &groups=1, the groups of 12 (G1, G3, …) collapsible: expanded,
//                        all but their last column; collapsed, their first and last (C5 and
//                        C16 for G1); their columns resizable. A group's header cell holds a
//                        toggle (`toggle-<key>`, `aria-expanded`), the collapsed groups
//                        uncontrolled
//   &stickyLabels=1      a group's name (and its toggle) in a label that stays in view while the
//                        group scrolls (`useGroupLabel`, `label-<key>`), a block as wide as its
//                        content
//   &summaryTop=1        summary rows under the header (and &summaryBottom=1 at the bottom
//                        edge): a cell shows `<position><index>:<column>` (`top0:3`); with
//                        &span=1, C1's spans C1–C2 on every summary row; with &controls=1, C2's
//                        holds a button (`summary-<position><index>`)
//   &rowReorder=1        the rows move: C0's cell holds a drag handle (`handle-<id>`, the id
//                        being the row's index before any move); the fixture keeps the rows'
//                        order in its state and applies each move (`moveRow`), keyed by id; a
//                        drop target is marked by the fixture's own CSS
//   &groupBy=1           the rows in memory (`useLocalRows`), grouped by C2 (`g<index % 5>`);
//                        2 groups by C2 then C3 (`h<index % 2>`): a group row's C0 cell holds
//                        its toggle (`group-toggle-<row>`, `useGroupToggle`) and `<value>
//                        (<count>)`, its C4 the sum of its rows' indexes (an aggregate), its C1
//                        a checkbox with &selection=multiple; keyed by index, the expanded
//                        groups uncontrolled
//
// For the spec: `window.grid` is the grid's model and engine, `window.commits` counts React
// commits of the grid (a Profiler), `window.sortChanges` the sorts reported,
// `window.selectionChanges` the selections, `window.widthChanges` the widths,
// `window.orderChanges` the column orders, `window.collapseChanges` the collapsed groups,
// `window.rowMoves` the rows moved, `window.groupChanges` the expanded row groups, and a button
// before and after the grid take Tab.

interface FixtureRow {
    index: number;
}

declare global {
    interface Window {
        grid?: DataGridContextValue<FixtureRow>;
        commits: number;
        sortChanges: (readonly SortColumn[])[];
        selectionChanges: (readonly RowKey[])[];
        widthChanges: ColumnWidths[];
        orderChanges: ColumnOrder[];
        collapseChanges: (readonly string[])[];
        rowMoves: RowMove[];
        groupChanges: (readonly RowKey[])[];
    }
}

function numberParam(params: URLSearchParams, name: string, fallback: number) {
    const value = Number(params.get(name));
    return params.has(name) && Number.isFinite(value) ? value : fallback;
}

function Expose() {
    window.grid = useDataGrid<FixtureRow>();
    return null;
}

const getRow = (index: number): FixtureRow => ({ index });

/** A row's key with `&rowReorder=1`: its id, the index it had first. */
const rowId = (row: FixtureRow) => row.index;

/** How many lines C1's cell holds with `&rowHeight=auto`: 1 to 4, by index. */
const lines = (index: number) => 1 + ((index * 7) % 4);

/** What `&rowHeight=auto` puts in C1's cell: its lines, a block each (the row grows with them). */
const linesColumn: Partial<Column<FixtureRow>> = {
    renderCell: ({ row }) =>
        Array.from(
            { length: lines(row.index) },
            (_, line) => `${row.index}:1 line ${line}`,
        ).map((text) => <div key={text}>{text}</div>),
};

/** What `&groupBy` aggregates: C4, the sum of a group's rows' indexes. */
const AGGREGATES = {
    c4: (rows: readonly FixtureRow[]) =>
        rows.reduce((total, row) => total + row.index, 0),
};

/** No rows in memory: the fixture's rows come from their index unless it groups them. */
const NO_ROWS: readonly FixtureRow[] = [];

/** A group row's toggle, as an app writes it: the hook's props on a button of its own. */
function GroupToggle({ cell }: { cell: CellInfo<FixtureRow> }) {
    const { state, props } = useGroupToggle(cell);
    if (!state.expandable) return null;
    return (
        <button
            type="button"
            {...props}
            data-testid={`group-toggle-${cell.rowIndex}`}
            aria-label={state.expanded ? "Collapse" : "Expand"}
        >
            {state.expanded ? "-" : "+"}
        </button>
    );
}

/** A group row's cell content: C0 its toggle and its value and count, C1 its checkbox. */
function groupCellContent(cell: CellInfo<FixtureRow>, selection: boolean) {
    const { group } = cell;
    if (!group) return undefined;
    if (cell.columnIndex === 0) {
        return (
            <>
                <GroupToggle cell={cell} /> {String(group.value)} (
                {group.childCount})
            </>
        );
    }
    return selection && cell.columnIndex === 1 ? (
        <SelectBox rowIndex={cell.rowIndex} />
    ) : undefined;
}

/** A row's drag handle, as an app writes it: the hook's props on an element of its own. */
function RowHandle({ cell }: { cell: CellInfo<FixtureRow> }) {
    const { props } = useRowDragHandle(cell);
    return (
        <span
            {...props}
            data-testid={`handle-${cell.row?.index}`}
            style={HANDLE_STYLE}
        >
            ≡
        </span>
    );
}

// a handle's look is the app's: a grip, with the browser's touch panning off
const HANDLE_STYLE = {
    cursor: "grab",
    touchAction: "none",
    userSelect: "none",
    padding: "0 4px",
} as const;

// the row's drop indicator is the app's: a line above or below its target
const ROW_DROP_CSS = `
[data-grid-part="row"][data-drop-target="before"] { box-shadow: inset 0 3px 0 green; }
[data-grid-part="row"][data-drop-target="after"] { box-shadow: inset 0 -3px 0 green; }
[data-grid-part="row"][data-dragging] { opacity: 0.6; }
`;

/** What `&controls=1` puts in a column's cells (and header): controls of every kind. */
function controlColumn(columnIndex: number): Partial<Column<FixtureRow>> {
    if (columnIndex === 2) {
        return {
            renderCell: ({ row }) => (
                <>
                    <button type="button" data-testid={`edit-${row.index}`}>
                        edit
                    </button>{" "}
                    <a
                        href={`#row-${row.index}`}
                        data-testid={`open-${row.index}`}
                    >
                        open
                    </a>
                </>
            ),
        };
    }
    if (columnIndex === 3) {
        return {
            renderHeaderCell: () => (
                <>
                    C3{" "}
                    <button type="button" data-testid="header-menu">
                        menu
                    </button>
                </>
            ),
            renderCell: ({ row }) => (
                <input
                    aria-label={`Field ${row.index}`}
                    data-testid={`field-${row.index}`}
                />
            ),
        };
    }
    if (columnIndex === 4) {
        return {
            renderCell: ({ row }) =>
                row.index === 0 ? (
                    <button
                        type="button"
                        data-testid="kept"
                        data-grid-tab-stop=""
                    >
                        kept
                    </button>
                ) : (
                    `${row.index}:4`
                ),
        };
    }
    return {};
}

/** A row's checkbox, as an app writes it: the grid's command, Shift+click extending. */
function SelectBox({ rowIndex }: { rowIndex: number }) {
    const { model } = useDataGrid<FixtureRow>();
    // the view moves with the selection: this re-renders
    useGridView();
    return (
        <input
            type="checkbox"
            data-testid={`select-${rowIndex}`}
            aria-label={`Select ${rowIndex}`}
            checked={model.is("row-selected", { rowIndex })}
            disabled={!model.is("row-selectable", { rowIndex })}
            readOnly
            onClick={(event) =>
                model.run("selected-rows.toggle", {
                    rowIndex,
                    extend: event.shiftKey,
                })
            }
        />
    );
}

const INNER_COLUMNS: Column<FixtureRow>[] = Array.from(
    { length: 8 },
    (_, columnIndex) => ({
        key: `i${columnIndex}`,
        name: `I${columnIndex}`,
        width: 120,
        getValue: (row) => `${row.index}.${columnIndex}`,
    }),
);

/** The expander of a row: a button in its first cell, as an app writes it (M3). */
function Expander({ rowIndex }: { rowIndex: number }) {
    const { model } = useDataGrid<FixtureRow>();
    return (
        <button
            type="button"
            data-testid={`expand-${rowIndex}`}
            aria-expanded={model.is("row-expanded", { rowIndex })}
            aria-label="Details"
            onClick={() => model.run("expanded-rows.toggle", { rowIndex })}
        >
            ±
        </button>
    );
}

const TABLE = {
    grid: <table />,
    header: <thead />,
    headerRow: <tr />,
    headerCell: <th />,
    body: <tbody />,
    row: <tr />,
    cell: <td />,
    detail: <td />,
    empty: <tbody />,
    summaryTop: <tbody />,
    summaryBottom: <tfoot />,
    summaryRow: <tr />,
    summaryCell: <td />,
};

/** The `render` element of each part: a table's, or none (the parts' own divs). */
function tags(table: boolean): Partial<typeof TABLE> {
    return table ? TABLE : {};
}

/** A grid of its own inside a detail (E4): its keys and its active cell are its own. */
function InnerGrid({ table, rowIndex }: { table: boolean; rowIndex: number }) {
    const tag = tags(table);
    return (
        <DataGrid.Root<FixtureRow>
            columns={INNER_COLUMNS}
            rowCount={30}
            getRow={getRow}
            rowHeight={24}
            headerRowHeight={24}
            data-testid={`inner-${rowIndex}`}
            style={{ width: 500, height: 150 }}
        >
            <DataGrid.Grid aria-label="Items" render={tag.grid}>
                <DataGrid.Header
                    render={tag.header}
                    style={{ background: "white", zIndex: 1 }}
                >
                    <HeaderRow table={table} />
                </DataGrid.Header>
                <DataGrid.Body render={tag.body}>
                    <DataGrid.Rows<FixtureRow>>
                        {(row) => (
                            <DataGrid.Row row={row} render={tag.row}>
                                <DataGrid.Cells<FixtureRow>>
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

/**
 * The columns under groups: C0 alone, then groups of 4 and 12 columns in turn (reorderable
 * with `reorderable`; the groups of 12 collapsible with `collapsible`: all but their last column
 * expanded, their first and last collapsed, every one resizable).
 */
function grouped(
    columns: Column<FixtureRow>[],
    reorderable: boolean,
    collapsible: boolean,
): ColumnOrGroup<FixtureRow>[] {
    const [first, ...rest] = columns;
    const entries: ColumnOrGroup<FixtureRow>[] = first ? [first] : [];
    for (let start = 0, group = 0; start < rest.length; group++) {
        const size = group % 2 === 0 ? 4 : 12;
        const children = rest.slice(start, start + size);
        const collapses = collapsible && group % 2 === 1;
        entries.push({
            key: `G${group}`,
            name: `G${group}`,
            children: collapses
                ? children.map((child, index) => ({
                      ...child,
                      resizable: true,
                      ...(index === 0
                          ? {}
                          : {
                                groupShow:
                                    index === children.length - 1
                                        ? ("collapsed" as const)
                                        : ("expanded" as const),
                            }),
                  }))
                : children,
            ...(reorderable ? { reorderable } : {}),
            ...(collapses ? { collapsible } : {}),
        });
        start += size;
    }
    return entries;
}

// A group's label is a block as wide as its content: sticky moves it inside its header cell
const LABEL_STYLE = { display: "block", width: "fit-content" } as const;

/**
 * A group's header content, as an app writes it: its name and, collapsible, its toggle (the
 * grid's command), in a label that stays in view with `sticky`.
 */
function GroupContent({
    cell,
    sticky,
}: {
    cell: HeaderCellInfo<FixtureRow>;
    sticky: boolean;
}) {
    const { model } = useDataGrid<FixtureRow>();
    const { state } = useHeaderCell(cell);
    const label = useGroupLabel(cell);
    const content = (
        <>
            {headerCellContent(cell)}
            {state.collapsed === undefined ? null : (
                <>
                    {" "}
                    <button
                        type="button"
                        data-testid={`toggle-${cell.key}`}
                        aria-expanded={!state.collapsed}
                        onClick={() =>
                            model.run("column-groups.toggle", {
                                groupKey: cell.key,
                            })
                        }
                    >
                        {state.collapsed ? "+" : "-"}
                    </button>
                </>
            )}
        </>
    );
    return sticky ? (
        <span
            {...label.props}
            data-testid={`label-${cell.key}`}
            style={{ ...label.props.style, ...LABEL_STYLE }}
        >
            {content}
        </span>
    ) : (
        content
    );
}

// The empty state's content, centred in it (the part's own display is structural: a block)
const EMPTY_ROW = { display: "block", height: "100%" } as const;
const EMPTY_CONTENT = {
    display: "grid",
    height: "100%",
    placeItems: "center",
} as const;

/**
 * Stacking is the consumer's (P4): pinned cells are opaque and above the cells that scroll under
 * them.
 */
function pinnedStyle(state: { pinned: boolean }) {
    return state.pinned ? { background: "white", zIndex: 1 } : undefined;
}

/** The limits `&resize=1` gives C0–C3 (C2 between 60 and 200px). */
function resizeColumn(columnIndex: number): Partial<Column<FixtureRow>> {
    if (columnIndex > 3) return {};
    return columnIndex === 2
        ? { resizable: true, minWidth: 60, maxWidth: 200 }
        : { resizable: true };
}

/** What `&flex=1` gives C1 and C2: a part and two, C2 at most 300px. */
function flexColumn(columnIndex: number): Partial<Column<FixtureRow>> {
    if (columnIndex === 1) return { flex: 1 };
    return columnIndex === 2 ? { flex: 2, maxWidth: 300 } : {};
}

/** Every fifth row: where `&span=1` spans its cells. */
const spansRow = (args: ColSpanArgs<FixtureRow>, span: number) =>
    args.type === "row" && args.row.index % 5 === 0 ? span : undefined;

/** What `&span=1` gives a column: C1 and the second to last column span rows, C5 its header. */
function spanColumn(
    columnIndex: number,
    columnCount: number,
): Partial<Column<FixtureRow>> {
    if (columnIndex === 1) return { colSpan: (args) => spansRow(args, 3) };
    if (columnIndex === columnCount - 2) {
        return { colSpan: (args) => spansRow(args, 5) };
    }
    return columnIndex === 5
        ? { colSpan: ({ type }) => (type === "header" ? 2 : undefined) }
        : {};
}

/**
 * What `&summaryTop`/`&summaryBottom` give a column: a summary cell's text (the app's own value,
 * as a total would be), C2's a button with `&controls=1`; with `&span=1`, C1's spans C1–C2.
 */
function summaryColumn(
    columnIndex: number,
    controls: boolean,
    span: boolean,
): Partial<Column<FixtureRow>> {
    return {
        renderSummaryCell: ({ position, summaryIndex }) =>
            controls && columnIndex === 2 ? (
                <button
                    type="button"
                    data-testid={`summary-${position}${summaryIndex}`}
                >
                    sum
                </button>
            ) : (
                `${position}${summaryIndex}:${columnIndex}`
            ),
        ...(span && columnIndex === 1
            ? {
                  colSpan: (args: ColSpanArgs<FixtureRow>) =>
                      args.type === "summary" ? 2 : spansRow(args, 3),
              }
            : {}),
    };
}

/**
 * A cell's value: C1's wider with `&resize=1`, C3's wider still with `&autosize=1`; with
 * `&groupBy`, C2's and C3's the values the rows are grouped by.
 */
function cellValue(
    columnIndex: number,
    resize: boolean,
    autoSize: boolean,
    grouping: boolean,
): (row: FixtureRow) => string {
    if (grouping && columnIndex === 2) return (row) => `g${row.index % 5}`;
    if (grouping && columnIndex === 3) return (row) => `h${row.index % 2}`;
    if (resize && columnIndex === 1) return (row) => `${row.index}:1 wide`;
    if (autoSize && columnIndex === 3) {
        return (row) => `${row.index}:3, a value wider than its column`;
    }
    return (row) => `${row.index}:${columnIndex}`;
}

/**
 * Whether `&reorder=1` makes a column reorderable: C1–C5, C0 when pinned, and the ones pinned at
 * the end.
 */
function reorderColumn(
    columnIndex: number,
    pinnedCount: number,
    pinnedEnd: boolean,
): boolean {
    return (
        pinnedEnd || (columnIndex <= 5 && (columnIndex > 0 || pinnedCount > 0))
    );
}

// The drop indicator is the app's (O4): a line on the target's side, from its attribute (its
// start: the right edge right to left)
const DROP_TARGET_CSS = `
[data-drop-target="before"] { box-shadow: inset 3px 0 0 blue; }
[data-drop-target="after"] { box-shadow: inset -3px 0 0 blue; }
[dir="rtl"] [data-drop-target="before"] { box-shadow: inset -3px 0 0 blue; }
[dir="rtl"] [data-drop-target="after"] { box-shadow: inset 3px 0 0 blue; }
`;

// A resizer's place is the app's (W3): a strip at its edge of its header cell (which is
// positioned, absolute or sticky): the end edge, the start one for a column pinned at the end
// (`state.edge`), logical sides so it mirrors right to left; the browser's touch panning off
const RESIZER_STYLE = {
    position: "absolute",
    top: 0,
    width: 6,
    height: "100%",
    touchAction: "none",
} as const;

/**
 * A header cell's resizer, as an app writes it: the hook's props on an element of its own; none
 * when no column under the cell resizes.
 */
function Resizer({ cell }: { cell: HeaderCellInfo<FixtureRow> }) {
    const { state, props } = useColumnResizer(cell);
    if (!state.resizable) return null;
    return (
        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the hook's props make it a separator (a focusable one, APG: not an <hr>)
        <div
            {...props}
            aria-label={`Resize ${cell.key}`}
            data-testid={`resizer-${cell.key}`}
            style={
                state.edge === "start"
                    ? { ...RESIZER_STYLE, insetInlineStart: 0 }
                    : { ...RESIZER_STYLE, insetInlineEnd: 0 }
            }
        />
    );
}

/** A header row of the fixture: `row` from `HeaderRows`, or the columns' row without one. */
function HeaderRow({
    table,
    row,
    resize = false,
    groupContent = false,
    stickyLabels = false,
}: {
    table: boolean;
    row?: HeaderRowInfo<FixtureRow> | undefined;
    resize?: boolean;
    /** a group's header cell holds its toggle, or its label (`GroupContent`) */
    groupContent?: boolean;
    stickyLabels?: boolean;
}) {
    const tag = tags(table);
    return (
        <DataGrid.HeaderRow row={row} render={tag.headerRow}>
            <DataGrid.HeaderCells<FixtureRow>>
                {(cell) => {
                    const own = groupContent && cell.group !== undefined;
                    return (
                        <DataGrid.HeaderCell
                            cell={cell}
                            render={tag.headerCell}
                            style={pinnedStyle}
                        >
                            {resize || own ? (
                                // its own content, then its resizer
                                <>
                                    {own ? (
                                        <GroupContent
                                            cell={cell}
                                            sticky={stickyLabels}
                                        />
                                    ) : (
                                        headerCellContent(cell)
                                    )}
                                    {resize ? <Resizer cell={cell} /> : null}
                                </>
                            ) : undefined}
                        </DataGrid.HeaderCell>
                    );
                }}
            </DataGrid.HeaderCells>
        </DataGrid.HeaderRow>
    );
}

/**
 * A position's summary rows, as an app writes them: after the header (top) or last (bottom),
 * opaque and above the rows that scroll under them; nothing while the grid has none there.
 */
function SummaryRows({
    position,
    table,
    render,
}: {
    position: "top" | "bottom";
    table: boolean;
    render: ReactElement | undefined;
}) {
    const tag = tags(table);
    return (
        <DataGrid.Summary
            position={position}
            render={render}
            style={{ background: "white", zIndex: 1 }}
        >
            <DataGrid.SummaryRows>
                {(row) => (
                    <DataGrid.SummaryRow row={row} render={tag.summaryRow}>
                        <DataGrid.SummaryCells<FixtureRow>>
                            {(cell) => (
                                <DataGrid.SummaryCell
                                    cell={cell}
                                    render={tag.summaryCell}
                                    style={pinnedStyle}
                                />
                            )}
                        </DataGrid.SummaryCells>
                    </DataGrid.SummaryRow>
                )}
            </DataGrid.SummaryRows>
        </DataGrid.Summary>
    );
}

function Fixture({ kind }: { kind: "table" | "div" }) {
    const params = new URLSearchParams(location.search);
    const rowCount = numberParam(params, "rows", 1_000);
    const columnCount = numberParam(params, "columns", 20);
    const fixedHeight = numberParam(params, "rowHeight", 32);
    const autoRows = params.get("rowHeight") === "auto";
    const estimate = numberParam(params, "estimate", 35);
    const variable = params.get("variable") === "1";
    const maxScrollSize = params.has("maxScrollSize")
        ? numberParam(params, "maxScrollSize", 10_000_000)
        : undefined;
    const groups = params.get("groups") === "1";
    const sort = params.get("sort") === "1";
    const pinnedCount = numberParam(params, "pinned", 0);
    const pinnedEndCount = numberParam(params, "pinnedEnd", 0);
    const rtl = params.get("dir") === "rtl";
    const details = params.get("details") === "1";
    const controls = params.get("controls") === "1";
    const resizeParam = params.get("resize");
    const resize = resizeParam === "1" || resizeParam === "controlled";
    const controlledWidths = resizeParam === "controlled";
    const [columnWidths, setColumnWidths] = useState<ColumnWidths>({});
    const gridRef = useDataGridRef<FixtureRow>();
    const flex = params.get("flex") === "1";
    const autoSize = params.get("autosize") === "1";
    const span = params.get("span") === "1";
    const collapsible = params.get("collapsible") === "1";
    const stickyLabels = params.get("stickyLabels") === "1";
    const summaryTop = numberParam(params, "summaryTop", 0);
    const summaryBottom = numberParam(params, "summaryBottom", 0);
    const summary = summaryTop + summaryBottom > 0;
    const rowReorder = params.get("rowReorder") === "1";
    const groupByParam = numberParam(params, "groupBy", 0);
    const grouping = groupByParam > 0;
    // the rows' order, by id (the index each row had first): the app's, moved on each move
    const [rowOrder, setRowOrder] = useState<readonly number[]>(() =>
        rowReorder ? Array.from({ length: rowCount }, (_, index) => index) : [],
    );
    const getOrderedRow = useCallback(
        (index: number): FixtureRow => ({ index: rowOrder[index] ?? index }),
        [rowOrder],
    );
    const reorderParam = params.get("reorder");
    const reorder = reorderParam === "1" || reorderParam === "controlled";
    const controlledOrder = reorderParam === "controlled";
    const [columnOrder, setColumnOrder] = useState<ColumnOrder>([]);
    const selectionParam = params.get("selection");
    const rowSelection =
        selectionParam === "single" || selectionParam === "multiple"
            ? selectionParam
            : undefined;
    const locked = numberParam(params, "locked", -1);
    const isRowSelectable = useMemo(
        () =>
            locked >= 0 ? (row: FixtureRow) => row.index !== locked : undefined,
        [locked],
    );
    const autoDetails = params.get("detailHeight") === "auto";
    const detailHeight = autoDetails
        ? ("auto" as const)
        : numberParam(params, "detailHeight", 200);
    const detailEstimate = numberParam(params, "detailEstimate", 300);
    const width = numberParam(params, "width", 800);
    const height = numberParam(params, "height", 600);

    const columns = useMemo<ColumnOrGroup<FixtureRow>[]>(() => {
        const leaves = Array.from(
            { length: columnCount },
            (_, columnIndex): Column<FixtureRow> => {
                const pinnedEnd = columnIndex >= columnCount - pinnedEndCount;
                return {
                    key: `c${columnIndex}`,
                    name: `C${columnIndex}`,
                    width: 100,
                    getValue: cellValue(
                        columnIndex,
                        resize,
                        autoSize,
                        grouping,
                    ),
                    ...(sort && columnIndex < 2 ? { sortable: true } : {}),
                    ...(columnIndex < pinnedCount
                        ? { pinned: "start" as const }
                        : {}),
                    ...(pinnedEnd ? { pinned: "end" as const } : {}),
                    ...(controls ? controlColumn(columnIndex) : {}),
                    ...(resize ? resizeColumn(columnIndex) : {}),
                    ...(resize && pinnedEnd ? { resizable: true } : {}),
                    ...(flex ? flexColumn(columnIndex) : {}),
                    ...(autoSize && columnIndex === 3 ? { autoSize } : {}),
                    ...(span ? spanColumn(columnIndex, columnCount) : {}),
                    ...(summary
                        ? summaryColumn(columnIndex, controls, span)
                        : {}),
                    ...(autoRows && columnIndex === 1 ? linesColumn : {}),
                    ...(reorder &&
                    reorderColumn(columnIndex, pinnedCount, pinnedEnd)
                        ? { reorderable: true }
                        : {}),
                    ...(rowSelection && columnIndex === 1
                        ? {
                              renderCell: ({ rowIndex }) => (
                                  <SelectBox rowIndex={rowIndex} />
                              ),
                          }
                        : {}),
                    ...(sort && columnIndex === 1
                        ? {
                              renderHeaderCell: () => (
                                  <>
                                      C1{" "}
                                      <button type="button" data-testid="menu">
                                          menu
                                      </button>
                                  </>
                              ),
                          }
                        : {}),
                };
            },
        );
        return groups ? grouped(leaves, reorder, collapsible) : leaves;
    }, [
        columnCount,
        groups,
        sort,
        pinnedCount,
        pinnedEndCount,
        controls,
        flex,
        resize,
        autoSize,
        span,
        reorder,
        collapsible,
        rowSelection,
        summary,
        autoRows,
        grouping,
    ]);
    // `&groupBy`: the rows in memory, grouped by the pipeline
    const groupBy = useMemo(
        () => (grouping ? ["c2", "c3"].slice(0, groupByParam) : []),
        [grouping, groupByParam],
    );
    const memoryRows = useMemo(
        () =>
            grouping
                ? Array.from({ length: rowCount }, (_, index) => ({ index }))
                : NO_ROWS,
        [grouping, rowCount],
    );
    const local = useLocalRows(memoryRows, columns, {
        groupBy,
        aggregates: AGGREGATES,
        rowKey: rowId,
        onExpandedGroupKeysChange: (keys) => window.groupChanges.push(keys),
    });
    const groupedProps =
        grouping && local.props.rows === undefined ? local.props : undefined;
    const rowHeight = useMemo(
        () =>
            autoRows
                ? ("auto" as const)
                : variable
                  ? (index: number) => 24 + ((index * 7) % 25)
                  : fixedHeight,
        [autoRows, variable, fixedHeight],
    );
    const table = kind === "table";
    const tag = tags(table);

    return (
        <>
            {reorder ? <style>{DROP_TARGET_CSS}</style> : null}
            {rowReorder ? <style>{ROW_DROP_CSS}</style> : null}
            <button type="button" data-testid="before">
                before
            </button>
            <Profiler
                id="grid"
                onRender={() => {
                    window.commits += 1;
                }}
            >
                <DataGrid.Root<FixtureRow>
                    columns={columns}
                    {...(groupedProps ?? {
                        rowCount,
                        getRow: rowReorder ? getOrderedRow : getRow,
                        rowKey: rowReorder ? rowId : undefined,
                    })}
                    onRowMove={
                        rowReorder
                            ? (move) => {
                                  window.rowMoves.push(move);
                                  setRowOrder((order) =>
                                      moveRow(
                                          order,
                                          move.fromIndex,
                                          move.toIndex,
                                      ),
                                  );
                              }
                            : undefined
                    }
                    rowHeight={rowHeight}
                    estimatedRowHeight={autoRows ? estimate : undefined}
                    summaryRows={
                        summary
                            ? { top: summaryTop, bottom: summaryBottom }
                            : undefined
                    }
                    detailHeight={details ? detailHeight : undefined}
                    estimatedDetailHeight={
                        autoDetails ? detailEstimate : undefined
                    }
                    maxScrollSize={maxScrollSize}
                    onSortColumnsChange={(sortColumns) => {
                        window.sortChanges.push(sortColumns);
                        // grouped, the pipeline sorts the rows (inside their groups)
                        groupedProps?.onSortColumnsChange(sortColumns);
                    }}
                    rowSelection={rowSelection}
                    isRowSelectable={isRowSelectable}
                    onSelectedRowKeysChange={(keys) =>
                        window.selectionChanges.push(keys)
                    }
                    columnWidths={controlledWidths ? columnWidths : undefined}
                    onColumnWidthsChange={(widths) => {
                        window.widthChanges.push(widths);
                        if (controlledWidths) setColumnWidths(widths);
                    }}
                    columnOrder={controlledOrder ? columnOrder : undefined}
                    onColumnOrderChange={(order) => {
                        window.orderChanges.push(order);
                        if (controlledOrder) setColumnOrder(order);
                    }}
                    onCollapsedGroupKeysChange={(keys) =>
                        window.collapseChanges.push(keys)
                    }
                    gridRef={gridRef}
                    direction={rtl ? "rtl" : undefined}
                    data-testid="viewport"
                    style={{ width, height }}
                >
                    <Expose />
                    <DataGrid.Grid aria-label="Fixture" render={tag.grid}>
                        <DataGrid.Header
                            render={tag.header}
                            style={{ background: "white", zIndex: 1 }}
                        >
                            {groups ? (
                                // a header row per level
                                <DataGrid.HeaderRows<FixtureRow>>
                                    {(row) => (
                                        <HeaderRow
                                            table={table}
                                            row={row}
                                            resize={resize}
                                            groupContent={
                                                collapsible || stickyLabels
                                            }
                                            stickyLabels={stickyLabels}
                                        />
                                    )}
                                </DataGrid.HeaderRows>
                            ) : (
                                // without groups, the single header row (the markup most grids use)
                                <HeaderRow table={table} resize={resize} />
                            )}
                        </DataGrid.Header>
                        <SummaryRows
                            position="top"
                            table={table}
                            render={tag.summaryTop}
                        />
                        <DataGrid.Body render={tag.body}>
                            <DataGrid.Rows<FixtureRow>>
                                {(row) => (
                                    <DataGrid.Row row={row} render={tag.row}>
                                        <DataGrid.Cells<FixtureRow>>
                                            {(cell) => (
                                                <DataGrid.Cell
                                                    cell={cell}
                                                    render={tag.cell}
                                                    style={pinnedStyle}
                                                >
                                                    {cell.group ? (
                                                        groupCellContent(
                                                            cell,
                                                            rowSelection ===
                                                                "multiple",
                                                        )
                                                    ) : (details ||
                                                          rowReorder) &&
                                                      cell.columnIndex === 0 ? (
                                                        <>
                                                            {rowReorder &&
                                                            cell.loaded ? (
                                                                <RowHandle
                                                                    cell={cell}
                                                                />
                                                            ) : null}
                                                            {String(cell.value)}
                                                            {details ? (
                                                                <>
                                                                    {" "}
                                                                    <Expander
                                                                        rowIndex={
                                                                            cell.rowIndex
                                                                        }
                                                                    />
                                                                </>
                                                            ) : null}
                                                        </>
                                                    ) : undefined}
                                                </DataGrid.Cell>
                                            )}
                                        </DataGrid.Cells>
                                        {details ? (
                                            <DataGrid.RowDetail
                                                render={tag.detail}
                                                style={{ background: "white" }}
                                            >
                                                <InnerGrid
                                                    table={table}
                                                    rowIndex={row.rowIndex}
                                                />
                                                <button
                                                    type="button"
                                                    data-testid={`detail-button-${row.rowIndex}`}
                                                >
                                                    detail
                                                </button>
                                                {autoDetails ? (
                                                    <div
                                                        data-testid={`detail-spacer-${row.rowIndex}`}
                                                        style={{
                                                            height:
                                                                (row.rowIndex %
                                                                    3) *
                                                                40,
                                                        }}
                                                    />
                                                ) : null}
                                            </DataGrid.RowDetail>
                                        ) : null}
                                    </DataGrid.Row>
                                )}
                            </DataGrid.Rows>
                        </DataGrid.Body>
                        <DataGrid.Empty render={tag.empty}>
                            {table ? (
                                <tr style={EMPTY_ROW}>
                                    <td style={EMPTY_CONTENT}>No rows</td>
                                </tr>
                            ) : (
                                // biome-ignore lint/a11y/useSemanticElements lint/a11y/useFocusableInteractive: a div grid's row, the grid owns focus
                                <div role="row" style={EMPTY_ROW}>
                                    {/* biome-ignore lint/a11y/useSemanticElements lint/a11y/useFocusableInteractive: a div grid's cell, the grid owns focus */}
                                    <div role="gridcell" style={EMPTY_CONTENT}>
                                        No rows
                                    </div>
                                </div>
                            )}
                        </DataGrid.Empty>
                        <SummaryRows
                            position="bottom"
                            table={table}
                            render={tag.summaryBottom}
                        />
                    </DataGrid.Grid>
                </DataGrid.Root>
            </Profiler>
            <button type="button" data-testid="after">
                after
            </button>
            {resize ? (
                <button
                    type="button"
                    data-testid="fit-all"
                    onClick={() =>
                        gridRef.current?.engine.run("fit-columns", {})
                    }
                >
                    fit all
                </button>
            ) : null}
        </>
    );
}

export function mountGridFixture(kind: "table" | "div") {
    // a page laid out right to left: the grid, given no direction, takes it
    if (new URLSearchParams(location.search).get("pageDir") === "rtl") {
        document.documentElement.dir = "rtl";
    }
    window.commits = 0;
    window.sortChanges = [];
    window.selectionChanges = [];
    window.widthChanges = [];
    window.orderChanges = [];
    window.collapseChanges = [];
    window.rowMoves = [];
    window.groupChanges = [];
    const root = document.getElementById("root");
    if (!root) throw new Error("#root is missing");
    createRoot(root).render(
        <StrictMode>
            <Fixture kind={kind} />
        </StrictMode>,
    );
}
