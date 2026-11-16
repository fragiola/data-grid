import type { ReactNode } from "react";
import { type CellInfo, useRowContext } from "../context";
import { useCells } from "../hooks/use-cells";
import { keyed } from "../utils/keyed";
import { Cell } from "./cell";

export interface CellsProps<TRow> {
    /** renders a cell; without it, `<DataGrid.Cell cell={cell} />` */
    children?: (cell: CellInfo<TRow>) => ReactNode;
}

/** The cells of the row it is in, for the rendered columns. */
export function Cells<TRow = unknown>({ children }: CellsProps<TRow>) {
    const row = useRowContext<TRow>("Cells");
    const cells = useCells(row);
    return keyed(
        cells,
        (cell) => cell.column.key,
        children ?? ((cell) => <Cell cell={cell} />),
    );
}
