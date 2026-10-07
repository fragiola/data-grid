"use client";

import {
    type Column,
    DataGrid,
    type DataGridRef,
    type Range,
    useColumnWindow,
    useDataGridRef,
    useRowWindow,
} from "@fragiola/data-grid-react";
import * as styles from "./styles";

const ROWS = 1_000;
const COLUMNS = 100;

/** A row is only its index: each cell shows its own coordinates. */
interface Row {
    index: number;
}

const getRow = (index: number): Row => ({ index });

const columns: Column<Row>[] = Array.from(
    { length: COLUMNS },
    (_, i): Column<Row> => ({
        key: `c${i}`,
        name: String(i),
        width: 90,
        renderCell: ({ rowIndex }) => `${rowIndex} × ${i}`,
    }),
);

// The grid's size is its CSS: here a starting size and `resize: both` (styles.ts), so the reader
// drags its corner. The engine watches its scroll container (a ResizeObserver from the
// container's own window) and renders what the new size shows: nothing to tell it.

export default function ResizableGrid() {
    const gridRef = useDataGridRef<Row>();
    return (
        <div className={styles.frame}>
            <Readout gridRef={gridRef} />
            <div className={styles.stage}>
                <DataGrid.Root
                    gridRef={gridRef}
                    columns={columns}
                    rowCount={ROWS}
                    getRow={getRow}
                    rowHeight={32}
                    className={styles.root}
                >
                    <DataGrid.Grid
                        aria-label="Coordinates"
                        className={styles.grid}
                    >
                        <DataGrid.Header className={styles.header}>
                            <DataGrid.HeaderRow className={styles.headerRow}>
                                <DataGrid.HeaderCells<Row>>
                                    {(cell) => (
                                        <DataGrid.HeaderCell
                                            cell={cell}
                                            className={styles.headerCell}
                                        />
                                    )}
                                </DataGrid.HeaderCells>
                            </DataGrid.HeaderRow>
                        </DataGrid.Header>
                        <DataGrid.Body>
                            <DataGrid.Rows<Row>>
                                {(row) => (
                                    <DataGrid.Row
                                        row={row}
                                        className={styles.row}
                                    >
                                        <DataGrid.Cells<Row>>
                                            {(cell) => (
                                                <DataGrid.Cell
                                                    cell={cell}
                                                    className={styles.cell}
                                                />
                                            )}
                                        </DataGrid.Cells>
                                    </DataGrid.Row>
                                )}
                            </DataGrid.Rows>
                        </DataGrid.Body>
                    </DataGrid.Grid>
                </DataGrid.Root>
            </div>
        </div>
    );
}

function count(range: Range) {
    return range.end - range.start;
}

/** What the grid shows at its size, read through its ref: the windows the engine reports. */
function Readout({ gridRef }: { gridRef: DataGridRef<Row> }) {
    const rows = useRowWindow(gridRef);
    const columns = useColumnWindow(gridRef);
    return (
        <p className={styles.readout}>
            <span>Drag the grid's bottom corner to resize it.</span>
            <span data-testid="in-view">
                <span className={styles.figure}>{count(rows.visible)}</span>{" "}
                rows ×{" "}
                <span className={styles.figure}>{count(columns.visible)}</span>{" "}
                columns in view
            </span>
        </p>
    );
}
