"use client";

import {
    type Column,
    type ColumnWidths,
    DataGrid,
    type DataGridRef,
    type HeaderCellInfo,
    headerCellContent,
    useColumnResizer,
    useDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-react";
import { RotateCcw, WandSparkles } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(1_000);

// Name fits its content once, when its first rows render (`autoSize`). Email and City share what
// the other columns leave of the grid's width, two parts and one, never below their `width` (City
// at most 240px). Every column but "#" resizes: a person's width replaces the automatic one.
const columns: Column<Person>[] = [
    { key: "id", name: "#", width: 64, meta: { numeric: true } },
    {
        key: "name",
        name: "Name",
        width: 140,
        autoSize: true,
        resizable: true,
        minWidth: 120,
    },
    {
        key: "email",
        name: "Email",
        width: 220,
        flex: 2,
        resizable: true,
        minWidth: 160,
    },
    {
        key: "city",
        name: "City",
        width: 120,
        flex: 1,
        resizable: true,
        maxWidth: 240,
    },
    { key: "team", name: "Team", width: 140, resizable: true },
    {
        key: "salary",
        name: "Salary",
        width: 120,
        resizable: true,
        minWidth: 90,
        renderCell: ({ row }) => formatMoney(row.salary),
        meta: { numeric: true },
    },
];

const NAMES = new Map(columns.map((column) => [column.key, column.name]));

/** `{ email: 310 }` → `Email 310px`, in the columns' order. */
function describe(widths: ColumnWidths): string {
    return columns
        .flatMap((column) => {
            const width = widths[column.key];
            return width === undefined
                ? []
                : [`${NAMES.get(column.key)} ${width}px`];
        })
        .join(" · ");
}

/** A header cell's handle: the hook's props on an element of the app's. */
function Resizer({ cell }: { cell: HeaderCellInfo<Person> }) {
    const { state, props } = useColumnResizer(cell);
    if (!state.resizable) return null;
    return (
        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the hook's props make it a separator, a focusable one (the APG's splitter), which an <hr> cannot be
        <div
            {...props}
            aria-label={`Resize ${cell.column?.name ?? cell.key}`}
            className={styles.resizer}
        />
    );
}

/** The widths the grid gives columns itself, through its ref: `engine.get("column-auto-widths")`. */
function useAutoWidths(gridRef: DataGridRef<Person>): ColumnWidths {
    const engine = useDataGrid(gridRef)?.engine;
    const subscribe = useMemo(
        () => (listener: () => void) =>
            engine
                ? engine.subscribe("column-auto-widths", listener)
                : () => {},
        [engine],
    );
    const read = () => engine?.get("column-auto-widths") ?? NONE;
    return useSyncExternalStore(subscribe, read, read);
}

const NONE: ColumnWidths = {};

export default function AutoWidthsExample() {
    // the grid sizes Name, Email and City itself; the app keeps only what a person sets
    const [widths, setWidths] = useState<ColumnWidths>({});
    // the grid's width, as a share of the frame: flex columns follow it
    const [share, setShare] = useState(100);
    const gridRef = useDataGridRef<Person>();
    const automatic = useAutoWidths(gridRef);

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <label className={styles.slider}>
                    Grid width
                    <input
                        type="range"
                        min={50}
                        max={100}
                        step={5}
                        value={share}
                        onChange={(event) =>
                            setShare(Number(event.target.value))
                        }
                        className={styles.range}
                    />
                    <span className={styles.sliderValue}>{share}%</span>
                </label>
                <span>
                    A double click on a handle (or{" "}
                    <kbd className={styles.key}>F2</kbd>, then{" "}
                    <kbd className={styles.key}>Enter</kbd>) fits its column
                </span>
                <span className={styles.buttons}>
                    <Clickable.Button
                        size="sm"
                        variant="outline"
                        // every rendered resizable column, measured, in one change
                        onClick={() =>
                            gridRef.current?.engine.run("fit-columns", {})
                        }
                    >
                        <WandSparkles aria-hidden />
                        Fit all
                    </Clickable.Button>
                    <Clickable.Button
                        size="sm"
                        variant="outline"
                        disabled={Object.keys(widths).length === 0}
                        // back to the grid's widths: Name's fit, the flex shares, the others' own
                        onClick={() => setWidths({})}
                    >
                        <RotateCcw aria-hidden />
                        Reset widths
                    </Clickable.Button>
                </span>
            </div>
            <div className={styles.readouts}>
                <span className={styles.readout} data-testid="auto-widths">
                    {`By the grid: ${describe(automatic) || "none"}`}
                </span>
                <span className={styles.readout} data-testid="widths">
                    {`Set by a person: ${describe(widths) || "none"}`}
                </span>
            </div>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={36}
                columnWidths={widths}
                onColumnWidthsChange={setWidths}
                gridRef={gridRef}
                className={styles.root}
                style={{ width: `${share}%` }}
            >
                <DataGrid.Grid aria-label="People" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Person>>
                                {(cell) => (
                                    <DataGrid.HeaderCell
                                        cell={cell}
                                        className={styles.headerCell}
                                    >
                                        {/* its own content, then its handle */}
                                        {headerCellContent(cell)}
                                        <Resizer cell={cell} />
                                    </DataGrid.HeaderCell>
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
                                                className={
                                                    cell.column.meta?.numeric
                                                        ? styles.numeric
                                                        : styles.cell
                                                }
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
