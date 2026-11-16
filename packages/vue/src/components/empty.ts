import {
    EMPTY_FILL,
    emptyAreaPropsOf,
    emptyCellPropsOf,
} from "@fragiola/data-grid";
import { h, inject } from "vue";
import { layerRef } from "../composables/internal";
import { TableKey, useGridView, useRootGrid } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement, vueProps } from "../utils/render";

export type EmptyProps = PrimitiveProps;

export interface EmptySlots extends RenderSlot<Record<string, never>> {
    /** what the grid shows without rows: the app's own content */
    default?: SlotFunction<Record<never, never>>;
}

/**
 * What the grid shows while it has no rows: its slot, in a cell of its own (Epic #89, E5.2), in a
 * row of its own, in an area below the header as large as the visible body that stays in view when
 * the grid scrolls sideways. Nothing renders while there are rows; it has no text or name of its
 * own. `Empty` is the cell (`role="gridcell"`, spanning every column, as tall as the area): your
 * class, style and slot go on it. Place it after the `Header`. In a table grid (`DataGrid.Grid
 * as="table"`), or `as="td"`, it is a `<td>`: its row and area are then a `<tr>` and a `<tbody>`.
 */
export const Empty: DataGridComponent<EmptyProps, EmptySlots> = definePrimitive<
    EmptyProps,
    EmptySlots
>("Empty", ["as"], (props, { attrs, slots }) => {
    const { engine } = useRootGrid();
    const view = useGridView();
    // in a table grid, a cell of a table; `as="td"` says so in any grid
    const tableGrid = inject(TableKey, false);
    // mounted, its row counts in ARIA (`emptyShown`)
    const ref = layerRef(engine, "empty");
    return () => {
        const current = view.value;
        if (current.rowCount !== 0) return null;
        const table = tableGrid || props.as === "td";
        const own = emptyCellPropsOf(current);
        // a table's cell spans the columns natively, in a table's row and row group; else divs
        // with roles
        const cellProps = table
            ? {
                  ...own,
                  role: undefined,
                  "aria-colspan": undefined,
                  colSpan: Math.max(1, current.columnCount),
                  style: { ...own.style, ...EMPTY_FILL },
              }
            : own;
        const cell = renderElement({
            tag: table ? "td" : "div",
            as: props.as,
            attrs,
            render: slots.render,
            state: {},
            ref,
            props: cellProps,
            children: () => slots.default?.({}),
        });
        const { area, row } = emptyAreaPropsOf(current, table);
        return h(table ? "tbody" : "div", vueProps(area), [
            h(table ? "tr" : "div", vueProps(row), [cell]),
        ]);
    };
});
