import type { SummaryPosition } from "@fragiola/data-grid";
import {
    type SummaryState,
    summaryPartOf,
} from "@fragiola/data-grid/summary-rows";
import { h, provide } from "vue";
import { SummaryKey, useGridView } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";
import { SummaryRows } from "./summary-rows";

export type { SummaryState } from "@fragiola/data-grid/summary-rows";

export interface SummaryProps extends PrimitiveProps {
    /** under the header (`"top"`), or at the view's bottom edge (`"bottom"`) */
    position: SummaryPosition;
}

export interface SummarySlots extends RenderSlot<SummaryState> {
    /** without it, a summary row per row of its position (`DataGrid.SummaryRows`) */
    default?: SlotFunction<Record<never, never>>;
}

/**
 * A position's summary rows (`role="rowgroup"`, `data-summary`), sticky: the top ones under the
 * header, the bottom ones at the visible body's bottom edge. Nothing renders while the grid has
 * none there (`summaryRows` on the root). Its place in the flow is the grid's: the top one after
 * the `Header`, the bottom one last. A `<tbody>` for the top, a `<tfoot>` for the bottom, with `as`.
 */
export const Summary: DataGridComponent<SummaryProps, SummarySlots> =
    definePrimitive<SummaryProps, SummarySlots>(
        "Summary",
        ["position", "as"],
        (props, { attrs, slots }) => {
            const view = useGridView();
            provide(SummaryKey, () => props.position);
            return () =>
                view.value.summaryRows[props.position] > 0
                    ? renderElement({
                          tag: "div",
                          as: props.as,
                          attrs,
                          render: slots.render,
                          ...summaryPartOf(view.value, props.position),
                          children: () =>
                              slots.default
                                  ? slots.default({})
                                  : h(SummaryRows),
                      })
                    : null;
        },
    );
