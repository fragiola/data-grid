import { LAYER_KEYS, type SummaryRowState } from "@fragiola/data-grid";
import { summaryRowPartOf } from "@fragiola/data-grid/summary-rows";
import { h, provide } from "vue";
import { layerRef } from "../composables/internal";
import { SummaryRowKey, useGridView, useRootGrid } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";
import type { SummaryRowInfo } from "./info";
import { SummaryCells } from "./summary-cells";

export interface SummaryRowProps extends PrimitiveProps {
    row: SummaryRowInfo;
}

export interface SummaryRowSlots extends RenderSlot<SummaryRowState> {
    /** without it, `<DataGrid.SummaryCells />` */
    default?: SlotFunction<{ state: SummaryRowState }>;
}

/**
 * A summary row (`role="row"`, `data-summary`), one of the layers the engine moves with the
 * columns, as a header row. A `<tr>` with `as="tr"`. `data-active` while it holds the active cell.
 */
export const SummaryRow: DataGridComponent<SummaryRowProps, SummaryRowSlots> =
    definePrimitive<SummaryRowProps, SummaryRowSlots>(
        "SummaryRow",
        ["row", "as"],
        (props, { attrs, slots }) => {
            const { engine } = useRootGrid();
            const view = useGridView();
            provide(SummaryRowKey, () => props.row);
            const ref = layerRef(engine, "header");
            return () => {
                const own = summaryRowPartOf(view.value, props.row);
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    ...own,
                    ref,
                    drop: LAYER_KEYS,
                    children: () =>
                        slots.default
                            ? slots.default({ state: own.state })
                            : h(SummaryCells),
                });
            };
        },
    );
