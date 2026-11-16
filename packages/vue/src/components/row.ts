import { type RowState, rowPartOf } from "@fragiola/data-grid";
import { h, provide } from "vue";
import { layerRef } from "../composables/internal";
import { type RowInfo, RowKey, useGridView, useRootGrid } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";
import { Cells } from "./cells";

export interface RowProps<TRow = unknown> extends PrimitiveProps {
    row: RowInfo<TRow>;
}

export interface RowSlots extends RenderSlot<RowState> {
    /** without it, `<DataGrid.Cells />` */
    default?: SlotFunction<{ state: RowState }>;
}

/**
 * A body row (`role="row"`), positioned in the body layer. A `<tr>` with `as="tr"`.
 * `data-loading` while its row is not loaded, `data-active` while it holds the active cell.
 */
export const Row: DataGridComponent<RowProps, RowSlots> = definePrimitive<
    RowProps,
    RowSlots
>("Row", ["row", "as"], (props, { attrs, slots }) => {
    const { engine } = useRootGrid();
    const view = useGridView();
    provide(RowKey, () => props.row);
    // a measured row's height is read by the engine (Epic #86)
    const measuredRef = layerRef(engine, "row");
    return () => {
        const own = rowPartOf(view.value, props.row);
        return renderElement({
            tag: "div",
            as: props.as,
            attrs,
            render: slots.render,
            state: own.state,
            props: own.props,
            ref: own.measured ? measuredRef : undefined,
            children: () =>
                slots.default ? slots.default({ state: own.state }) : h(Cells),
        });
    };
});
