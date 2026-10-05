"use client";

import {
    type ColumnOrGroup,
    DataGrid,
    type GridDirection,
    type HeaderCellInfo,
    headerCellContent,
    useColumnResizer,
} from "@fragiola/data-grid-react";
import { useId, useState } from "react";
import { Switch } from "#/components/ui/switch";
import { formatMoney, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(1_000);

// An Arabic table, read from the right: the name pinned at the start (the right edge), the
// salary at the end (the left edge), the columns between them resizable and reorderable, the
// email taking what a wide view leaves. The
// grid mirrors itself; the app's styles use logical sides (start and end) so they mirror too.
const columns: ColumnOrGroup<Person>[] = [
    {
        key: "name",
        name: "الاسم",
        width: 180,
        pinned: "start",
        resizable: true,
        minWidth: 120,
    },
    {
        key: "contact",
        name: "التواصل",
        reorderable: true,
        children: [
            {
                key: "email",
                name: "البريد الإلكتروني",
                width: 260,
                // the rest of a wide view: the salary pinned at its end edge
                flex: 1,
                resizable: true,
                reorderable: true,
            },
            {
                key: "city",
                name: "المدينة",
                width: 140,
                resizable: true,
                reorderable: true,
            },
        ],
    },
    {
        key: "team",
        name: "الفريق",
        width: 140,
        resizable: true,
        reorderable: true,
    },
    {
        key: "joined",
        name: "تاريخ الانضمام",
        width: 150,
        resizable: true,
        reorderable: true,
    },
    {
        key: "salary",
        name: "الراتب",
        width: 130,
        pinned: "end",
        resizable: true,
        renderCell: ({ row }) => formatMoney(row.salary),
        meta: { numeric: true },
    },
];

/**
 * A header cell's handle, at the edge it moves (`state.edge`): the end edge, the left one right to
 * left, dragged toward the end (to the left there) to grow its column; for the salary, pinned at
 * the end, its start edge, dragged toward the start.
 */
function Resizer({ cell }: { cell: HeaderCellInfo<Person> }) {
    const { state, props } = useColumnResizer(cell);
    if (!state.resizable) return null;
    const name = (cell.group ?? cell.column).name ?? cell.key;
    return (
        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the hook's props make it a separator, a focusable one (the APG's splitter), which an <hr> cannot be
        <div
            {...props}
            aria-label={`تغيير عرض ${name}`}
            className={styles.resizer(state)}
        />
    );
}

export default function RightToLeftExample() {
    const [direction, setDirection] = useState<GridDirection>("rtl");
    const directionLabel = useId();
    // the arrows follow the reading direction: the next column is to the left right to left
    const [next, previous] = direction === "rtl" ? ["←", "→"] : ["→", "←"];

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span className={styles.direction}>
                    <Switch.Root
                        aria-labelledby={directionLabel}
                        checked={direction === "rtl"}
                        onCheckedChange={(rtl) =>
                            setDirection(rtl ? "rtl" : "ltr")
                        }
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span id={directionLabel}>Right to left</span>
                </span>
                <span>
                    <kbd className={styles.key}>{next}</kbd> the next column,{" "}
                    <kbd className={styles.key}>{previous}</kbd> the previous
                    one
                </span>
                <span>
                    <kbd className={styles.key}>Ctrl</kbd>+
                    <kbd className={styles.key}>Shift</kbd>+
                    <kbd className={styles.key}>{next}</kbd> moves a header
                    toward the end
                </span>
            </div>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={36}
                direction={direction}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="الموظفون" className={styles.grid}>
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
