"use client";

import {
    type CellPosition,
    type Column,
    DataGrid,
    useDataGrid,
} from "@fragiola/data-grid-react";
import { type KeyboardEvent, useState } from "react";
import { type Person, people } from "../_kit/data";
import * as styles from "./styles";

const rows = people(1_000);

const columns: Column<Person>[] = [
    { key: "id", name: "#", width: 72 },
    { key: "name", name: "Name", width: 180 },
    { key: "city", name: "City", width: 140 },
    { key: "team", name: "Team", width: 120 },
];

/** What Tab does in the grid. */
type Mode = "leave" | "change-row" | "loop-over-row";

const MODES: { mode: Mode; label: string }[] = [
    { mode: "leave", label: "Tab leaves the grid" },
    {
        mode: "change-row",
        label: "Tab moves across the row, then to the next row",
    },
    { mode: "loop-over-row", label: "Tab loops over the row" },
];

/** Where Tab (or Shift+Tab) goes from `at`; `null` lets it leave the grid. */
function tabTarget(
    at: CellPosition,
    back: boolean,
    mode: Mode,
    rowCount: number,
    columnCount: number,
): CellPosition | null {
    if (mode === "leave" || at.rowIndex < 0) return null;
    const step = back ? -1 : 1;
    const columnIndex = at.columnIndex + step;
    if (columnIndex >= 0 && columnIndex < columnCount) {
        return { rowIndex: at.rowIndex, columnIndex };
    }
    if (mode === "loop-over-row") {
        return {
            rowIndex: at.rowIndex,
            columnIndex: back ? columnCount - 1 : 0,
        };
    }
    const rowIndex = at.rowIndex + step;
    // past the grid's first or last cell, Tab leaves it as usual
    if (rowIndex < 0 || rowIndex >= rowCount) return null;
    return { rowIndex, columnIndex: back ? columnCount - 1 : 0 };
}

export default function CustomNavigation() {
    const [mode, setMode] = useState<Mode>("change-row");
    return (
        <div className={styles.frame}>
            <fieldset className={styles.modes}>
                <legend className={styles.panel}>Tab key</legend>
                {MODES.map((option) => (
                    <label key={option.mode} className={styles.mode}>
                        <input
                            type="radio"
                            name="tab-mode"
                            value={option.mode}
                            checked={mode === option.mode}
                            onChange={() => setMode(option.mode)}
                        />
                        {option.label}
                    </label>
                ))}
            </fieldset>
            <DataGrid.Root
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                rowHeight={36}
                defaultActivePosition={{ rowIndex: 0, columnIndex: 0 }}
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
                    <Body mode={mode} />
                </DataGrid.Grid>
            </DataGrid.Root>
        </div>
    );
}

/** The body, whose cells handle Tab before the grid sees it. */
function Body({ mode }: { mode: Mode }) {
    const { model } = useDataGrid<Person>();
    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (
            event.key !== "Tab" ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
        ) {
            return;
        }
        const active = model.get("active-position");
        if (!active) return;
        const target = tabTarget(
            active,
            event.shiftKey,
            mode,
            model.get("row-count"),
            model.get("column-count"),
        );
        if (!target) return;
        // the key is ours now: the browser does not move focus, and the grid scrolls the
        // new active cell into view and focuses it
        event.preventDefault();
        model.run("active-position.set", target);
    };
    return (
        <DataGrid.Body>
            <DataGrid.Rows<Person>>
                {(row) => (
                    <DataGrid.Row row={row} className={styles.row}>
                        <DataGrid.Cells<Person>>
                            {(cell) => (
                                <DataGrid.Cell
                                    cell={cell}
                                    className={styles.cell}
                                    onKeyDown={onKeyDown}
                                />
                            )}
                        </DataGrid.Cells>
                    </DataGrid.Row>
                )}
            </DataGrid.Rows>
        </DataGrid.Body>
    );
}
