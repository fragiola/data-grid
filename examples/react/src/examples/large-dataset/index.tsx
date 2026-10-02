"use client";

import {
    type AxisWindow,
    type Column,
    DataGrid,
    type Range,
} from "@fragiola/data-grid-react";
import { useState } from "react";
import { formatNumber, measurement } from "../_kit/data";
import { createStore, type Store, useStore } from "../_kit/store";
import * as styles from "./styles";

const ROWS = 1_000_000;
const COLUMNS = 1_000;

/** A row is only its index: every value is computed from it, nothing is stored. */
interface Row {
    index: number;
}

const getRow = (index: number): Row => ({ index });

const columns: Column<Row>[] = [
    {
        key: "row",
        name: "Row",
        width: 96,
        renderCell: ({ row }) => formatNumber(row.index + 1),
    },
    ...Array.from(
        { length: COLUMNS - 1 },
        (_, i): Column<Row> => ({
            key: `m${i + 1}`,
            name: `M${i + 1}`,
            width: 96,
            getValue: (row) => measurement(row.index, i + 1),
            renderCell: ({ value }) =>
                typeof value === "number" ? value.toFixed(2) : null,
        }),
    ),
];

const EMPTY: AxisWindow = {
    visible: { start: 0, end: 0 },
    rendered: { start: 0, end: 0 },
};

interface Windows {
    rows: AxisWindow;
    columns: AxisWindow;
}

export default function LargeDataset() {
    // the windows go to a store the readout reads, so the grid never re-renders for them
    const [windows] = useState(() =>
        createStore<Windows>({ rows: EMPTY, columns: EMPTY }),
    );
    return (
        <div className={styles.frame}>
            <Readout windows={windows} />
            <DataGrid.Root
                columns={columns}
                rowCount={ROWS}
                getRow={getRow}
                rowHeight={32}
                className={styles.root}
                onRowWindowChange={(rows) =>
                    windows.set((current) => ({ ...current, rows }))
                }
                onColumnWindowChange={(columns) =>
                    windows.set((current) => ({ ...current, columns }))
                }
            >
                <DataGrid.Grid
                    aria-label="Measurements"
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
                                <DataGrid.Row row={row} className={styles.row}>
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
    );
}

function span(range: Range) {
    return range.end - range.start;
}

function Readout({ windows }: { windows: Store<Windows> }) {
    const { rows, columns } = useStore(windows);
    return (
        <p className={styles.readout} data-testid="readout">
            <span>
                <span className={styles.figure}>{formatNumber(ROWS)}</span> rows
                × <span className={styles.figure}>{formatNumber(COLUMNS)}</span>{" "}
                columns ={" "}
                <span className={styles.figure}>
                    {formatNumber(ROWS * COLUMNS)}
                </span>{" "}
                cells
            </span>
            <span>
                rows{" "}
                <span className={styles.figure}>
                    {formatNumber(rows.visible.start + 1)}–
                    {formatNumber(rows.visible.end)}
                </span>{" "}
                in view
            </span>
            <span>
                rendered:{" "}
                <span className={styles.figure} data-testid="rendered-cells">
                    {formatNumber(span(rows.rendered) * span(columns.rendered))}
                </span>{" "}
                cells
            </span>
        </p>
    );
}
