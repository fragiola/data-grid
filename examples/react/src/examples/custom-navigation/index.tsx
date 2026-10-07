"use client";

import {
    type CellPosition,
    type Column,
    DataGrid,
    useDataGrid,
    useGridView,
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

/** What Tab, and the arrows at a row's ends, do in the grid. */
type Mode = "leave" | "change-row" | "loop-over-row" | "loop-over-column";

const MODES: { mode: Mode; label: string }[] = [
    { mode: "leave", label: "Tab leaves the grid" },
    {
        mode: "change-row",
        label: "Tab and the arrows go on to the next row",
    },
    { mode: "loop-over-row", label: "Tab and the arrows loop over the row" },
    { mode: "loop-over-column", label: "Tab moves down the column" },
];

/**
 * Where a key goes from `at`: Tab (or Shift+Tab, `step` -1) anywhere, an arrow only past a row's
 * first or last cell (inside the row the grid moves it as usual). The header is row -1: Tab goes
 * through it like any row. `null` leaves the key to the grid: Tab leaves it, an arrow at an end
 * stays.
 */
function target(
    at: CellPosition,
    step: 1 | -1,
    tab: boolean,
    mode: Mode,
    rowCount: number,
    columnCount: number,
): CellPosition | null {
    if (mode === "leave") return null;
    if (mode === "loop-over-column") {
        if (!tab) return null;
        // past the last row, the header; before the header, the last row
        const rowIndex = at.rowIndex + step;
        return {
            rowIndex:
                rowIndex >= rowCount
                    ? -1
                    : rowIndex < -1
                      ? rowCount - 1
                      : rowIndex,
            columnIndex: at.columnIndex,
        };
    }
    const columnIndex = at.columnIndex + step;
    if (columnIndex >= 0 && columnIndex < columnCount) {
        return tab ? { rowIndex: at.rowIndex, columnIndex } : null;
    }
    const wrapped = step === 1 ? 0 : columnCount - 1;
    if (mode === "loop-over-row") {
        return { rowIndex: at.rowIndex, columnIndex: wrapped };
    }
    const rowIndex = at.rowIndex + step;
    // past the grid's first or last cell, Tab leaves it as usual
    if (rowIndex < -1 || rowIndex >= rowCount) return null;
    return { rowIndex, columnIndex: wrapped };
}

export default function CustomNavigation() {
    const [mode, setMode] = useState<Mode>("change-row");
    return (
        <div className={styles.frame}>
            <fieldset className={styles.modes}>
                <legend className={styles.panel}>Cell navigation</legend>
                {MODES.map((option) => (
                    <label key={option.mode} className={styles.mode}>
                        <input
                            type="radio"
                            name="navigation-mode"
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
                <Grid mode={mode} />
            </DataGrid.Root>
        </div>
    );
}

/** The grid, whose cells (header cells too) handle the keys before the grid sees them. */
function Grid({ mode }: { mode: Mode }) {
    const { model } = useDataGrid<Person>();
    const { direction } = useGridView();
    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const tab = event.key === "Tab";
        // the arrow toward the row's end: → left to right, ← right to left
        const forward = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
        const back = direction === "rtl" ? "ArrowRight" : "ArrowLeft";
        if (
            !tab &&
            (event.shiftKey || (event.key !== forward && event.key !== back))
        ) {
            return;
        }
        const active = model.get("active-position");
        if (!active) return;
        const step = (tab ? event.shiftKey : event.key === back) ? -1 : 1;
        const next = target(
            active,
            step,
            tab,
            mode,
            model.get("row-count"),
            model.get("column-count"),
        );
        if (!next) return;
        // the key is ours now: the browser does not move focus, and the grid scrolls the
        // new active cell into view and focuses it
        event.preventDefault();
        model.run("active-position.set", next);
    };
    return (
        <DataGrid.Grid aria-label="People" className={styles.grid}>
            <DataGrid.Header className={styles.header}>
                <DataGrid.HeaderRow className={styles.headerRow}>
                    <DataGrid.HeaderCells<Person>>
                        {(cell) => (
                            <DataGrid.HeaderCell
                                cell={cell}
                                className={styles.headerCell}
                                onKeyDown={onKeyDown}
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
                                        onKeyDown={onKeyDown}
                                    />
                                )}
                            </DataGrid.Cells>
                        </DataGrid.Row>
                    )}
                </DataGrid.Rows>
            </DataGrid.Body>
        </DataGrid.Grid>
    );
}
