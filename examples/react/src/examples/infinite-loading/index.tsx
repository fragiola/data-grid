"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatMoney, formatNumber, type Person, person } from "../_kit/data";
import { createFakeApi } from "../_kit/fake-api";
import * as styles from "./styles";

const TOTAL = 1_000;
const PAGE = 50;

const columns: Column<Person>[] = [
    { key: "id", name: "#", width: 72 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140 },
    {
        key: "salary",
        name: "Salary",
        width: 120,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

export default function InfiniteLoading() {
    const [api] = useState(() => createFakeApi(600));
    const [rows, setRows] = useState<Person[]>([]);
    const [loading, setLoading] = useState(false);
    // what is in flight and what comes next: refs, read by the callback the grid calls
    const next = useRef({ page: 0, busy: false, done: false });

    const loadMore = useCallback(() => {
        const state = next.current;
        if (state.busy || state.done) return;
        state.busy = true;
        setLoading(true);
        api.fetchPage(state.page, PAGE, TOTAL, person).then((page) => {
            state.page += 1;
            state.busy = false;
            state.done = page.length < PAGE || state.page * PAGE >= TOTAL;
            setRows((current) => [...current, ...page]);
            setLoading(false);
        });
    }, [api]);

    // the first page
    useEffect(() => loadMore(), [loadMore]);

    return (
        <div className={styles.frame}>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={36}
                // the grid tells when the view's last row is within 15 rows of the end
                onRowsEndReached={loadMore}
                endReachedThreshold={15}
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
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<Person>>
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
            <p className={styles.status} role="status" data-testid="status">
                {loading && <span className={styles.spinner} aria-hidden />}
                <span>
                    Loaded{" "}
                    <span className={styles.figure} data-testid="loaded">
                        {formatNumber(rows.length)}
                    </span>{" "}
                    of {formatNumber(TOTAL)} rows
                    {loading ? " · loading the next page…" : ""}
                </span>
            </p>
        </div>
    );
}
