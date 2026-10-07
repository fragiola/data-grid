"use client";

import { type Column, DataGrid } from "@fragiola/data-grid-react";
import { useEffect, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { type Task, tasks } from "../_kit/tasks";
import * as styles from "./styles";

const ROWS = tasks(500);

const HEIGHTS = [
    { label: "Small", height: 32 },
    { label: "Medium", height: 52 },
    { label: "Large", height: 76 },
] as const;

const columns: Column<Task>[] = [
    { key: "id", name: "#", width: 64 },
    {
        key: "name",
        name: "Task",
        width: 240,
        // two lines: the project shows as the row grows tall enough for it
        renderCell: ({ row }) => (
            <span className={styles.stack}>
                <span>{row.name}</span>
                <span className={styles.secondary}>{row.project}</span>
            </span>
        ),
    },
    { key: "priority", name: "Priority", width: 110 },
    { key: "status", name: "Status", width: 130 },
    { key: "assignee", name: "Assignee", width: 110 },
    { key: "due", name: "Due", width: 120 },
];

// The grid positions each row (its top and height, structural style) from `rowHeight`: a new
// height lays every row out again in one render. While that change is in flight (`easingTo`,
// set with the new height and cleared once the transition is over), the rows' own CSS
// transition on `top` and `height` (styles.ts) eases them there. Only then: a scroll that
// renders other rows, or moves them, never animates. With reduced motion they move at once.

/** How long the rows ease, in ms: the rows' `duration-300` (styles.ts). */
const DURATION = 300;

export default function AnimatedRowHeights() {
    const [rowHeight, setRowHeight] = useState<number>(HEIGHTS[0].height);
    // the height the rows are easing to, until the transition is over
    const [easingTo, setEasingTo] = useState<number | null>(null);
    useEffect(() => {
        if (easingTo === null) return;
        // a little past the transition's end, so it is never cut short
        const timer = setTimeout(() => setEasingTo(null), DURATION + 50);
        return () => clearTimeout(timer);
    }, [easingTo]);
    return (
        <div className={styles.frame}>
            <fieldset className={styles.toolbar}>
                <legend className={styles.legend}>Row height</legend>
                {HEIGHTS.map((option) => (
                    <Clickable.Button
                        key={option.label}
                        size="sm"
                        variant={
                            rowHeight === option.height ? "solid" : "outline"
                        }
                        aria-pressed={rowHeight === option.height}
                        onClick={() => {
                            setRowHeight(option.height);
                            // the same render: the transition applies to this change
                            setEasingTo(option.height);
                        }}
                    >
                        {option.label}
                    </Clickable.Button>
                ))}
            </fieldset>
            <DataGrid.Root
                columns={columns}
                rows={ROWS}
                rowKey={(row) => row.id}
                rowHeight={rowHeight}
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
                                <DataGrid.Row
                                    row={row}
                                    className={(state) =>
                                        styles.row(state, easingTo !== null)
                                    }
                                >
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
