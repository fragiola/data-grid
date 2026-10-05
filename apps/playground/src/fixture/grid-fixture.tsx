import {
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
    type SortColumn,
    useColumnResizer,
    useDataGrid,
    useDataGridRef,
    useGridView,
} from "@fragiola/data-grid-react";
import { Profiler, StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

// The unstyled grid Playwright drives (D5): the same grid as real table elements (`table`) or as
// divs (`div`), configured by the query string, so one spec runs against both.
//
//   ?rows=1000000        the row count (rows are computed from their index, nothing is stored);
//                        0 shows the empty state
//   &columns=1000        the column count (100px each)
//   &rowHeight=32        a row's height; &variable=1 makes it vary by index (24–48px)
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
//                        (`inner-<row>`, 30 rows × 8 columns) and a button (`detail-button-<row>`)
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
//
// For the spec: `window.grid` is the grid's model and engine, `window.commits` counts React
// commits of the grid (a Profiler), `window.sortChanges` the sorts reported,
// `window.selectionChanges` the selections, `window.widthChanges` the widths,
// `window.orderChanges` the column orders, and a button before and after the grid take Tab.

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
 * with `reorderable`).
 */
function grouped(
    columns: Column<FixtureRow>[],
    reorderable: boolean,
): ColumnOrGroup<FixtureRow>[] {
    const [first, ...rest] = columns;
    const entries: ColumnOrGroup<FixtureRow>[] = first ? [first] : [];
    for (let start = 0, group = 0; start < rest.length; group++) {
        const size = group % 2 === 0 ? 4 : 12;
        entries.push({
            key: `G${group}`,
            name: `G${group}`,
            children: rest.slice(start, start + size),
            ...(reorderable ? { reorderable } : {}),
        });
        start += size;
    }
    return entries;
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

/** A cell's value: C1's wider with `&resize=1`, C3's wider still with `&autosize=1`. */
function cellValue(
    columnIndex: number,
    resize: boolean,
    autoSize: boolean,
): (row: FixtureRow) => string {
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
}: {
    table: boolean;
    row?: HeaderRowInfo<FixtureRow> | undefined;
    resize?: boolean;
}) {
    const tag = tags(table);
    return (
        <DataGrid.HeaderRow row={row} render={tag.headerRow}>
            <DataGrid.HeaderCells<FixtureRow>>
                {(cell) => (
                    <DataGrid.HeaderCell
                        cell={cell}
                        render={tag.headerCell}
                        style={pinnedStyle}
                    >
                        {resize ? (
                            // its own content, then its resizer
                            <>
                                {headerCellContent(cell)}
                                <Resizer cell={cell} />
                            </>
                        ) : undefined}
                    </DataGrid.HeaderCell>
                )}
            </DataGrid.HeaderCells>
        </DataGrid.HeaderRow>
    );
}

function Fixture({ kind }: { kind: "table" | "div" }) {
    const params = new URLSearchParams(location.search);
    const rowCount = numberParam(params, "rows", 1_000);
    const columnCount = numberParam(params, "columns", 20);
    const fixedHeight = numberParam(params, "rowHeight", 32);
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
    const detailHeight = numberParam(params, "detailHeight", 200);
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
                    getValue: cellValue(columnIndex, resize, autoSize),
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
                    ...(reorder &&
                    reorderColumn(columnIndex, pinnedCount, pinnedEnd)
                        ? { reorderable: true }
                        : {}),
                    ...(rowSelection && columnIndex === 1
                        ? {
                              renderCell: ({ row }) => (
                                  <SelectBox rowIndex={row.index} />
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
        return groups ? grouped(leaves, reorder) : leaves;
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
        reorder,
        rowSelection,
    ]);
    const rowHeight = useMemo(
        () =>
            variable ? (index: number) => 24 + ((index * 7) % 25) : fixedHeight,
        [variable, fixedHeight],
    );
    const table = kind === "table";
    const tag = tags(table);

    return (
        <>
            {reorder ? <style>{DROP_TARGET_CSS}</style> : null}
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
                    rowCount={rowCount}
                    getRow={getRow}
                    rowHeight={rowHeight}
                    detailHeight={details ? detailHeight : undefined}
                    maxScrollSize={maxScrollSize}
                    onSortColumnsChange={(sortColumns) =>
                        window.sortChanges.push(sortColumns)
                    }
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
                                        />
                                    )}
                                </DataGrid.HeaderRows>
                            ) : (
                                // without groups, the single header row (the markup most grids use)
                                <HeaderRow table={table} resize={resize} />
                            )}
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
                                                    style={pinnedStyle}
                                                >
                                                    {details &&
                                                    cell.columnIndex === 0 ? (
                                                        <>
                                                            {String(cell.value)}{" "}
                                                            <Expander
                                                                rowIndex={
                                                                    cell.rowIndex
                                                                }
                                                            />
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
    const root = document.getElementById("root");
    if (!root) throw new Error("#root is missing");
    createRoot(root).render(
        <StrictMode>
            <Fixture kind={kind} />
        </StrictMode>,
    );
}
