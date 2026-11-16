import { bodyPropsOf, LAYER_KEYS } from "@fragiola/data-grid";
import { h } from "vue";
import { layerRef } from "../composables/internal";
import { useGridView, useRootGrid } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";
import { Rows } from "./rows";

export type BodyProps = PrimitiveProps;

export interface BodySlots extends RenderSlot<Record<string, never>> {
    /** without it, the rendered rows (`DataGrid.Rows`) */
    default?: SlotFunction<Record<never, never>>;
}

/**
 * The body (`role="rowgroup"`), the layer the engine moves with the rows, below the header and the
 * top summary rows. A `<tbody>` with `as="tbody"`.
 */
export const Body: DataGridComponent<BodyProps, BodySlots> = definePrimitive<
    BodyProps,
    BodySlots
>("Body", ["as"], (props, { attrs, slots }) => {
    const { engine } = useRootGrid();
    const view = useGridView();
    const ref = layerRef(engine, "body");
    return () =>
        renderElement({
            tag: "div",
            as: props.as,
            attrs,
            render: slots.render,
            state: {},
            ref,
            drop: LAYER_KEYS,
            props: bodyPropsOf(view.value),
            children: () => (slots.default ? slots.default({}) : h(Rows)),
        });
});
