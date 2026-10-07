"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Switch } from "#/components/ui/switch";
import { formatMoney, type Person, person } from "../_kit/data";
import * as styles from "./styles";

const COUNT = 40;
/** the skeleton rows the first load shows: about a screen's worth */
const SKELETON_ROWS = 12;
const LATENCY = 700;

/**
 * The app's request: the people after a delay, or a failure when asked to fail. Swap it for a
 * `fetch` to your API; the states below do not change.
 */
function fetchPeople(fail: boolean): Promise<Person[]> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (fail) reject(new Error("The server did not answer."));
            else resolve(Array.from({ length: COUNT }, (_, i) => person(i)));
        }, LATENCY);
    });
}

const columns: Column<Person>[] = [
    { key: "id", name: "#", width: 64 },
    { key: "name", name: "Name", width: 180 },
    { key: "email", name: "Email", width: 260 },
    { key: "city", name: "City", width: 130 },
    {
        key: "salary",
        name: "Salary",
        width: 120,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
];

/** What the app knows of its rows: nothing yet, some, and whether a request runs or failed. */
interface LoadState {
    readonly rows: readonly Person[] | null;
    readonly loading: boolean;
    readonly error: string | null;
}

export default function LoadingStates() {
    const [state, setState] = useState<LoadState>({
        rows: null,
        loading: true,
        error: null,
    });
    // the next request fails: the app's switch, to see the error states
    const [failNext, setFailNext] = useState(false);
    const failRef = useRef(failNext);
    failRef.current = failNext;
    const request = useRef(0);
    const failLabel = useId();

    /** Requests the rows; `fresh` drops the ones on screen first (a first load again). */
    const load = useCallback((fresh = false) => {
        // an answer to a request the app has moved on from is dropped
        const id = ++request.current;
        setState((current) => ({
            rows: fresh ? null : current.rows,
            loading: true,
            error: null,
        }));
        fetchPeople(failRef.current).then(
            (rows) => {
                if (id === request.current) {
                    setState({ rows, loading: false, error: null });
                }
            },
            (error: Error) => {
                if (id === request.current) {
                    setState((current) => ({
                        ...current,
                        loading: false,
                        error: error.message,
                    }));
                }
            },
        );
    }, []);

    useEffect(() => {
        load();
        // a request still running when the example goes away is dropped
        return () => {
            request.current += 1;
        };
    }, [load]);

    const { rows, loading, error } = state;
    // the first load: skeleton rows, every one "not loaded yet" (`data-loading`); a failed one,
    // none (the empty state shows the error); then the rows, kept through a refetch
    const rowCount = rows ? rows.length : error ? 0 : SKELETON_ROWS;
    const getRow = useMemo(() => (index: number) => rows?.[index], [rows]);
    const refreshing = loading && rows !== null;

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => load()}
                >
                    <RefreshCw aria-hidden />
                    Refetch
                </Clickable.Button>
                <Clickable.Button
                    size="sm"
                    variant="ghost"
                    disabled={loading}
                    onClick={() => load(true)}
                >
                    Start over
                </Clickable.Button>
                <span className={styles.fail}>
                    <Switch.Root
                        aria-labelledby={failLabel}
                        checked={failNext}
                        onCheckedChange={setFailNext}
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span id={failLabel}>Fail the next request</span>
                </span>
                <span
                    className={styles.status}
                    data-testid="status"
                    aria-live="polite"
                >
                    {loading
                        ? rows
                            ? "Refreshing…"
                            : "Loading…"
                        : error
                          ? "Failed"
                          : `${rows?.length ?? 0} people`}
                </span>
            </div>
            {error && rows ? (
                // a refetch that failed: the rows stay, the error and its retry above them
                <div
                    className={styles.banner}
                    role="alert"
                    data-testid="banner"
                >
                    <TriangleAlert aria-hidden size={16} />
                    <span>Could not refresh: {error}</span>
                    <Clickable.Button
                        size="sm"
                        variant="ghost"
                        onClick={() => load()}
                    >
                        Retry
                    </Clickable.Button>
                </div>
            ) : null}
            <DataGrid.Root
                columns={columns}
                rowCount={rowCount}
                getRow={getRow}
                rowKey={(row) => row.id}
                rowHeight={36}
                className={styles.root}
            >
                <DataGrid.Grid
                    aria-label="People"
                    aria-busy={loading || undefined}
                    className={styles.grid}
                >
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
                    <DataGrid.Body className={styles.body(refreshing)}>
                        <DataGrid.Rows<Person>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
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
                    {/* the first load failed: the error and its retry, in the grid's own cell */}
                    <DataGrid.Empty
                        className={styles.error}
                        data-testid="error"
                    >
                        <TriangleAlert aria-hidden size={28} />
                        <p className={styles.errorTitle}>
                            The people could not be loaded
                        </p>
                        <p className={styles.errorText}>{error}</p>
                        <Clickable.Button
                            size="sm"
                            disabled={loading}
                            onClick={() => load()}
                        >
                            <RefreshCw aria-hidden />
                            Retry
                        </Clickable.Button>
                    </DataGrid.Empty>
                </DataGrid.Grid>
            </DataGrid.Root>
        </div>
    );
}
