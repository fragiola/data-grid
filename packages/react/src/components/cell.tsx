import { type CellState, cellContent } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import type { CellInfo } from "../context";
import { useCellElement, useCellPart } from "../hooks/internal";
import { useCellEdit } from "../hooks/use-cell-edit";
import type { DivPrimitiveProps } from "../utils/use-render";

export type CellProps<TRow> = DivPrimitiveProps<CellState> & {
    cell: CellInfo<TRow>;
    /**
     * without children: the column's `renderCell` for a loaded row, else its value as text (a
     * string, number or boolean); nothing while the row is not loaded. On a group row (Epic #87),
     * the column's `renderGroupCell`, else the cell's value as text (the group's value in its
     * column, its aggregate elsewhere)
     */
    children?: ReactNode;
};

/**
 * A body cell (`role="gridcell"` with `navigation()` installed, else `cell`), positioned in its
 * row. A `<td>` through `render`, which then gets `colSpan` when it spans columns
 * (`aria-colspan`, a column's `colSpan`); a render function finds the span in its props'
 * `aria-colspan` (`<td {...props} colSpan={props["aria-colspan"]} />`).
 * With navigation, the active cell is the grid's tab stop (`tabIndex` 0, `data-active`); the
 * others take focus on click. Without it, a cell has no `tabIndex`.
 */
export function Cell<TRow>(props: CellProps<TRow>) {
    const { cell, children, ...rest } = props;
    const own = useCellPart(cell);
    let content: ReactNode = null;
    if (children !== undefined) {
        content = children;
    } else if (own.state.editing && cell.column.renderEditCell) {
        // the cell being edited (Epic #88): its column's editor, the draft its own
        content = <EditCell cell={cell} />;
    } else {
        // a group row's renderer or value, a loaded row's (the core's rule)
        content = cellContent(cell);
    }
    return useCellElement(rest, own, content, own.columnSpan, own.measured);
}

/**
 * An edited cell's editor (Epic #88): its column's `renderEditCell`, given the draft. The one
 * cell subscribing to the draft, so a keystroke renders it alone.
 */
function EditCell<TRow>({ cell }: { cell: CellInfo<TRow> }) {
    const props = useCellEdit(cell);
    return props ? cell.column.renderEditCell?.(props) : null;
}
