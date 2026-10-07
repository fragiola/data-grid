import { repeatedFill } from "@fragiola/data-grid/fill";
import { moveRow } from "@fragiola/data-grid/local";
import {
    type CellInfo,
    type ColSpanArgs,
    type Column,
    type ColumnOrGroup,
    DataGrid,
    type GridDirection,
    useDataGridRef,
} from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import { Profiler, StrictMode, useCallback, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
    DROP_TARGET_CSS,
    Expander,
    Expose,
    FILL_CSS,
    FillHandle,
    type FixtureRow,
    HeaderRow,
    PickEditor,
    pinnedStyle,
    RANGE_CSS,
    ROW_DROP_CSS,
    RowHandle,
    SelectBox,
    SummaryRows,
    TextEditor,
    tags,
} from "./grid-fixture.tsx";

// The combined stress fixture (Epic #89, E5.3): every feature on at once, over 1,000,000 rows and
// 1,000 columns, both axes scaled, as a table (`?kind=table`) or as divs (the default). Its parts
// are the grid fixture's (`grid-fixture.tsx`); only the columns and the data are its own.
//
//   rows       1,000,000 from `getRow` (a row is its id, the index it had first; nothing stored
//              but the order and the values written), rows 28–40px tall by index
//   columns    1,000, 100px: C0 and C1 pinned at the start (C0 a row's drag handle, its id and its
//              expander; C1 its checkbox), C998 and C999 pinned at the end (group `GE`); between
//              them group `G1` (C2–C13, collapsible: expanded all but C13, collapsed C2 and C13,
//              a toggle `toggle-G1` in a sticky label `label-G1`), then groups of 10 (`G2`…)
//   sorting    C2 and C3 sortable, the sort uncontrolled (the grid never orders the rows)
//   resizing   C0, C1, G1's columns and GE's (`resizer-<key>`)
//   reordering G1's columns, the groups after it and GE's columns; rows by their handle
//   spans      C6 spans C6–C8 on every fifth row, C998 asks for 5 (its part keeps it to 2), C20's
//              header cell spans C20–C21; a summary row's C2 spans C2–C3
//   summary    a row at the top and one at the bottom (`top0:<column>`, `bottom0:<column>`)
//   selection  rows (multiple, C1's checkbox) and cell ranges, copy and paste, editing (C3 a text
//              field, C4 a picker on even rows) and the fill handle (`fill-handle`, in the
//              columns that neither edit nor hold controls); edits, pastes and fills are written
//              to the fixture's values, by row id
//   details    expandable rows (C0's `expand-<row>`), a detail 120px tall (`detail-<id>`)
//   direction  `toggle-dir` toggles the grid's direction (right to left and back)
//   scaling    `maxScrollSize` 80,000: the rows (~34M px) and the columns (100,000px) both scaled
//
//   &grouped=1 the rows-in-memory variant: 100,000 rows grouped by C5 (`g<index % 7>`) through
//              `useLocalRows` (row grouping is the in-memory pipeline's, not `getRow`'s), rows not
//              reorderable; the rest as above
//
// For the spec: `window.grid` (model and engine), `window.commits` (the grid's React commits, a
// Profiler), and the grid fixture's change logs this page fills: `sortChanges`,
// `selectionChanges`, `widthChanges`, `orderChanges`, `collapseChanges`, `rowMoves`,
// `rangePastes`, `cellEdits`, `fills`.

const ROW_COUNT = 1_000_000;
const GROUPED_ROW_COUNT = 100_000;
const COLUMN_COUNT = 1_000;
const MAX_SCROLL_SIZE = 80_000;

/** The values written (edits, pastes, fills), by `<id>:<column>`: the fixture's data. */
const written = new Map<string, string>();

const writtenValue = (columnIndex: number) => (row: FixtureRow) =>
    written.get(`${row.index}:${columnIndex}`) ?? `${row.index}:${columnIndex}`;

/** Every fifth row by id: where C6 and C998 span. */
const spansRow = (args: ColSpanArgs<FixtureRow>, span: number) =>
    args.type === "row" && args.row.index % 5 === 0 ? span : undefined;

/** The editable columns and the one holding a checkbox: their cells take no children. */
const OWN_CONTENT = new Set([1, 3, 4]);

/** A column; `grouped`, C5's value is the group a row falls in (`g<index % 7>`). */
function leaf(columnIndex: number, grouped: boolean): Column<FixtureRow> {
    const column: Column<FixtureRow> = {
        key: `c${columnIndex}`,
        name: `C${columnIndex}`,
        width: 100,
        getValue:
            grouped && columnIndex === 5
                ? (row) => `g${row.index % 7}`
                : writtenValue(columnIndex),
        renderSummaryCell: ({ position, summaryIndex }) =>
            `${position}${summaryIndex}:${columnIndex}`,
    };
    switch (columnIndex) {
        case 0:
            return { ...column, pinned: "start", resizable: true };
        case 1:
            return {
                ...column,
                pinned: "start",
                resizable: true,
                renderCell: ({ rowIndex }) => <SelectBox rowIndex={rowIndex} />,
            };
        case 2:
            return {
                ...column,
                sortable: true,
                colSpan: (args) => (args.type === "summary" ? 2 : undefined),
            };
        case 3:
            return {
                ...column,
                sortable: true,
                editable: true,
                renderEditCell: (props) => <TextEditor {...props} />,
            };
        case 4:
            return {
                ...column,
                editable: (row) => row.index % 2 === 0,
                renderEditCell: (props) => <PickEditor {...props} />,
            };
        case 6:
            return { ...column, colSpan: (args) => spansRow(args, 3) };
        case 20:
            return {
                ...column,
                colSpan: ({ type }) => (type === "header" ? 2 : undefined),
            };
        case COLUMN_COUNT - 2:
            return {
                ...column,
                pinned: "end",
                resizable: true,
                reorderable: true,
                colSpan: (args) => spansRow(args, 5),
            };
        case COLUMN_COUNT - 1:
            return {
                ...column,
                pinned: "end",
                resizable: true,
                reorderable: true,
            };
        default:
            return column;
    }
}

/** The columns: C0 and C1, G1 (collapsible), groups of 10, GE pinned at the end. */
function stressColumns(grouped: boolean): ColumnOrGroup<FixtureRow>[] {
    const leaves = Array.from({ length: COLUMN_COUNT }, (_, i) =>
        leaf(i, grouped),
    );
    const main = leaves.slice(2, 14).map(
        (column, index, all): Column<FixtureRow> => ({
            ...column,
            resizable: true,
            reorderable: true,
            ...(index === 0
                ? {}
                : {
                      groupShow:
                          index === all.length - 1 ? "collapsed" : "expanded",
                  }),
        }),
    );
    const entries: ColumnOrGroup<FixtureRow>[] = [
        ...leaves.slice(0, 2),
        {
            key: "G1",
            name: "G1",
            children: main,
            collapsible: true,
            reorderable: true,
        },
    ];
    const end = COLUMN_COUNT - 2;
    for (let start = 14, group = 2; start < end; start += 10, group++) {
        entries.push({
            key: `G${group}`,
            name: `G${group}`,
            children: leaves.slice(start, Math.min(start + 10, end)),
            reorderable: true,
        });
    }
    entries.push({ key: "GE", name: "GE", children: leaves.slice(end) });
    return entries;
}

const rowHeight = (index: number) => 28 + (index % 3) * 6;

/** A row's key: its id. */
const rowId = (row: FixtureRow) => row.index;

/** C0's content: the row's handle (ungrouped), its id and its expander. */
function FirstCell({
    cell,
    handle,
}: {
    cell: CellInfo<FixtureRow>;
    handle: boolean;
}) {
    return (
        <>
            {handle ? <RowHandle cell={cell} /> : null}
            {String(cell.value ?? "")} <Expander rowIndex={cell.rowIndex} />
        </>
    );
}

function StressFixture({
    kind,
    grouped,
}: {
    kind: "table" | "div";
    grouped: boolean;
}) {
    const tag = tags(kind === "table");
    const table = kind === "table";
    const gridRef = useDataGridRef<FixtureRow>();
    const columns = useMemo(() => stressColumns(grouped), [grouped]);
    const [direction, setDirection] = useState<GridDirection>("ltr");
    // the rows' order, by id: the app's, moved on each move
    const [rowOrder, setRowOrder] = useState<readonly number[]>(() =>
        grouped ? [] : Array.from({ length: ROW_COUNT }, (_, index) => index),
    );
    const getRow = useCallback(
        (index: number): FixtureRow => ({ index: rowOrder[index] ?? index }),
        [rowOrder],
    );
    // the grouped variant: its rows in memory, grouped by C5
    const memoryRows = useMemo(
        () =>
            grouped
                ? Array.from({ length: GROUPED_ROW_COUNT }, (_, index) => ({
                      index,
                  }))
                : [],
        [grouped],
    );
    const local = useLocalRows(memoryRows, columns, {
        groupBy: grouped ? ["c5"] : [],
        rowKey: rowId,
    });

    /** The id of the row at `rowIndex`, now. */
    const idAt = (rowIndex: number) =>
        gridRef.current?.model.get("row-by", { index: rowIndex })?.index ??
        rowIndex;
    /** Writes values by position, then tells the grid their rows changed. */
    const write = (
        cells: readonly {
            rowIndex: number;
            columnIndex: number;
            value: unknown;
        }[],
    ) => {
        let start = Number.POSITIVE_INFINITY;
        let end = 0;
        for (const { rowIndex, columnIndex, value } of cells) {
            written.set(`${idAt(rowIndex)}:${columnIndex}`, String(value));
            start = Math.min(start, rowIndex);
            end = Math.max(end, rowIndex + 1);
        }
        if (end > 0) gridRef.current?.model.run("rows.changed", { start, end });
    };

    return (
        <>
            <style>
                {DROP_TARGET_CSS + ROW_DROP_CSS + RANGE_CSS + FILL_CSS}
            </style>
            <button
                type="button"
                data-testid="toggle-dir"
                onClick={() =>
                    setDirection((was) => (was === "rtl" ? "ltr" : "rtl"))
                }
            >
                direction
            </button>
            <Profiler
                id="grid"
                onRender={() => {
                    window.commits += 1;
                }}
            >
                <DataGrid.Root<FixtureRow>
                    columns={columns}
                    {...(grouped
                        ? local.props
                        : { rowCount: ROW_COUNT, getRow, rowKey: rowId })}
                    rowHeight={rowHeight}
                    headerRowHeight={32}
                    maxScrollSize={MAX_SCROLL_SIZE}
                    summaryRows={{ top: 1, bottom: 1 }}
                    detailHeight={120}
                    direction={direction}
                    rowSelection="multiple"
                    cellSelection="range"
                    onRowMove={
                        grouped
                            ? undefined
                            : (move) => {
                                  window.rowMoves.push(move);
                                  setRowOrder((order) =>
                                      moveRow(
                                          order,
                                          move.fromIndex,
                                          move.toIndex,
                                      ),
                                  );
                              }
                    }
                    onSortColumnsChange={(sortColumns) => {
                        window.sortChanges.push(sortColumns);
                        if (grouped)
                            local.props.onSortColumnsChange?.(sortColumns);
                    }}
                    onSelectedRowKeysChange={(keys) =>
                        window.selectionChanges.push(keys)
                    }
                    onColumnWidthsChange={(widths) =>
                        window.widthChanges.push(widths)
                    }
                    onColumnOrderChange={(order) =>
                        window.orderChanges.push(order)
                    }
                    onCollapsedGroupKeysChange={(keys) =>
                        window.collapseChanges.push(keys)
                    }
                    onCellEdit={(edit) => {
                        window.cellEdits.push({
                            rowIndex: edit.rowIndex,
                            columnKey: edit.columnKey,
                            value: edit.value,
                        });
                        write([edit]);
                    }}
                    onRangePaste={(paste) => {
                        window.rangePastes.push(paste);
                        write(
                            paste.values.flatMap((texts, row) =>
                                texts.map((value, column) => ({
                                    rowIndex: paste.range.anchor.rowIndex + row,
                                    columnIndex:
                                        paste.range.anchor.columnIndex + column,
                                    value,
                                })),
                            ),
                        );
                    }}
                    onFill={(filled) => {
                        window.fills.push(filled);
                        const model = gridRef.current?.model;
                        if (!model) return;
                        write(
                            repeatedFill(filled, (at) =>
                                model.get("cell-value-by", at),
                            ),
                        );
                    }}
                    gridRef={gridRef}
                    data-testid="viewport"
                    style={{ width: 900, height: 600 }}
                >
                    <Expose />
                    <DataGrid.Grid aria-label="Stress" render={tag.grid}>
                        <DataGrid.Header
                            render={tag.header}
                            style={{ background: "white" }}
                        >
                            <DataGrid.HeaderRows<FixtureRow>>
                                {(row) => (
                                    <HeaderRow
                                        table={table}
                                        row={row}
                                        resize
                                        groupContent
                                        stickyLabels
                                    />
                                )}
                            </DataGrid.HeaderRows>
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
                                                    {cell.group ||
                                                    OWN_CONTENT.has(
                                                        cell.columnIndex,
                                                    ) ? undefined : cell.columnIndex ===
                                                      0 ? (
                                                        <FirstCell
                                                            cell={cell}
                                                            handle={!grouped}
                                                        />
                                                    ) : (
                                                        <>
                                                            {String(
                                                                cell.value ??
                                                                    "",
                                                            )}
                                                            <FillHandle
                                                                cell={cell}
                                                            />
                                                        </>
                                                    )}
                                                </DataGrid.Cell>
                                            )}
                                        </DataGrid.Cells>
                                        <DataGrid.RowDetail
                                            render={tag.detail}
                                            style={{ background: "white" }}
                                        >
                                            <span
                                                data-testid={`detail-${row.row?.index}`}
                                            >
                                                detail {row.row?.index}
                                            </span>{" "}
                                            <button type="button">
                                                detail button
                                            </button>
                                        </DataGrid.RowDetail>
                                    </DataGrid.Row>
                                )}
                            </DataGrid.Rows>
                        </DataGrid.Body>
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
        </>
    );
}

export function mountStressFixture() {
    const params = new URLSearchParams(location.search);
    window.commits = 0;
    window.sortChanges = [];
    window.selectionChanges = [];
    window.widthChanges = [];
    window.orderChanges = [];
    window.collapseChanges = [];
    window.rowMoves = [];
    window.groupChanges = [];
    window.rangeChanges = [];
    window.rangePastes = [];
    window.cellEdits = [];
    window.fills = [];
    window.editingChanges = [];
    const root = document.getElementById("root");
    if (!root) throw new Error("#root is missing");
    createRoot(root).render(
        <StrictMode>
            <StressFixture
                kind={params.get("kind") === "table" ? "table" : "div"}
                grouped={params.get("grouped") === "1"}
            />
        </StrictMode>,
    );
}
