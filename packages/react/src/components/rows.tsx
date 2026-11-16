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
    const byKey = useGridView().rowKey !== undefined;
    return keyed(
        rows,
        // keyed by the app's keys when it gives some (a row not loaded yet has none: its index),
        // else by index, so a row loading in place keeps its elements (and focus); the prefixes
        // keep a key and an index apart
        (row) => (byKey && row.loaded ? `k${row.key}` : `i${row.rowIndex}`),
        children ?? ((row) => <Row row={row} />),
    );
}
