"use client";

import {
    type AxisWindow,
    type Column,
    DataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatNumber, measurement } from "../_kit/data";
import { createFakeApi, type FakeApi } from "../_kit/fake-api";
import * as styles from "./styles";
import { createTileCache, type TileCache } from "./tiles";

const ROWS = 100_000;
const COLUMNS = 2_000;
const TILE = { rows: 50, columns: 20 };

/** Every row exists from the start; its cells come with the tiles. */
interface Row {
    index: number;
}

/** Every row exists from the start: the same getter for the grid's whole life. */
const getRow = (index: number): Row => ({ index });

const EMPTY: AxisWindow = {
    visible: { start: 0, end: 0 },
    rendered: { start: 0, end: 0 },
};

function columnsFor(tiles: TileCache): Column<Row>[] {
    return Array.from(
        { length: COLUMNS },
        (_, i): Column<Row> => ({
            key: `c${i}`,
            name: `C${formatNumber(i + 1)}`,
            width: 104,
            getValue: (row) => tiles.get(row.index, i),
        }),
    );
}

export default function WindowedColumns() {
    const [api] = useState(() => createFakeApi(450));
    const [tiles] = useState(() =>
        createTileCache(
            api,
            TILE,
            { rows: ROWS, columns: COLUMNS },
            measurement,
        ),
    );
    const [columns] = useState(() => columnsFor(tiles));
    const gridRef = useDataGridRef<Row>();
    // a tile that arrives fills the cells of its rows: the grid is told which, and renders them
    // only if they are on screen
    useEffect(
        () =>
            tiles.subscribe((rows) =>
                gridRef.current?.model.run("rows.changed", rows),
            ),
        [tiles, gridRef],
    );
    // both windows, kept to ask for the tiles once the scroll settles
    const windows = useRef({ rows: EMPTY, columns: EMPTY });
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    // a request still waiting when the example goes away is not sent
    useEffect(() => () => clearTimeout(timer.current), []);
    const load = () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(
            () =>
                tiles.ensure(
                    windows.current.rows.rendered,
                    windows.current.columns.rendered,
                ),
            80,
        );
    };

    return (
        <div className={styles.frame}>
            <div className={styles.layout}>
                <DataGrid.Root
                    columns={columns}
                    rowCount={ROWS}
                    getRow={getRow}
                    gridRef={gridRef}
                    rowHeight={32}
                    onRowWindowChange={(rows) => {
                        windows.current.rows = rows;
                        load();
                    }}
                    onColumnWindowChange={(columns) => {
                        windows.current.columns = columns;
                        load();
                    }}
                    className={styles.root}
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
                                    <DataGrid.Row
                                        row={row}
                                        className={styles.row}
                                    >
                                        <DataGrid.Cells<Row>>
                                            {(cell) => (
                                                <DataGrid.Cell
                                                    cell={cell}
                                                    className={styles.cell}
                                                    data-tile-loaded={
                                                        cell.value === undefined
                                                            ? undefined
                                                            : ""
                                                    }
                                                >
                                                    {typeof cell.value ===
                                                    "number" ? (
                                                        cell.value.toFixed(2)
                                                    ) : (
                                                        <span
                                                            className={
                                                                styles.skeleton
                                                            }
                                                        />
                                                    )}
                                                </DataGrid.Cell>
                                            )}
                                        </DataGrid.Cells>
                                    </DataGrid.Row>
                                )}
                            </DataGrid.Rows>
                        </DataGrid.Body>
                    </DataGrid.Grid>
                </DataGrid.Root>
                <RequestLog api={api} />
            </div>
        </div>
    );
}

function RequestLog({ api }: { api: FakeApi }) {
    const log = useSyncExternalStore(
        api.subscribe,
        () => api.log,
        () => api.log,
    );
    return (
        <aside className={styles.log} aria-label="Requests">
            <p className={styles.logTitle} data-testid="request-count">
                {formatNumber(log.length)}{" "}
                {log.length === 1 ? "tile request" : "tile requests"}
            </p>
            <ol className={styles.logList} data-testid="request-log">
                {log
                    .slice(-12)
                    .reverse()
                    .map((request) => (
                        <li
                            key={request.id}
                            className={styles.logItem}
                            data-start={request.start}
                            data-end={request.end}
                        >
                            {request.description}
                        </li>
                    ))}
            </ol>
        </aside>
    );
}
