import type { ReactNode } from "react";
import { HeaderRowContext, type HeaderRowInfo } from "../context";
import { useHeaderRows } from "../hooks/use-header-rows";
import { HeaderRow } from "./header-row";

export interface HeaderRowsProps<TRow> {
    /** renders a header row; without it, `<DataGrid.HeaderRow row={row} />` */
    children?: (row: HeaderRowInfo<TRow>) => ReactNode;
}

/**
 * The header rows, the top one first: one without column groups, one per level with them (the
 * columns' row last).
 */
export function HeaderRows<TRow = unknown>({
    children,
}: HeaderRowsProps<TRow>) {
    const rows = useHeaderRows<TRow>();
    return rows.map((row) => (
        <HeaderRowContext key={row.rowIndex} value={row as HeaderRowInfo}>
            {children ? children(row) : <HeaderRow row={row} />}
        </HeaderRowContext>
    ));
}
