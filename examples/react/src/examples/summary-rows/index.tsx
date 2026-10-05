"use client";

import {
    type Column,
    DataGrid,
    type SummaryPosition,
} from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import { Search } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { Input } from "#/components/atoms/fields";
import { formatMoney, formatNumber, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const all = people(500);

const columns: Column<Person>[] = [
    { key: "name", name: "Name", width: 190, pinned: "start", sortable: true },
    {
        key: "team",
        name: "Team",
        width: 130,
        sortable: true,
        // the bottom row's count of teams and cities spans both columns
        colSpan: (args) =>
            args.type === "summary" && args.position === "bottom"
                ? 2
                : undefined,
    },
    { key: "city", name: "City", width: 140, sortable: true },
    { key: "email", name: "Email", width: 260 },
    {
        key: "salary",
        name: "Salary",
        width: 130,
        sortable: true,
        renderCell: ({ row }) => formatMoney(row.salary),
    },
    { key: "joined", name: "Joined", width: 130, sortable: true },
];

/** What the summary rows show: the app's own figures, over the rows it shows. */
interface Totals {
    readonly count: number;
    readonly teams: number;
    readonly cities: number;
    readonly salary: number;
    readonly first: string;
    readonly last: string;
}

function totalsOf(rows: readonly Person[]): Totals {
    const joined = rows.map((person) => person.joined).sort();
    return {
        count: rows.length,
        teams: new Set(rows.map((person) => person.team)).size,
        cities: new Set(rows.map((person) => person.city)).size,
        salary: rows.reduce((sum, person) => sum + person.salary, 0),
        first: joined[0] ?? "",
        last: joined[joined.length - 1] ?? "",
    };
}

/**
 * What each column's summary cells show, by key: the top row averages, the bottom row totals.
 * They change as the search does: the summary cells render them (the columns stay the same).
 */
const SUMMARIES: Partial<
    Record<string, (totals: Totals, position: SummaryPosition) => ReactNode>
> = {
    name: (totals, position) =>
        position === "top"
            ? "Average"
            : `Total · ${formatNumber(totals.count)} people`,
    team: (totals, position) =>
        position === "bottom"
            ? `${totals.teams} teams in ${totals.cities} cities`
            : null,
    salary: (totals, position) =>
        totals.count === 0
            ? "—"
            : formatMoney(
                  position === "top"
                      ? Math.round(totals.salary / totals.count)
                      : totals.salary,
              ),
    joined: (totals, position) =>
        position === "bottom" && totals.count > 0
            ? `${totals.first.slice(0, 4)}–${totals.last.slice(0, 4)}`
            : null,
};

export default function SummaryRows() {
    // the rows in memory, searched and sorted by one hook; the totals follow what it leaves
    const local = useLocalRows(all, columns, {
        defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
    });
    const totals = useMemo(
        () => totalsOf(local.filteredRows),
        [local.filteredRows],
    );

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <Input.Template.Simple
                    aria-label="Search every column"
                    placeholder="Search"
                    value={local.filter.search}
                    onValueChange={local.filter.setSearch}
                    inset={{
                        start: <Search aria-hidden className={styles.icon} />,
                    }}
                    className={styles.search}
                />
            </div>
            <DataGrid.Root
                {...local.props}
                columns={columns}
                rowKey={(row) => row.id}
                rowHeight={36}
                summaryRows={{ top: 1, bottom: 1 }}
                summaryRowHeight={38}
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
                    <Summary position="top" totals={totals} />
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
                    {/* after the body: it stays at the view's bottom edge */}
                    <Summary position="bottom" totals={totals} />
                </DataGrid.Grid>
            </DataGrid.Root>
        </div>
    );
}

/**
 * A position's summary rows: sticky, opaque, above the rows that scroll under them. Each cell
 * shows the app's figure for its column, read here as it renders.
 */
function Summary({
    position,
    totals,
}: {
    position: SummaryPosition;
    totals: Totals;
}) {
    return (
        <DataGrid.Summary position={position} className={styles.summary}>
            <DataGrid.SummaryRows>
                {(row) => (
                    <DataGrid.SummaryRow
                        row={row}
                        className={styles.summaryRow}
                    >
                        <DataGrid.SummaryCells<Person>>
                            {(cell) => (
                                <DataGrid.SummaryCell
                                    cell={cell}
                                    className={styles.summaryCell}
                                >
                                    {SUMMARIES[cell.column.key]?.(
                                        totals,
                                        cell.position,
                                    )}
                                </DataGrid.SummaryCell>
                            )}
                        </DataGrid.SummaryCells>
                    </DataGrid.SummaryRow>
                )}
            </DataGrid.SummaryRows>
        </DataGrid.Summary>
    );
}
