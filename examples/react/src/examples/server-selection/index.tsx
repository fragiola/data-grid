"use client";

import {
    type Column,
    DataGrid,
    type RowKey,
    useDataGrid,
    useDataGridRef,
    useGridView,
} from "@fragiola/data-grid-react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import {
    createContext,
    use,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Checkbox } from "#/components/ui/checkbox";
import { formatNumber, type Person, person } from "../_kit/data";
import { createFakeApi } from "../_kit/fake-api";
import * as styles from "./styles";

const TOTAL = 10_000;
const PAGE_SIZE = 50;

/** The pretend server: it holds every person and sends a page at a time. */
const api = createFakeApi(300);

/**
 * The app's selection over the server's rows, never a list of ten thousand keys: every row but
 * `keys` (`all`), or only `keys`. The grid holds the page's part of it.
 */
interface Selection {
    readonly all: boolean;
    readonly keys: ReadonlySet<RowKey>;
}

const NONE: Selection = { all: false, keys: new Set() };

const isSelected = (selection: Selection, key: RowKey) =>
    selection.all !== selection.keys.has(key);

const countOf = (selection: Selection) =>
    selection.all ? TOTAL - selection.keys.size : selection.keys.size;

/** What a selection reads as in a request: what the server needs to act on it. */
const describe = (selection: Selection) =>
    selection.all
        ? selection.keys.size === 0
            ? "every person"
            : `every person but ${formatNumber(selection.keys.size)}`
        : `${formatNumber(selection.keys.size)} people`;

/** A row's checkbox: the grid toggles the row. */
function SelectRow({ rowIndex, name }: { rowIndex: number; name: string }) {
    const { model } = useDataGrid<Person>();
    // the view moves with the selection: the box follows
    useGridView();
    return (
        <Checkbox.Root
            aria-label={`Select ${name}`}
            checked={model.is("row-selected", { rowIndex })}
            onCheckedChange={() =>
                model.run("selected-rows.toggle", { rowIndex })
            }
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

/** The header's box: how many rows of the server's are selected, and what a click does. */
const SelectAllContext = createContext<{
    readonly count: number;
    readonly toggle: (checked: boolean) => void;
}>({ count: 0, toggle: () => {} });

/** The header's checkbox: every row of the server's, some (indeterminate) or none. */
function SelectAll() {
    const { count, toggle } = use(SelectAllContext);
    return (
        <Checkbox.Root
            aria-label="Select all"
            checked={count === TOTAL}
            indeterminate={count > 0 && count < TOTAL}
            onCheckedChange={toggle}
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

const columns: Column<Person>[] = [
    {
        key: "select",
        width: 48,
        renderHeaderCell: () => <SelectAll />,
        renderCell: ({ row, rowIndex }) => (
            <SelectRow rowIndex={rowIndex} name={row.name} />
        ),
    },
    { key: "id", name: "#", width: 80 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 260 },
    { key: "team", name: "Team", width: 120 },
];

export default function ServerSelection() {
    const [pageIndex, setPageIndex] = useState(0);
    const [rows, setRows] = useState<readonly Person[]>([]);
    const [selection, setSelection] = useState<Selection>(NONE);
    const [exported, setExported] = useState("");
    const gridRef = useDataGridRef<Person>();
    const grid = useDataGrid(gridRef);
    // the page on screen, for the selection's handler
    const page = useRef(rows);
    page.current = rows;

    useEffect(() => {
        let current = true;
        api.fetchPage(pageIndex, PAGE_SIZE, TOTAL, person).then((answer) => {
            if (current) setRows(answer);
        });
        return () => {
            current = false;
        };
    }, [pageIndex]);

    // "Select every row" (Ctrl/⌘+A, the header's box) is the server's: the grid only holds a
    // page, so a middleware turns the command into the app's own "all" before the grid selects
    // the page's rows (what it shows of it)
    useEffect(
        () =>
            grid?.model.use((ctx, next) => {
                if (ctx.command === "selected-rows.select-all") {
                    setSelection({ all: true, keys: new Set() });
                }
                return next();
            }),
        [grid],
    );

    const count = countOf(selection);
    const selectAll = useMemo(
        () => ({
            count,
            toggle: (checked: boolean) => {
                if (checked) grid?.model.run("selected-rows.select-all", {});
                else setSelection(NONE);
            },
        }),
        [count, grid],
    );

    // the grid's part of the selection: the page's selected rows
    const selectedRowKeys = useMemo(
        () =>
            rows
                .filter((row) => isSelected(selection, row.id))
                .map((row) => row.id),
        [rows, selection],
    );

    const pageSelected =
        rows.length > 0 && selectedRowKeys.length === rows.length;
    const pages = Math.ceil(TOTAL / PAGE_SIZE);

    return (
        <SelectAllContext value={selectAll}>
            <div className={styles.frame}>
                <div className={styles.toolbar}>
                    <span className={styles.count} data-testid="selected-count">
                        {formatNumber(count)} of {formatNumber(TOTAL)} selected
                    </span>
                    <Clickable.Button
                        size="sm"
                        variant="outline"
                        disabled={count === 0}
                        onClick={() => {
                            // the server gets the selection as the app keeps it, not ten thousand keys
                            const what = describe(selection);
                            api.fetchQuery(`export ${what}`, () => ({
                                rows: [],
                                total: count,
                            })).then(() => setExported(`Exported ${what}`));
                        }}
                    >
                        <Download aria-hidden />
                        Export
                    </Clickable.Button>
                    <span className={styles.exported} data-testid="exported">
                        {exported}
                    </span>
                </div>
                {selection.all ? (
                    <div className={styles.banner} data-testid="banner">
                        <span>
                            All {formatNumber(count)} people are selected
                            {selection.keys.size > 0
                                ? ` (${formatNumber(selection.keys.size)} left out)`
                                : ""}
                            .
                        </span>
                        <Clickable.Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelection(NONE)}
                        >
                            Clear selection
                        </Clickable.Button>
                    </div>
                ) : pageSelected ? (
                    <div className={styles.banner} data-testid="banner">
                        <span>
                            The {rows.length} people on this page are selected.
                        </span>
                        <Clickable.Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                                grid?.model.run("selected-rows.select-all", {})
                            }
                        >
                            Select all {formatNumber(TOTAL)}
                        </Clickable.Button>
                    </div>
                ) : null}
                <div className={styles.layout}>
                    <DataGrid.Root
                        columns={columns}
                        rows={rows}
                        rowKey={(row) => row.id}
                        rowHeight={40}
                        rowSelection="multiple"
                        selectedRowKeys={selectedRowKeys}
                        onSelectedRowKeysChange={(next) => {
                            // the page's rows as the grid has them now; the other pages' stay
                            const chosen = new Set(next);
                            setSelection((current) => {
                                const keys = new Set(current.keys);
                                for (const row of page.current) {
                                    // all: the keys are the rows left out; else the rows chosen
                                    if (chosen.has(row.id) !== current.all) {
                                        keys.add(row.id);
                                    } else keys.delete(row.id);
                                }
                                return { all: current.all, keys };
                            });
                        }}
                        gridRef={gridRef}
                        className={styles.root}
                    >
                        <DataGrid.Grid
                            aria-label="People"
                            className={styles.grid}
                        >
                            <DataGrid.Header className={styles.header}>
                                <DataGrid.HeaderRow
                                    className={styles.headerRow}
                                >
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
                            setPageIndex((index) =>
                                Math.min(pages - 1, index + 1),
                            )
                        }
                    >
                        <ChevronRight aria-hidden />
                    </Clickable.Button>
                </nav>
            </div>
        </SelectAllContext>
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
