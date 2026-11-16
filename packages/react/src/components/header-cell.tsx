import type { HeaderCellState } from "@fragiola/data-grid";
import { headerCellContent } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import type { HeaderCellInfo } from "../context";
import { useCellElement } from "../hooks/internal";
import { useHeaderCell } from "../hooks/use-header-cell";
import type { DivPrimitiveProps } from "../utils/use-render";

export type HeaderCellProps<TRow> = DivPrimitiveProps<HeaderCellState> & {
    cell: HeaderCellInfo<TRow>;
    /** without children: the group's or the column's `renderHeaderCell`, else its `name` */
    children?: ReactNode;
};

/**
 * A header cell (`role="columnheader"`), a group's or a column's. A `<th>` through `render`, which
 * then gets `colSpan`/`rowSpan` too (a render function finds them in the state, and in its props'
 * `aria-colspan`/`aria-rowspan`).
 */
export function HeaderCell<TRow>(props: HeaderCellProps<TRow>) {
    const { cell, children, ...rest } = props;
    const own = useHeaderCell(cell);
    return useCellElement(
        rest,
        own,
        children !== undefined ? children : headerCellContent(cell),
        cell.columnSpan,
        false,
        cell.rowSpan,
    );
}
