import {
    type CellState,
    cellContent,
    cellEditOf,
    type DataGridEngine,
} from "@fragiola/data-grid";
import type { ReactNode } from "react";
import { type CellInfo, useRootGrid } from "../context";
import { useCellElement, useCellPart, useEngineValue } from "../hooks/internal";
import { useGridView } from "../hooks/use-grid-view";
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
        // the cell being edited (`editing()` installed, Epic #146): its column's editor, the
        // draft its own
        content = <EditCell cell={cell} />;
    } else {
        // a group row's renderer or value, a loaded row's (the core's rule)
        content = cellContent(cell);
    }
    return useCellElement(rest, own, content, own.columnSpan, own.measured);
}

/**
 * An edited cell's editor (Epic #88): its column's `renderEditCell`, given the draft (the editor
 * props editing gives, `cellEditOf`: none without it). The one cell subscribing to the
 * draft, so a keystroke renders it alone.
 */
function EditCell<TRow>({ cell }: { cell: CellInfo<TRow> }) {
    const { engine } = useRootGrid();
    const draft = useEngineValue(engine, "edit-draft", null);
    // the root that provides the engine was given the row type the cell has
    const props = cellEditOf(
        useGridView<TRow>(),
        cell,
        draft,
        engine as DataGridEngine<TRow, ReactNode>,
    );
    return props ? cell.column.renderEditCell?.(props) : null;
}
