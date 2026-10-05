"use client";

import {
    type Column,
    type ColumnOrGroup,
    DataGrid,
    type HeaderCellInfo,
    headerCellContent,
    useDataGrid,
    useDataGridRef,
    useGroupLabel,
    useHeaderCell,
} from "@fragiola/data-grid-react";
import { ChevronRight } from "lucide-react";
import { Clickable } from "#/components/atoms/clickable";
import { formatNumber, measurement, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(500);

const YEARS = [2025, 2026];
const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

/** A rep's sales in a month (0–1,000 units), from the rep and the month. */
const sales = (row: Person, year: number, month: number) =>
    Math.round(measurement(row.id, (year - 2025) * 12 + month) * 10);

/** The sales of a range of months: a quarter's, a year's. */
const sum = (row: Person, year: number, from: number, to: number) => {
    let total = 0;
    for (let month = from; month < to; month++) {
        total += sales(row, year, month);
    }
    return total;
};

const units = (value: unknown) =>
    typeof value === "number" ? formatNumber(value) : null;

/**
 * A quarter: its three months while it is open, its total always (the column a closed quarter
 * keeps). A month shows only expanded (`groupShow`).
 */
function quarter(year: number, index: number): ColumnOrGroup<Person> {
    const first = index * 3;
    const months: Column<Person>[] = [0, 1, 2].map((offset) => ({
        key: `${year}-${first + offset + 1}`,
        name: MONTHS[first + offset],
        width: 76,
        groupShow: "expanded",
        getValue: (row) => sales(row, year, first + offset),
        renderCell: ({ value }) => units(value),
        meta: { numeric: true },
    }));
    return {
        key: `${year}-q${index + 1}`,
        name: `Q${index + 1}`,
        collapsible: true,
        groupShow: "expanded",
        children: [
            ...months,
            {
                key: `${year}-q${index + 1}-total`,
                name: "Total",
                width: 88,
                getValue: (row) => sum(row, year, first, first + 3),
                renderCell: ({ value }) => units(value),
                meta: { numeric: true, total: true },
            },
        ],
    };
}

/** A year: its quarters while it is open, its total while it is closed. */
function year(value: number): ColumnOrGroup<Person> {
    return {
        key: String(value),
        name: String(value),
        collapsible: true,
        children: [
            ...[0, 1, 2, 3].map((index) => quarter(value, index)),
            {
                key: `${value}-total`,
                name: "Total",
                width: 96,
                groupShow: "collapsed",
                getValue: (row) => sum(row, value, 0, 12),
                renderCell: ({ value: total }) => units(total),
                meta: { numeric: true, total: true },
            },
        ],
    };
}

// the rep pinned at the start, then each year under its quarters and months: three header rows
const columns: ColumnOrGroup<Person>[] = [
    { key: "name", name: "Rep", width: 180, pinned: "start" },
    ...YEARS.map(year),
];

/** Every collapsible group's key: what "Collapse all" collapses. */
const ALL_GROUPS = YEARS.flatMap((value) => [
    String(value),
    ...[1, 2, 3, 4].map((index) => `${value}-q${index}`),
]);

/**
 * A group's header: its label, which stays in view while the group scrolls (`useGroupLabel`),
 * holding the toggle that opens and closes it (the app's own button, the grid's command).
 */
function GroupHeader({ cell }: { cell: HeaderCellInfo<Person> }) {
    const { model } = useDataGrid<Person>();
    const { state } = useHeaderCell(cell);
    const label = useGroupLabel(cell);
    return (
        <span {...label.props} className={styles.label}>
            {state.collapsed === undefined ? null : (
                <button
                    type="button"
                    aria-label={cell.group?.name}
                    aria-expanded={!state.collapsed}
                    className={styles.toggle}
                    onClick={() =>
                        model.run("column-groups.toggle", {
                            groupKey: cell.key,
                        })
                    }
                >
                    <ChevronRight aria-hidden />
                </button>
            )}
            {headerCellContent(cell)}
        </span>
    );
}

export default function CollapsibleGroups() {
    const gridRef = useDataGridRef<Person>();
    const setCollapsed = (groupKeys: readonly string[]) =>
        gridRef.current?.model.run("column-groups.set", { groupKeys });

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span>Open a year or a quarter from its header</span>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    className={styles.toolbarStart}
                    onClick={() => setCollapsed([])}
                >
                    Expand all
                </Clickable.Button>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCollapsed(ALL_GROUPS)}
                >
                    Collapse all
                </Clickable.Button>
            </div>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={34}
                // 2025 starts closed, its total showing; 2026 open, its first quarter closed
                defaultCollapsedGroupKeys={["2025", "2026-q1"]}
                gridRef={gridRef}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="Sales" className={styles.grid}>
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
                                                {cell.group ? (
                                                    <GroupHeader cell={cell} />
                                                ) : undefined}
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
                                                    cell.column.meta?.total
                                                        ? styles.total
                                                        : cell.column.meta
                                                                ?.numeric
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
