"use client";

import {
    type ColumnOrder,
    type ColumnOrGroup,
    DataGrid,
    type DataGridRef,
    type HeaderCellInfo,
    headerCellContent,
    useColumnResizer,
    useDataGridRef,
} from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import { ArrowDown, ArrowUp, GripVertical, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { formatMoney, type Person, people } from "../_kit/data";
import { activeHeaderKey, describeMove } from "./announce";
import * as styles from "./styles";

const all = people(1_000);

// "#" stays where it is declared: it is not reorderable (its siblings may still land beside it).
// Name and Team are pinned: they trade places with each other, never with the columns that
// scroll. A group moves whole, and its columns move inside it. Each column resizes too.
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
        reorderable: true,
        sortable: true,
        resizable: true,
    },
    {
        key: "team",
        name: "Team",
        width: 130,
        pinned: "start",
        reorderable: true,
        sortable: true,
        resizable: true,
    },
    {
        key: "contact",
        name: "Contact",
        reorderable: true,
        children: [
            {
                key: "email",
                name: "Email",
                width: 260,
                reorderable: true,
                resizable: true,
            },
            {
                key: "city",
                name: "City",
                width: 140,
                reorderable: true,
                sortable: true,
                resizable: true,
            },
        ],
    },
    {
        key: "employment",
        name: "Employment",
        reorderable: true,
        children: [
            {
                key: "joined",
                name: "Joined",
                width: 120,
                reorderable: true,
                sortable: true,
                resizable: true,
            },
            {
                key: "salary",
                name: "Salary",
                width: 130,
                reorderable: true,
                sortable: true,
                resizable: true,
                renderCell: ({ row }) => formatMoney(row.salary),
                meta: { numeric: true },
            },
        ],
    },
];

/** A column's resize handle, where it resizes: it works beside the drag that reorders. */
function Resizer({ cell }: { cell: HeaderCellInfo<Person> }) {
    const { state, props } = useColumnResizer(cell);
    if (!state.resizable) return null;
    return (
        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the hook's props make it a separator, a focusable one (the APG's splitter), which an <hr> cannot be
        <div
            {...props}
            aria-label={`Resize ${(cell.group ?? cell.column).name ?? cell.key}`}
            className={styles.resizer}
        />
    );
}

/**
 * A header cell: a grip where it can be dragged, its label, the sort's arrow and the resize
 * handle. The drop indicator and the dimmed dragged cell are its classes, from its `data-*`.
 */
function HeaderCell({ cell }: { cell: HeaderCellInfo<Person> }) {
    return (
        <DataGrid.HeaderCell
            cell={cell}
            className={styles.headerCell}
            render={(props, state) => (
                <div {...props}>
                    {state.reorderable && (
                        <GripVertical aria-hidden className={styles.grip} />
                    )}
                    <span className={styles.label}>
                        {headerCellContent(cell)}
                    </span>
                    {state.sortDirection === "ascending" ? (
                        <ArrowUp aria-hidden className={styles.sortIcon} />
                    ) : state.sortDirection === "descending" ? (
                        <ArrowDown aria-hidden className={styles.sortIcon} />
                    ) : null}
                    <Resizer cell={cell} />
                </div>
            )}
        />
    );
}

/**
 * Says what a move asked by the person (`moving`) did, once the grid shows it: from the grid's
 * own header before and after the change, whatever the order's rules made of it. Follows the
 * root the ref holds (a remount included).
 */
function useMoveAnnouncements(
    gridRef: DataGridRef<Person>,
    moving: { current: boolean },
    announce: (message: string) => void,
) {
    useEffect(() => {
        let unsubscribe = () => {};
        const follow = () => {
            unsubscribe();
            unsubscribe =
                gridRef.current?.model.subscribe(({ before, after }) => {
                    if (!moving.current || after.header === before.header) {
                        return;
                    }
                    moving.current = false;
                    const moved = describeMove(
                        before.header.rows,
                        after.header.rows,
                        activeHeaderKey(after),
                    );
                    if (moved) announce(moved);
                }) ?? (() => {});
        };
        follow();
        const stop = gridRef.subscribe(follow);
        return () => {
            stop();
            unsubscribe();
        };
    }, [gridRef, moving, announce]);
}

export default function ColumnReorderingExample() {
    // the grid moves the columns; the app keeps the order (to reset it, to save it) and says
    // what moved in its own words
    const [order, setOrder] = useState<ColumnOrder>([]);
    const [announcement, setAnnouncement] = useState("");
    const gridRef = useDataGridRef<Person>();
    // a move the person asked for: told once the grid shows it
    const moving = useRef(false);
    useMoveAnnouncements(gridRef, moving, setAnnouncement);
    // a click on a sortable header still sorts: the rows in memory, ordered by the app
    const local = useLocalRows(all, columns);

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span>
                    Drag a header, or <kbd className={styles.key}>Ctrl/⌘</kbd>
                    <kbd className={styles.key}>Shift</kbd>
                    <kbd className={styles.key}>←</kbd>
                    <kbd className={styles.key}>→</kbd> on one
                </span>
                <span>
                    <kbd className={styles.key}>Esc</kbd> while dragging cancels
                </span>
                {/* the app's live region: a polite status, its text the app's own */}
                <span role="status" className={styles.status}>
                    {announcement}
                </span>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    disabled={order.length === 0}
                    onClick={() => {
                        // the columns go back to the order they are declared in
                        setOrder([]);
                        setAnnouncement(
                            "Columns back in their declared order.",
                        );
                    }}
                >
                    <RotateCcw aria-hidden />
                    Reset order
                </Clickable.Button>
            </div>
            <DataGrid.Root
                columns={columns}
                rowKey={(row) => row.id}
                rowHeight={36}
                columnOrder={order}
                onColumnOrderChange={(next) => {
                    moving.current = true;
                    setOrder(next);
                }}
                gridRef={gridRef}
                className={styles.root}
                {...local.props}
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
                                        {(cell) => <HeaderCell cell={cell} />}
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
