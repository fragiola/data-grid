// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import { parseTsv, toTsv } from "@fragiola/data-grid";
import { useState } from "react";
import {
    type CellRange,
    type CellState,
    type Column,
    DataGrid,
    type RangePaste,
    useDataGrid,
} from "../../src";

interface Sale {
    id: string;
    amount: number;
}

const columns: Column<Sale>[] = [
    { key: "id", width: 100 },
    {
        key: "amount",
        width: 100,
        // the clipboard's text: a loaded row's, typed by the row
        getCopyText: ({ row, value, rowIndex, columnIndex }) =>
            `${row.amount.toFixed(2)} ${String(value)} ${rowIndex} ${columnIndex}`,
    },
];
declare const sales: Sale[];

export function Sales() {
    const [range, setRange] = useState<CellRange | null>(null);
    return (
        <DataGrid.Root
            columns={columns}
            rows={sales}
            cellSelection="range"
            selectedRange={range}
            onSelectedRangeChange={setRange}
            onBeforeRangePaste={({ range: { anchor } }) => anchor.rowIndex > 0}
            onRangePaste={({ range: target, values }: RangePaste) => {
                const first: string | undefined = values[0]?.[0];
                const row: number = target.focus.rowIndex;
                void first;
                void row;
            }}
            // the root's own clipboard handlers stay the DOM's
            onCopy={(event) => event.clipboardData.getData("text/plain")}
        >
            <DataGrid.Grid>
                <DataGrid.Body>
                    <DataGrid.Rows<Sale>>
                        {(row) => (
                            <DataGrid.Row row={row}>
                                <DataGrid.Cells<Sale>>
                                    {(cell) => (
                                        <DataGrid.Cell
                                            cell={cell}
                                            className={(state: CellState) =>
                                                state.selected
                                                    ? `in ${state.rangeEdges ?? ""}`
                                                    : undefined
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
    );
}

export function Commands() {
    const { model } = useDataGrid<Sale>();
    model.run("selected-range.set", {
        anchor: { rowIndex: 0, columnIndex: 0 },
        focus: { rowIndex: 2, columnIndex: 1 },
    });
    model.run("selected-range.extend", { direction: "down" });
    model.run("selected-range.extend", { rowIndex: 3, columnIndex: 1 });
    model.run("selected-range.select-all");
    model.run("selected-range.clear");
    model.run("cell-selection.set", { cellSelection: null });
    // @ts-expect-error: a direction or a cell, not both
    model.run("selected-range.extend", {
        direction: "down",
        rowIndex: 3,
        columnIndex: 1,
    });
    // @ts-expect-error: one mode of cell selection, a range
    model.run("cell-selection.set", { cellSelection: "multiple" });
    const selected: CellRange | null = model.get("selected-range");
    const inIt: boolean = model.is("cell-selected", {
        rowIndex: 0,
        columnIndex: 0,
    });
    const tsv: string = toTsv(parseTsv("a\tb"));
    return [selected, inIt, tsv];
}

export function Wrong() {
    return (
        <DataGrid.Root
            columns={columns}
            rows={sales}
            // @ts-expect-error: cells are selected by range
            cellSelection="single"
        />
    );
}

export const wrongCopy: Column<Sale> = {
    key: "id",
    width: 100,
    // @ts-expect-error: the clipboard's text is a string
    getCopyText: ({ row }) => row.amount,
};
