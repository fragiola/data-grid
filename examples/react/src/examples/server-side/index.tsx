"use client";

import { pageCount } from "@fragiola/data-grid/local";
import {
    type Column,
    DataGrid,
    type SortColumn,
} from "@fragiola/data-grid-react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { Select } from "#/components/ui/select";
import { formatMoney, formatNumber, type Person } from "../_kit/data";
import { api, fetchPeople } from "./server";
import * as styles from "./styles";

const PAGE_SIZE = 50;

const TEAMS: Record<string, string> = {
    any: "Every team",
    Platform: "Platform",
    Design: "Design",
    Data: "Data",
    Mobile: "Mobile",
    Growth: "Growth",
    Security: "Security",
};

const columns: Column<Person>[] = [
    { key: "name", name: "Name", width: 180, sortable: true },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 140, sortable: true },
    { key: "team", name: "Team", width: 130, sortable: true },
    {
        key: "salary",
        name: "Salary",
        width: 130,
        sortable: true,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

export default function ServerSide() {
    // the external mode: the app keeps the sort (grid state, the header toggles it), the filter,
    // the search and the page, and asks the server; the grid shows the page it gets back
    const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([
        { columnKey: "name", direction: "ascending" },
    ]);
    const [team, setTeam] = useState("");
    const [typed, setTyped] = useState("");
    const [search, setSearch] = useState("");
    const [pageIndex, setPageIndex] = useState(0);
    const [page, setPage] = useState<{
        rows: readonly Person[];
        total: number;
    }>({ rows: [], total: 0 });
    const [loading, setLoading] = useState(true);

    // the search goes to the server once the typing pauses (and only when it changed: a page
    // chosen meanwhile stays)
    useEffect(() => {
        if (typed === search) return;
        const timer = setTimeout(() => {
            setSearch(typed);
            setPageIndex(0);
        }, 250);
        return () => clearTimeout(timer);
    }, [typed, search]);

    useEffect(() => {
        // an answer to a query the app has moved on from is dropped
        let current = true;
        setLoading(true);
        fetchPeople({
            sortColumns,
            team,
            search,
            pageIndex,
            pageSize: PAGE_SIZE,
        }).then((answer) => {
            if (!current) return;
            setPage(answer);
            setLoading(false);
        });
        return () => {
            current = false;
        };
    }, [sortColumns, team, search, pageIndex]);

    const pages = pageCount(page.total, PAGE_SIZE);

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <Input.Template.Simple
                    aria-label="Search every column"
                    placeholder="Search"
                    value={typed}
                    onValueChange={setTyped}
                    inset={{
                        start: <Search aria-hidden className={styles.icon} />,
                    }}
                    className={styles.search}
                />
                <Select.Root
                    items={TEAMS}
                    value={team || "any"}
                    onValueChange={(choice) => {
                        setTeam(
                            typeof choice === "string" && choice !== "any"
                                ? choice
                                : "",
                        );
                        setPageIndex(0);
                    }}
                >
                    <Select.Trigger className={styles.select} aria-label="Team">
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        {Object.entries(TEAMS).map(([value, label]) => (
                            <Select.Item key={value} value={value}>
                                {label}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
                <span
                    className={styles.count}
                    data-testid="count"
                    aria-live="polite"
                >
                    {loading
                        ? "Loading…"
                        : `${formatNumber(page.total)} people`}
                </span>
            </div>
            <div className={styles.layout}>
                <DataGrid.Root
                    columns={columns}
                    rows={page.rows}
                    rowKey={(row) => row.id}
                    rowHeight={36}
                    sortColumns={sortColumns}
                    onSortColumnsChange={(next) => {
                        setSortColumns(next);
                        setPageIndex(0);
                    }}
                    className={styles.root}
                    aria-busy={loading || undefined}
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
                        <DataGrid.Body className={styles.body(loading)}>
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
                                                />
                                            )}
                                        </DataGrid.Cells>
                                    </DataGrid.Row>
                                )}
                            </DataGrid.Rows>
                        </DataGrid.Body>
                    </DataGrid.Grid>
                </DataGrid.Root>
                <RequestLog />
            </div>
            <nav className={styles.pager} aria-label="Pages">
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    aria-label="Previous page"
                    disabled={pageIndex === 0}
                    onClick={() =>
                        setPageIndex((index) => Math.max(0, index - 1))
                    }
                >
                    <ChevronLeft aria-hidden />
                </Clickable.Button>
                <span className={styles.pageOf} data-testid="page">
                    Page {pageIndex + 1} of {pages}
                </span>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    aria-label="Next page"
                    disabled={pageIndex >= pages - 1}
                    onClick={() =>
                        setPageIndex((index) => Math.min(pages - 1, index + 1))
                    }
                >
                    <ChevronRight aria-hidden />
                </Clickable.Button>
            </nav>
        </div>
    );
}

/** What the app asked the server, newest first. */
function RequestLog() {
    const log = useSyncExternalStore(
        api.subscribe,
        () => api.log,
        () => api.log,
    );
    return (
        <aside className={styles.log} aria-label="Requests">
            <p className={styles.logTitle}>
                {formatNumber(log.length)}{" "}
                {log.length === 1 ? "request" : "requests"}
            </p>
            <ol className={styles.logList} data-testid="request-log">
                {log
                    .slice(-12)
                    .reverse()
                    .map((request) => (
                        <li key={request.id} className={styles.logItem}>
                            {request.description}
                        </li>
                    ))}
            </ol>
        </aside>
    );
}
