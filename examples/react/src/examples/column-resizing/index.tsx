"use client";

import {
    type ColumnOrGroup,
    type ColumnWidths,
    DataGrid,
    type DataGridRef,
    type HeaderCellInfo,
    headerCellContent,
    useColumnResizer,
    useDataGrid,
    useDataGridRef,
} from "@fragiola/data-grid-react";
import { RotateCcw } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(1_000);

// "#" keeps its width (not resizable); the others resize within their limits (40px at least by
// default). Name is pinned, and a group's handle resizes its columns together.
const columns: ColumnOrGroup<Person>[] = [
    {
        key: "id",
        name: "#",
        width: 64,
        pinned: "start",
        meta: { numeric: true },
    },
    {
        key: "name",
        name: "Name",
        width: 180,
        pinned: "start",
        resizable: true,
        minWidth: 120,
        maxWidth: 320,
    },
    {
        key: "contact",
        name: "Contact",
        children: [
            {
                key: "email",
                name: "Email",
                width: 240,
                resizable: true,
                minWidth: 160,
            },
            { key: "city", name: "City", width: 140, resizable: true },
        ],
    },
    {
        key: "work",
        name: "Work",
        children: [
            {
                key: "team",
                name: "Team",
                width: 120,
                resizable: true,
                minWidth: 80,
                maxWidth: 200,
            },
            { key: "joined", name: "Joined", width: 120, resizable: true },
            {
                key: "salary",
                name: "Salary",
                width: 120,
                resizable: true,
                minWidth: 90,
                maxWidth: 180,
                renderCell: ({ row }) => formatMoney(row.salary),
                meta: { numeric: true },
            },
        ],
    },
];

/** Every column's and group's name by key, for the readout. */
function namesOf(
    entries: readonly ColumnOrGroup<Person>[],
): Map<string, string> {
    const names = new Map<string, string>();
    const visit = (list: readonly ColumnOrGroup<Person>[]) => {
        for (const entry of list) {
            names.set(entry.key, entry.name ?? entry.key);
            if (entry.children) visit(entry.children);
        }
    };
    visit(entries);
    return names;
}

const NAMES = namesOf(columns);

/**
 * A header cell's handle: the hook's props on an element of the app's, which gives it its name,
 * its place and its look. Under a cell that does not resize, there is none.
 */
function Resizer({ cell }: { cell: HeaderCellInfo<Person> }) {
    const { state, props } = useColumnResizer(cell);
    if (!state.resizable) return null;
    const name = (cell.group ?? cell.column).name ?? cell.key;
    return (
        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the hook's props make it a separator, a focusable one (the APG's splitter), which an <hr> cannot be
        <div
            {...props}
            aria-label={`Resize ${name}`}
            className={styles.resizer}
        />
    );
}

/** The column a person is dragging, through the grid's ref: `engine.get("column-resize")`. */
function useDragged(gridRef: DataGridRef<Person>) {
    const engine = useDataGrid(gridRef)?.engine;
    const subscribe = useMemo(
        () => (listener: () => void) =>
            engine ? engine.subscribe("column-resize", listener) : () => {},
        [engine],
    );
    const read = () => engine?.get("column-resize") ?? null;
    return useSyncExternalStore(subscribe, read, read);
}

/** What changed: the column being dragged, else the widths the app keeps. */
function WidthsReadout({
    gridRef,
    widths,
}: {
    gridRef: DataGridRef<Person>;
    widths: ColumnWidths;
}) {
    const dragged = useDragged(gridRef);
    const resized = Object.entries(widths);
    return (
        <span className={styles.readout} data-testid="widths">
            {dragged
                ? `Resizing ${NAMES.get(dragged.columnKey)} to ${dragged.width}px`
                : resized.length === 0
                  ? "Every column at its own width"
                  : resized
                        .map(([key, width]) => `${NAMES.get(key)} ${width}px`)
                        .join(" · ")}
        </span>
    );
}

export default function ColumnResizingExample() {
    // the grid resizes; the app keeps the widths (to show them, to reset them, to save them)
    const [widths, setWidths] = useState<ColumnWidths>({});
    const gridRef = useDataGridRef<Person>();

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span>
                    <kbd className={styles.key}>F2</kbd> on a header, then{" "}
                    <kbd className={styles.key}>←</kbd>
                    <kbd className={styles.key}>→</kbd> (
                    <kbd className={styles.key}>Shift</kbd> by 50)
                </span>
                <span>
                    <kbd className={styles.key}>Esc</kbd> while dragging
                    cancels, a double click resets
                </span>
                <WidthsReadout gridRef={gridRef} widths={widths} />
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    disabled={Object.keys(widths).length === 0}
                    // the columns go back to their own `width`
                    onClick={() => setWidths({})}
                >
                    <RotateCcw aria-hidden />
                    Reset widths
                </Clickable.Button>
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
            >
                <DataGrid.Grid aria-label="People" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRows<Person>>
                            {(row) => (
                                <DataGrid.HeaderRow
                                    row={row}
                                    className={styles.headerRow}
                                >
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
                            )}
                        </DataGrid.HeaderRows>
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
