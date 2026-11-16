import { type CellState, valueText } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import type { CellInfo } from "../context";
import { useCellElement, useCellPart } from "../hooks/internal";
import { useCellEdit } from "../hooks/use-cell-edit";
import type { DivPrimitiveProps } from "../utils/use-render";

/**
 * A value rendered as text when the cell has no children and its column no `renderCell`: a string
 * as it is, a number, a big integer or a boolean written out (`valueText`, what a copy takes,
 * Epic #88); nothing for anything else.
 */
function plain(value: unknown): ReactNode {
    return typeof value === "string" ? value : valueText(value) || null;
}

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
 * A body cell (`role="gridcell"`), positioned in its row. A `<td>` through `render`, which then
 * gets `colSpan` when it spans columns (`aria-colspan`, a column's `colSpan`); a render function
 * finds the span in its props' `aria-colspan` (`<td {...props} colSpan={props["aria-colspan"]} />`).
 * The active cell is the grid's tab stop (`tabIndex` 0, `data-active`); the others take focus on
 * click.
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
    } else if (cell.group) {
        // a group row has no data row: its group's value and aggregates (Epic #87)
        content = cell.column.renderGroupCell
            ? cell.column.renderGroupCell({
                  group: cell.group,
                  rowIndex: cell.rowIndex,
                  column: cell.column,
                  columnIndex: cell.columnIndex,
                  value: cell.value,
              })
            : plain(cell.value);
    } else if (cell.loaded && cell.row !== undefined) {
        content = cell.column.renderCell
            ? cell.column.renderCell({
                  row: cell.row,
                  rowIndex: cell.rowIndex,
                  column: cell.column,
                  columnIndex: cell.columnIndex,
                  value: cell.value,
              })
            : plain(cell.value);
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
