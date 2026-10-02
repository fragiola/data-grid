"use client";

import {
    type AxisWindow,
    type Column,
    DataGrid,
} from "@fragiola/data-grid-react";
import { useState } from "react";
import { formatNumber, measurement } from "../_kit/data";
import { createStore, type Store, useStore } from "../_kit/store";
import * as styles from "./styles";

const ROWS = 10_000;
const COLUMNS = 5_000;

interface Row {
    index: number;
}

const getRow = (index: number): Row => ({ index });

const columns: Column<Row>[] = Array.from(
    { length: COLUMNS },
    (_, i): Column<Row> => ({
        key: `c${i}`,
        name: `Column ${formatNumber(i + 1)}`,
        width: 120,
        getValue: (row) => measurement(row.index, i),
        renderCell: ({ value }) =>
            typeof value === "number" ? value.toFixed(2) : null,
    }),
);

const EMPTY: AxisWindow = {
    visible: { start: 0, end: 0 },
    rendered: { start: 0, end: 0 },
};

export default function ManyColumns() {
    const [window] = useState(() => createStore<AxisWindow>(EMPTY));
    return (
        <div className={styles.frame}>
            <ColumnReadout window={window} />
            <DataGrid.Root
                columns={columns}
                rowCount={ROWS}
                getRow={getRow}
                rowHeight={32}
                overscan={{ columns: 3 }}
                className={styles.root}
                onColumnWindowChange={window.set}
            >
                <DataGrid.Grid aria-label="Columns" className={styles.grid}>
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

function ColumnReadout({ window }: { window: Store<AxisWindow> }) {
    const { visible, rendered } = useStore(window);
    return (
        <p className={styles.readout} data-testid="readout">
            <span>
                <span className={styles.figure}>{formatNumber(COLUMNS)}</span>{" "}
                columns
            </span>
            <span>
                in view:{" "}
                <span className={styles.figure} data-testid="visible-columns">
                    {formatNumber(visible.start + 1)}–
                    {formatNumber(visible.end)}
                </span>
            </span>
            <span>
                rendered:{" "}
                <span className={styles.figure} data-testid="rendered-columns">
                    {formatNumber(rendered.start + 1)}–
                    {formatNumber(rendered.end)}
                </span>
            </span>
        </p>
    );
}
