"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Checkbox } from "#/components/ui/checkbox";
import { type Task, tasks } from "../_kit/tasks";
import { type Checked, counts, FACETS, filter, NONE, toggle } from "./facets";
import * as styles from "./styles";

const all = tasks(200);

const DATE = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
});

const columns: Column<Task>[] = [
    { key: "name", name: "Name", width: 220 },
    { key: "project", name: "Project", width: 110 },
    {
        key: "priority",
        name: "Priority",
        width: 110,
        renderCell: ({ row }) => (
            <span className={styles.priority(row.priority)}>
                {row.priority}
            </span>
        ),
    },
    { key: "status", name: "Status", width: 130 },
    { key: "assignee", name: "Assigned to", width: 120 },
    {
        key: "due",
        name: "Due date",
        width: 120,
        renderCell: ({ row }) => DATE.format(new Date(row.due)),
    },
    {
        key: "effectiveness",
        name: "Effectiveness",
        width: 140,
        renderCell: ({ row }) => (
            <span
                className={styles.stars}
                role="img"
                aria-label={`${row.effectiveness} of 5`}
            >
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        aria-hidden
                        className={styles.star(star <= row.effectiveness)}
                    />
                ))}
            </span>
        ),
    },
];

export default function Tasks() {
    const [checked, setChecked] = useState<Checked>(NONE);
    // the grid gets the filtered rows: filtering is the app's (the external mode)
    const rows = useMemo(() => filter(all, checked), [checked]);
    const facetCounts = useMemo(() => counts(all, checked), [checked]);
    const anyChecked = FACETS.some(({ key }) => checked[key].size > 0);

    return (
        <div className={styles.frame}>
            <aside className={styles.sidebar} aria-label="Filters">
                <div className={styles.sidebarHeader}>
                    <span className={styles.shown} data-testid="shown">
                        {rows.length} of {all.length} tasks
                    </span>
                    <Clickable.Button
                        size="sm"
                        variant="ghost"
                        disabled={!anyChecked}
                        onClick={() => setChecked(NONE)}
                    >
                        Clear
                    </Clickable.Button>
                </div>
                {FACETS.map((facet) => (
                    <fieldset key={facet.key} className={styles.facet}>
                        <legend className={styles.facetTitle}>
                            {facet.title}
                        </legend>
                        {facet.values.map((value) => (
                            // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox.Root renders the control
                            <label key={value} className={styles.option}>
                                <Checkbox.Root
                                    checked={checked[facet.key].has(value)}
                                    onCheckedChange={() =>
                                        setChecked((current) =>
                                            toggle(current, facet.key, value),
                                        )
                                    }
                                >
                                    <Checkbox.Indicator />
                                </Checkbox.Root>
                                <span className={styles.optionLabel}>
                                    {value}
                                </span>
                                <span className={styles.optionCount}>
                                    {facetCounts[facet.key].get(value) ?? 0}
                                </span>
                            </label>
                        ))}
                    </fieldset>
                ))}
            </aside>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={40}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="Tasks" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Task>>
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
                        <DataGrid.Rows<Task>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<Task>>
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
        </div>
    );
}
