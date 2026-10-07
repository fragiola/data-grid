"use client";

import {
    type Column,
    DataGrid,
    type ScrollAlign,
    useDataGridRef,
} from "@fragiola/data-grid-react";
import { useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { formatNumber } from "../_kit/data";
import * as styles from "./styles";

const ROWS = 10_000;
const COLUMNS = 200;

/** A row is only its index: each cell shows its own coordinates. */
interface Row {
    index: number;
}

const getRow = (index: number): Row => ({ index });

const columns: Column<Row>[] = [
    {
        key: "row",
        name: "Row",
        // the scroll leaves a cell between the pinned columns, never under them
        pinned: "start",
        width: 80,
        renderCell: ({ rowIndex }) => formatNumber(rowIndex),
    },
    ...Array.from(
        { length: COLUMNS - 1 },
        (_, i): Column<Row> => ({
            key: `c${i + 1}`,
            name: String(i + 1),
            width: 110,
            renderCell: ({ rowIndex }) => `${rowIndex} × ${i + 1}`,
        }),
    ),
];

const ALIGNS: { align: ScrollAlign; label: string }[] = [
    { align: "nearest", label: "Nearest" },
    { align: "start", label: "Start" },
    { align: "center", label: "Centre" },
    { align: "end", label: "End" },
];

/** A whole number within `[0, count)` from a field's text, or `undefined`. */
function indexOf(text: string, count: number): number | undefined {
    const value = Number(text);
    return text.trim() !== "" && Number.isInteger(value) && value >= 0
        ? Math.min(value, count - 1)
        : undefined;
}

export default function ScrollToCell() {
    // the grid's model and engine from outside its root
    const gridRef = useDataGridRef<Row>();
    const [row, setRow] = useState("5000");
    const [column, setColumn] = useState("120");
    const [align, setAlign] = useState<ScrollAlign>("center");
    const rowIndex = indexOf(row, ROWS);
    const columnIndex = indexOf(column, COLUMNS);

    /** Scrolls one axis, or both: an index left out keeps that axis where it is. */
    const scrollTo = (to: { rowIndex?: number; columnIndex?: number }) =>
        gridRef.current?.engine.run("scroll-to-cell", { ...to, align });

    return (
        <div className={styles.frame}>
            <div className={styles.toolbar}>
                <Input.Template.Simple
                    label="Row"
                    inputMode="numeric"
                    value={row}
                    onValueChange={setRow}
                    className={styles.field}
                />
                <Input.Template.Simple
                    label="Column"
                    inputMode="numeric"
                    value={column}
                    onValueChange={setColumn}
                    className={styles.field}
                />
                <fieldset className={styles.aligns}>
                    <legend className={styles.legend}>Align</legend>
                    {ALIGNS.map((option) => (
                        <label key={option.align} className={styles.align}>
                            <input
                                type="radio"
                                name="align"
                                value={option.align}
                                checked={align === option.align}
                                onChange={() => setAlign(option.align)}
                            />
                            {option.label}
                        </label>
                    ))}
                </fieldset>
            </div>
            <div className={styles.toolbar}>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    disabled={
                        rowIndex === undefined || columnIndex === undefined
                    }
                    onClick={() => scrollTo({ rowIndex, columnIndex })}
                >
                    Scroll to cell
                </Clickable.Button>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    disabled={rowIndex === undefined}
                    onClick={() => scrollTo({ rowIndex })}
                >
                    Scroll to row
                </Clickable.Button>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    disabled={columnIndex === undefined}
                    onClick={() => scrollTo({ columnIndex })}
                >
                    Scroll to column
                </Clickable.Button>
                <Clickable.Button
                    size="sm"
                    variant="outline"
                    disabled={
                        rowIndex === undefined || columnIndex === undefined
                    }
                    onClick={() => {
                        if (
                            rowIndex === undefined ||
                            columnIndex === undefined
                        ) {
                            return;
                        }
                        // a command, not a screen action: the grid scrolls the active cell into
                        // view (the nearest edge) and, holding focus, focuses it
                        gridRef.current?.model.run("active-position.set", {
                            rowIndex,
                            columnIndex,
                        });
                    }}
                >
                    Make it active
                </Clickable.Button>
            </div>
            <DataGrid.Root
                gridRef={gridRef}
                columns={columns}
                rowCount={ROWS}
                getRow={getRow}
                rowHeight={34}
                className={styles.root}
            >
                <DataGrid.Grid aria-label="Coordinates" className={styles.grid}>
                    <DataGrid.Header className={styles.header}>
                        <DataGrid.HeaderRow className={styles.headerRow}>
                            <DataGrid.HeaderCells<Row>>
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
                        <DataGrid.Rows<Row>>
                            {(row) => (
                                <DataGrid.Row row={row} className={styles.row}>
                                    <DataGrid.Cells<Row>>
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
