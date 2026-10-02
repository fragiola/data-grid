"use client";

import {
    type Column,
    DataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatMoney, formatNumber, type Person, person } from "../_kit/data";
import { createFakeApi, type FakeApi } from "../_kit/fake-api";
import { createRangeCache } from "../_kit/range-cache";
import * as styles from "./styles";

const TOTAL = 1_000_000;
const BLOCK = 100;

const columns: Column<Person>[] = [
    { key: "id", name: "#", width: 96 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 280 },
    { key: "city", name: "City", width: 140 },
    {
        key: "salary",
        name: "Salary",
        width: 120,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

export default function WindowedLoading() {
    const [api] = useState(() => createFakeApi(500));
    // blocks of 100 rows, each requested once: the app's cache, not the grid's
    const [cache] = useState(() =>
        createRangeCache(TOTAL, BLOCK, (start, end) =>
            api.fetchRows(start, end, person),
        ),
    );
    const gridRef = useDataGridRef<Person>();
    // rows that arrive replace their placeholders: the grid is told which, and renders them only
    // if they are on screen. The getter stays the same
    useEffect(
        () =>
            cache.subscribe((range) =>
                gridRef.current?.model.run("rows.changed", range),
            ),
        [cache, gridRef],
    );
    // load what is rendered once the scroll settles: a thumb dragged across the dataset asks
    // only for where it stops, never for the rows it passed
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    // a request still waiting when the example goes away is not sent
    useEffect(() => () => clearTimeout(timer.current), []);

    return (
        <div className={styles.frame}>
            <div className={styles.layout}>
                <DataGrid.Root
                    columns={columns}
                    rowCount={TOTAL}
                    getRow={cache.get}
                    gridRef={gridRef}
                    rowKey={(row) => row.id}
                    rowHeight={36}
                    onRowWindowChange={({ rendered }) => {
                        clearTimeout(timer.current);
                        timer.current = setTimeout(
                            () => cache.ensure(rendered.start, rendered.end),
                            80,
                        );
                    }}
                    className={styles.root}
                >
                    <DataGrid.Grid aria-label="People" className={styles.grid}>
                        <DataGrid.Header className={styles.header}>
                            <DataGrid.HeaderRow className={styles.headerRow}>
                                <DataGrid.HeaderCells<Person>>
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
                            <DataGrid.Rows<Person>>
                                {(row) => (
                                    <DataGrid.Row
                                        row={row}
                                        className={styles.row}
                                    >
                                        <DataGrid.Cells<Person>>
                                            {(cell) => (
                                                <DataGrid.Cell
                                                    cell={cell}
                                                    className={styles.cell}
                                                >
                                                    {cell.loaded ? undefined : (
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
                {log.length === 1 ? "request" : "requests"},{" "}
                {formatNumber(log.length * BLOCK)} of {formatNumber(TOTAL)} rows
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
