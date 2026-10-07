"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { useLocalRows } from "@fragiola/data-grid-react/local";
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Search,
} from "lucide-react";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { Checkbox } from "#/components/ui/checkbox";
import { Select } from "#/components/ui/select";
import { formatMoney, formatNumber, type Person, people } from "../_kit/data";
import * as styles from "./styles";

const all = people(1_000);

const TEAMS = [...new Set(all.map((person) => person.team))].sort();

/** The salary filter's choices: a minimum, or none. */
const SALARIES: Record<string, string> = {
    any: "Any salary",
    "60000": "From $60k",
    "90000": "From $90k",
    "120000": "From $120k",
};

const PAGE_SIZES: Record<string, string> = {
    "25": "25 a page",
    "50": "50 a page",
    "100": "100 a page",
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
        // its own filter: a minimum, not an equal value
        filter: (value, minimum) =>
            typeof value === "number" &&
            typeof minimum === "number" &&
            value >= minimum,
    },
    { key: "joined", name: "Joined", width: 130, sortable: true },
];

export default function LocalRows() {
    // every row is in memory: one hook filters, searches, sorts and pages them, and keeps that
    // state itself. Its props go to the grid, its controls to the toolbar and the pager
    const local = useLocalRows(all, columns, {
        pageSize: 25,
        defaultSortColumns: [{ columnKey: "name", direction: "ascending" }],
    });
    const teams = local.filter.values.team;
    const checkedTeams: readonly unknown[] = Array.isArray(teams) ? teams : [];
    const minimum = local.filter.values.salary;
    const toggleTeam = (team: string) =>
        local.filter.set(
            "team",
            checkedTeams.includes(team)
                ? checkedTeams.filter((checked) => checked !== team)
                : [...checkedTeams, team],
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
                <Input.Template.Simple
                    aria-label="Name contains"
                    placeholder="Name contains"
                    value={
                        typeof local.filter.values.name === "string"
                            ? local.filter.values.name
                            : ""
                    }
                    onValueChange={(name) => local.filter.set("name", name)}
                    className={styles.nameFilter}
                />
                <Select.Root
                    items={SALARIES}
                    value={
                        typeof minimum === "number" ? String(minimum) : "any"
                    }
                    onValueChange={(choice) =>
                        local.filter.set(
                            "salary",
                            choice === "any" || choice === null
                                ? undefined
                                : Number(choice),
                        )
                    }
                >
                    <Select.Trigger
                        className={styles.select}
                        aria-label="Salary"
                    >
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        {Object.entries(SALARIES).map(([value, label]) => (
                            <Select.Item key={value} value={value}>
                                {label}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
                <fieldset className={styles.teams}>
                    <legend className={styles.teamsTitle}>Teams</legend>
                    {TEAMS.map((team) => (
                        // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox.Root renders the control
                        <label key={team} className={styles.team}>
                            <Checkbox.Root
                                checked={checkedTeams.includes(team)}
                                onCheckedChange={() => toggleTeam(team)}
                            >
                                <Checkbox.Indicator />
                            </Checkbox.Root>
                            {team}
                        </label>
                    ))}
                </fieldset>
                <Clickable.Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                        local.filter.clear();
                        local.filter.setSearch("");
                    }}
                >
                    Clear filters
                </Clickable.Button>
                <span className={styles.count} data-testid="count">
                    {formatNumber(local.filteredCount)} of{" "}
                    {formatNumber(local.total)} people
                </span>
            </div>
            <DataGrid.Root
                columns={columns}
                rowKey={(row) => row.id}
                rowHeight={36}
                className={styles.root}
                {...local.props}
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
                    {/* the grid's cell while it has no rows: the content laid out in it */}
                    <DataGrid.Empty
                        className={styles.empty}
                        data-testid="empty"
                    >
                        No one matches these filters.
                    </DataGrid.Empty>
                </DataGrid.Grid>
            </DataGrid.Root>
            <nav className={styles.pager} aria-label="Pages">
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    aria-label="First page"
                    disabled={!local.page.canPrevious}
                    onClick={local.page.first}
                >
                    <ChevronsLeft aria-hidden />
                </Clickable.Button>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    aria-label="Previous page"
                    disabled={!local.page.canPrevious}
                    onClick={local.page.previous}
                >
                    <ChevronLeft aria-hidden />
                </Clickable.Button>
                <span className={styles.pageOf} data-testid="page">
                    Page {local.page.index + 1} of {local.page.count}
                </span>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    aria-label="Next page"
                    disabled={!local.page.canNext}
                    onClick={local.page.next}
                >
                    <ChevronRight aria-hidden />
                </Clickable.Button>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    aria-label="Last page"
                    disabled={!local.page.canNext}
                    onClick={local.page.last}
                >
                    <ChevronsRight aria-hidden />
                </Clickable.Button>
                <Select.Root
                    items={PAGE_SIZES}
                    value={String(local.page.size)}
                    onValueChange={(size) => {
                        // a cleared choice keeps the page size
                        if (typeof size === "string")
                            local.page.setSize(Number(size));
                    }}
                >
                    <Select.Trigger
                        className={styles.select}
                        aria-label="Rows per page"
                    >
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        {Object.entries(PAGE_SIZES).map(([value, label]) => (
                            <Select.Item key={value} value={value}>
                                {label}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
            </nav>
        </div>
    );
}
