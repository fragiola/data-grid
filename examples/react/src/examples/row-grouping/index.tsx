"use client";

import {
    type CellInfo,
    type Column,
    DataGrid,
    type GroupRow,
    type RowKey,
    useDataGrid,
    useGridView,
    useGroupToggle,
} from "@fragiola/data-grid-react";
import { groupKeyOf, useLocalRows } from "@fragiola/data-grid-react/local";
import { useSelectAll } from "@fragiola/data-grid-react/selection";
import { ChevronRight, Search } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { Checkbox } from "#/components/ui/checkbox";
import { Select } from "#/components/ui/select";
import { formatMoney, formatNumber, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const ROWS = people(500);

/** The groupings the toolbar offers, and the columns each one groups by, the outer one first. */
const GROUPINGS = {
    team: "By team",
    "team-city": "By team, then city",
} as const;

type Grouping = keyof typeof GROUPINGS;

const GROUP_BY: Record<Grouping, readonly string[]> = {
    team: ["team"],
    "team-city": ["team", "city"],
};

/** What a group row shows in these columns: the app's figures over the group's rows. */
const AGGREGATES = {
    salary: (rows: readonly Person[]) =>
        rows.reduce((sum, person) => sum + person.salary, 0),
    joined: (rows: readonly Person[]) => {
        const years = rows.map((person) => person.joined.slice(0, 4)).sort();
        return `${years[0]}–${years[years.length - 1]}`;
    },
};

/** A person's key: what the selection holds, and what selecting a group selects. */
const rowKey = (person: Person) => person.id;

/**
 * Who joined before 2012 is archived: never selected, by a checkbox, a group's, a range or "every
 * row" (the grid asks the rows it has; a group's keys leave them out, collapsed or not).
 */
const isSelectable = (person: Person) => person.joined >= "2012";

const columns: Column<Person>[] = [
    { key: "select", width: 44, pinned: "start" },
    { key: "name", name: "Name", width: 250, pinned: "start", sortable: true },
    { key: "team", name: "Team", width: 120, sortable: true },
    { key: "city", name: "City", width: 130, sortable: true },
    {
        key: "salary",
        name: "Salary",
        width: 140,
        sortable: true,
        renderCell: ({ row }) => formatMoney(row.salary),
        // a group row's salary is its payroll, the aggregate
        renderGroupCell: ({ value }) =>
            typeof value === "number" ? formatMoney(value) : null,
    },
    { key: "joined", name: "Joined", width: 120, sortable: true },
    { key: "email", name: "Email", width: 260 },
];

const NO_KEYS: readonly RowKey[] = [];

/** A person's checkbox: the grid toggles the row. */
function SelectRow({ rowIndex, name }: { rowIndex: number; name: string }) {
    const { model } = useDataGrid<Person>();
    // the view moves with the selection: the box follows
    useGridView();
    return (
        <Checkbox.Root
            aria-label={`Select ${name}`}
            checked={model.is("row-selected", { rowIndex })}
            disabled={!model.is("row-selectable", { rowIndex })}
            onCheckedChange={() =>
                model.run("selected-rows.toggle", { rowIndex })
            }
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

/** A group's checkbox: all of its people, some of them (indeterminate) or none. */
function SelectGroup({
    rowIndex,
    group,
}: {
    rowIndex: number;
    group: GroupRow;
}) {
    const { model } = useDataGrid<Person>();
    const status = useSelectAll(group.rowKeys ?? NO_KEYS).status;
    return (
        <Checkbox.Root
            aria-label={`Select ${String(group.value)}`}
            checked={status === "all"}
            indeterminate={status === "some"}
            // the grid selects the group's rows, or clears them all
            onCheckedChange={() =>
                model.run("selected-rows.toggle", { rowIndex })
            }
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

/** A group row's label: its toggle, its value and how many people it holds. */
function GroupLabel({
    cell,
    group,
}: {
    cell: CellInfo<Person>;
    group: GroupRow;
}) {
    const { state, props } = useGroupToggle(cell);
    return (
        <span className={styles.groupLabel(group.depth)}>
            <button
                type="button"
                {...props}
                aria-label={`${state.expanded ? "Collapse" : "Expand"} ${String(group.value)}`}
                className={styles.toggle}
            >
                <ChevronRight
                    aria-hidden
                    className={styles.chevron(state.expanded)}
                />
            </button>
            <span className={styles.groupValue}>{String(group.value)}</span>
            <span className={styles.groupCount}>
                {formatNumber(group.childCount)}
            </span>
        </span>
    );
}

/** What a cell shows beyond its default: the checkboxes, a group's label, an indented name. */
function cellContent(cell: CellInfo<Person>, depth: number): ReactNode {
    const { group, row } = cell;
    if (cell.column.key === "select") {
        if (group)
            return <SelectGroup rowIndex={cell.rowIndex} group={group} />;
        return row ? (
            <SelectRow rowIndex={cell.rowIndex} name={row.name} />
        ) : null;
    }
    if (cell.column.key !== "name") return undefined;
    if (group) return <GroupLabel cell={cell} group={group} />;
    return <span className={styles.name(depth)}>{row?.name}</span>;
}

export default function RowGrouping() {
    const [grouping, setGrouping] = useState<Grouping>("team");
    const [selected, setSelected] = useState<readonly RowKey[]>([]);
    // the rows in memory searched, sorted and grouped by one hook; it keeps the expanded groups
    const local = useLocalRows(ROWS, columns, {
        groupBy: GROUP_BY[grouping],
        aggregates: AGGREGATES,
        rowKey,
        isRowSelectable: isSelectable,
        defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
        defaultExpandedGroupKeys: [groupKeyOf([["team", "Design"]])],
    });

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <Select.Root
                    items={GROUPINGS}
                    value={grouping}
                    onValueChange={(choice) => {
                        if (choice === "team" || choice === "team-city") {
                            setGrouping(choice);
                        }
                    }}
                >
                    <Select.Trigger
                        className={styles.select}
                        aria-label="Group rows"
                    >
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        {Object.entries(GROUPINGS).map(([value, label]) => (
                            <Select.Item key={value} value={value}>
                                {label}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
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
                <Clickable.Button
                    size="sm"
                    variant="ghost"
                    onClick={local.group.expandAll}
                >
                    Expand all
                </Clickable.Button>
                <Clickable.Button
                    size="sm"
                    variant="ghost"
                    onClick={local.group.collapseAll}
                >
                    Collapse all
                </Clickable.Button>
                <span className={styles.count} data-testid="selected-count">
                    {formatNumber(selected.length)} selected ·{" "}
                    {formatNumber(local.filteredCount)} people
                </span>
            </div>
            <DataGrid.Root
                {...local.props}
                columns={columns}
                rowHeight={38}
                rowSelection="multiple"
                isRowSelectable={isSelectable}
                selectedRowKeys={selected}
                onSelectedRowKeysChange={setSelected}
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
                    <DataGrid.Body>
                        <DataGrid.Rows<Person>>
                            {(row) => (
                                <DataGrid.Row
                                    row={row}
                                    className={(state) =>
                                        styles.row(
                                            state,
                                            row.row !== undefined &&
                                                !isSelectable(row.row),
                                        )
                                    }
                                >
                                    <DataGrid.Cells<Person>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                className={styles.cell}
                                            >
                                                {cellContent(cell, row.depth)}
                                            </DataGrid.Cell>
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
