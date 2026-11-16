import type { ReactNode } from "react";
import type { HeaderCellInfo } from "../context";
import { useHeaderCells } from "../hooks/use-header-cells";
import { keyed } from "../utils/keyed";
import { HeaderCell } from "./header-cell";

export interface HeaderCellsProps<TRow> {
    /** renders a header cell; without it, `<DataGrid.HeaderCell cell={cell} />` */
    children?: (cell: HeaderCellInfo<TRow>) => ReactNode;
}

/**
 * A header row's cells: groups and columns intersecting the column window (a group cut by it
 * included), plus the one holding the active column.
 */
export function HeaderCells<TRow = unknown>({
    children,
}: HeaderCellsProps<TRow>) {
    const cells = useHeaderCells<TRow>();
    return keyed(
        cells,
        (cell) => cell.key,
        children ?? ((cell) => <HeaderCell cell={cell} />),
    );
}
