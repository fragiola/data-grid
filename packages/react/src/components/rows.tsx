import { rowElementKey } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import type { RowInfo } from "../context";
import { useGridView } from "../hooks/use-grid-view";
import { useRows } from "../hooks/use-rows";
import { keyed } from "../utils/keyed";
import { Row } from "./row";

export interface RowsProps<TRow> {
    /** renders a row; without it, `<DataGrid.Row row={row} />` */
    children?: (row: RowInfo<TRow>) => ReactNode;
}

/** The rendered rows (the row window, plus the active row), in order. */
export function Rows<TRow = unknown>({ children }: RowsProps<TRow>) {
    const rows = useRows<TRow>();
    const view = useGridView<TRow>();
    return keyed(
        rows,
        (row) => rowElementKey(view, row),
        children ?? ((row) => <Row row={row} />),
    );
}
