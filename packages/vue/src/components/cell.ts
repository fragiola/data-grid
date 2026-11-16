import { type CellState, cellContent, cellPartOf } from "@fragiola/data-grid";
import { defineComponent, h } from "vue";
import { layerRef } from "../composables/internal";
import { useCellEdit } from "../composables/use-cell-edit";
import { type CellInfo, useGridView, useRootGrid } from "../context";
import { renderCellElement } from "../utils/cell-element";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import type { RenderSlot } from "../utils/render";

export interface CellProps<TRow = unknown> extends PrimitiveProps {
    cell: CellInfo<TRow>;
}

export interface CellSlots<TRow = unknown> extends RenderSlot<CellState> {
    /**
     * the cell's content; without it: the column's `renderCell` for a loaded row, else its value
     * as text (a string, number or boolean); nothing while the row is not loaded. On a group row
     * (Epic #87), the column's `renderGroupCell`, else the cell's value as text. Being edited, the
     * column's `renderEditCell`
     */
    default?: SlotFunction<{ cell: CellInfo<TRow>; state: CellState }>;
}

/**
 * An edited cell's editor (Epic #88): its column's `renderEditCell`, given the draft. The one
 * cell following the draft, so a keystroke renders it alone.
 */
const EditCell = defineComponent({
    name: "DataGridEditCell",
    props: { cell: { type: Object, required: true } },
    setup(props) {
        const edit = useCellEdit(() => props.cell as CellInfo);
        return () => {
            const editor = edit.value;
            return editor
                ? (props.cell as CellInfo).column.renderEditCell?.(editor)
                : null;
        };
    },
});

/**
 * A body cell (`role="gridcell"`), positioned in its row. A `<td>` with `as="td"`, which then gets
 * `colSpan` when it spans columns (`aria-colspan`, a column's `colSpan`); a `render` slot finds
 * the span in its props' `aria-colspan`. The active cell is the grid's tab stop (`tabIndex` 0,
 * `data-active`); the others take focus on click.
 */
export const Cell: DataGridComponent<CellProps, CellSlots> = definePrimitive<
    CellProps,
    CellSlots
>("Cell", ["cell", "as"], (props, { attrs, slots }) => {
    const { engine } = useRootGrid();
    const view = useGridView();
    const pinnedRef = layerRef(engine, "pinned");
    return () => {
        const { cell } = props;
        const own = cellPartOf(view.value, cell);
        return renderCellElement({
            as: props.as,
            attrs,
            render: slots.render,
            own,
            pinnedRef,
            content: () => {
                if (slots.default) {
                    return slots.default({ cell, state: own.state });
                }
                // the cell being edited (Epic #88): its column's editor, the draft its own
                if (own.state.editing && cell.column.renderEditCell) {
                    return h(EditCell, { cell });
                }
                // a group row's renderer or value, a loaded row's (the core's rule)
                return cellContent(cell);
            },
            columnSpan: own.columnSpan,
            measured: own.measured,
        });
    };
});
