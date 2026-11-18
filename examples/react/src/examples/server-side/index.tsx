"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import {
    type ColumnFilters,
    filtering,
} from "@fragiola/data-grid-react/filtering";
import { navigation } from "@fragiola/data-grid-react/navigation";
import { pageCount, pagination } from "@fragiola/data-grid-react/pagination";
import { search } from "@fragiola/data-grid-react/search";
import { type SortColumn, sorting } from "@fragiola/data-grid-react/sorting";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { Select } from "#/components/ui/select";
import { formatMoney, formatNumber, type Person } from "../_kit/data";
import { fetchPeople, peopleApi } from "../_kit/people-server";
import { createServerQuery } from "../_kit/server-query";
import * as styles from "./styles";

// the features the grid installs: sorting (without it, a sortable column never sorts), filtering,
// search and pagination (the column filters, the search text and the page, held by the grid's
// model: the app reads them to ask the server, no rows in memory), cell navigation (the keys, the
// active cell, the tab stop)
const FEATURES = [sorting(), filtering(), search(), pagination(), navigation()];

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

/** The team a filter holds: a list of one, the team chosen from the select. */
function teamOf(columnFilters: ColumnFilters): string {
    const team = columnFilters.team;
    return Array.isArray(team) && typeof team[0] === "string" ? team[0] : "";
}

export default function ServerSide() {
    // the external mode: the grid's features hold the sort (the header toggles it), the column
    // filters, the search text and the page, controlled here; the app asks the server for the
    // page they make (the fetch policy in `_kit/server-query.ts`) and the grid shows it
    const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([
        { columnKey: "name", direction: "ascending" },
    ]);
    const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
    const [typed, setTyped] = useState("");
    const [searchText, setSearchText] = useState("");
    const [pageIndex, setPageIndex] = useState(0);
    const [query] = useState(() => createServerQuery(fetchPeople));
    const { answer, loading } = useSyncExternalStore(
        query.subscribe,
        () => query.state,
        () => query.state,
    );
    const page = answer ?? { rows: [], total: 0 };

    // the search goes to the server once the typing pauses (and only when it changed: a page
    // chosen meanwhile stays)
    useEffect(() => {
        if (typed === searchText) return;
        const timer = setTimeout(() => {
            setSearchText(typed);
            setPageIndex(0);
        }, 250);
        return () => clearTimeout(timer);
    }, [typed, searchText]);

    useEffect(() => {
        query.ask({
            sortColumns,
            columnFilters,
            searchText,
            pageIndex,
            pageSize: PAGE_SIZE,
        });
    }, [query, sortColumns, columnFilters, searchText, pageIndex]);

    const pages = pageCount(page.total, PAGE_SIZE);
    const team = teamOf(columnFilters);

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
                        // a team chosen from a list: an exact value (a list filter), not a text
                        setColumnFilters(
                            typeof choice === "string" && choice !== "any"
                                ? { team: [choice] }
                                : {},
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
                    features={FEATURES}
                    columns={columns}
                    rows={page.rows}
                    rowKey={(row) => row.id}
                    rowHeight={36}
                    sortColumns={sortColumns}
                    onSortColumnsChange={(next) => {
                        setSortColumns(next);
                        setPageIndex(0);
                    }}
                    columnFilters={columnFilters}
                    onColumnFiltersChange={(next) => {
                        setColumnFilters(next);
                        setPageIndex(0);
                    }}
                    searchText={searchText}
                    onSearchTextChange={(next) => {
                        setTyped(next);
                        setSearchText(next);
                        setPageIndex(0);
                    }}
                    pageIndex={pageIndex}
                    onPageIndexChange={setPageIndex}
                    pageSize={PAGE_SIZE}
                    totalRowCount={page.total}
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
        peopleApi.subscribe,
        () => peopleApi.log,
        () => peopleApi.log,
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
