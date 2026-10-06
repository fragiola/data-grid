"use client";

import { repeatedFill } from "@fragiola/data-grid/fill";
import {
    type CellInfo,
    type CellRange,
    type Column,
    DataGrid,
    type RangeFill,
    useFillHandle,
} from "@fragiola/data-grid-react";
import { useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { hash } from "../_kit/data";
import * as styles from "./styles";

// A shipping plan: units per product and week. A range's corner holds a handle; dragging it down
// or across fills the cells it reaches. The grid tells the fill; the app makes the values: the
// source repeated, or its series continued.

interface Plan {
    id: number;
    product: string;
    /** units shipped each week, the first week first */
    weeks: readonly number[];
}

const WEEKS = 10;

const PRODUCTS = ["Chairs", "Desks", "Lamps", "Shelves", "Monitors", "Cables"];

const initialPlans: Plan[] = Array.from({ length: 40 }, (_, index) => ({
    id: index + 1,
    product: `${PRODUCTS[index % PRODUCTS.length]} ${Math.floor(index / PRODUCTS.length) + 1}`,
    weeks: Array.from({ length: WEEKS }, (_, week) =>
        week < 3 ? 10 * (1 + hash(index * 11 + week, 20)) : 0,
    ),
}));

/** How a fill fills: the source repeated, or each line's series continued. */
type Mode = "repeat" | "series";

const columns: Column<Plan>[] = [
    { key: "product", name: "Product", width: 160, pinned: "start" },
    ...Array.from(
        { length: WEEKS },
        (_, week): Column<Plan> => ({
            key: `w${week}`,
            name: `Week ${week + 1}`,
            width: 92,
            getValue: (plan) => plan.weeks[week] ?? 0,
        }),
    ),
];

/** A cell's handle, as the app draws it: the hook's props on an element of its own. */
function Handle({ cell }: { cell: CellInfo<Plan> }) {
    const { state, props } = useFillHandle(cell);
    if (!state.visible) return null;
    return <span {...props} aria-hidden className={styles.handle(state)} />;
}

/**
 * Each line of the source continued (a series): along a fill down, each column's last two values
 * give the step; across, each row's. One value repeats.
 */
function seriesFill(
    { source, target }: RangeFill,
    valueAt: (rowIndex: number, columnIndex: number) => number,
) {
    const down = target.anchor.rowIndex > source.focus.rowIndex;
    const cells: { rowIndex: number; columnIndex: number; value: number }[] =
        [];
    for (
        let row = target.anchor.rowIndex;
        row <= target.focus.rowIndex;
        row++
    ) {
        for (
            let column = target.anchor.columnIndex;
            column <= target.focus.columnIndex;
            column++
        ) {
            const last = down
                ? valueAt(source.focus.rowIndex, column)
                : valueAt(row, source.focus.columnIndex);
            const before = down
                ? source.focus.rowIndex > source.anchor.rowIndex
                    ? valueAt(source.focus.rowIndex - 1, column)
                    : last
                : source.focus.columnIndex > source.anchor.columnIndex
                  ? valueAt(row, source.focus.columnIndex - 1)
                  : last;
            const steps = down
                ? row - source.focus.rowIndex
                : column - source.focus.columnIndex;
            cells.push({
                rowIndex: row,
                columnIndex: column,
                value: Math.max(0, last + (last - before) * steps),
            });
        }
    }
    return cells;
}

/** A range from the first week column on (the product column is no units). */
function weeksOf(range: CellRange): CellRange {
    return {
        anchor: {
            rowIndex: range.anchor.rowIndex,
            columnIndex: Math.max(1, range.anchor.columnIndex),
        },
        focus: range.focus,
    };
}

/**
 * The fill of the units: its source and its target from the first week on, `null` for a source
 * holding only the product (no units to fill from).
 */
function unitsFill({ source, target }: RangeFill): RangeFill | null {
    return source.focus.columnIndex < 1
        ? null
        : { source: weeksOf(source), target: weeksOf(target) };
}

export default function Fill() {
    // the app's rows: the grid never writes them, a fill is told
    const [plans, setPlans] = useState<readonly Plan[]>(initialPlans);
    const [mode, setMode] = useState<Mode>("repeat");
    const [announcement, setAnnouncement] = useState("");

    /** a week cell's units, from the app's rows */
    const unitsAt = (rowIndex: number, columnIndex: number) =>
        plans[rowIndex]?.weeks[columnIndex - 1] ?? 0;

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <span>
                    Drag the square at a range's corner down or across. A fill
                </span>
                <div className={styles.modes}>
                    {(["repeat", "series"] as const).map((option) => (
                        <Clickable.Button
                            key={option}
                            size="sm"
                            variant={mode === option ? "solid" : "outline"}
                            aria-pressed={mode === option}
                            onClick={() => setMode(option)}
                        >
                            {option === "repeat"
                                ? "repeats"
                                : "continues a series"}
                        </Clickable.Button>
                    ))}
                </div>
                {/* the app's live region: a polite status, its text the app's own */}
                <span role="status" className={styles.status}>
                    {announcement}
                </span>
            </div>
            <DataGrid.Root
                columns={columns}
                rows={plans}
                rowKey={(plan) => plan.id}
                rowHeight={36}
                cellSelection="range"
                onFill={(filled) => {
                    // the units only: the product's name is neither filled nor filled from
                    const units = unitsFill(filled);
                    if (!units) return;
                    const cells =
                        mode === "series"
                            ? seriesFill(units, unitsAt)
                            : repeatedFill(units, (at) =>
                                  unitsAt(at.rowIndex, at.columnIndex),
                              );
                    setPlans((current) =>
                        current.map((plan, rowIndex) => {
                            const mine = cells.filter(
                                (cell) => cell.rowIndex === rowIndex,
                            );
                            if (mine.length === 0) return plan;
                            const weeks = [...plan.weeks];
                            for (const cell of mine) {
                                weeks[cell.columnIndex - 1] = Number(
                                    cell.value,
                                );
                            }
                            return { ...plan, weeks };
                        }),
                    );
                    setAnnouncement(
                        `Filled ${cells.length} ${cells.length === 1 ? "cell" : "cells"}.`,
                    );
                }}
                className={styles.root}
            >
                <DataGrid.Grid
                    aria-label="Shipping plan"
                    className={styles.grid}
                >
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Plan>>
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
                        <DataGrid.Rows<Plan>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<Plan>>
                                        {(cell) => (
                                            <DataGrid.Cell
                                                cell={cell}
                                                className={styles.cell}
                                            >
                                                {String(cell.value ?? "")}
                                                <Handle cell={cell} />
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
