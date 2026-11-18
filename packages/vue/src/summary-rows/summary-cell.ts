import {
    type SummaryCellState,
    summaryCellContent,
    summaryCellPartOf,
} from "@fragiola/data-grid";
import { layerRef } from "../composables/internal";
import { type SummaryCellInfo, useGridView, useRootGrid } from "../context";
import { renderCellElement } from "../utils/cell-element";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import type { RenderSlot } from "../utils/render";

export interface SummaryCellProps<TRow = unknown> extends PrimitiveProps {
    cell: SummaryCellInfo<TRow>;
}

export interface SummaryCellSlots extends RenderSlot<SummaryCellState> {
    /** without it: the column's `renderSummaryCell`, else nothing */
    default?: SlotFunction<{ state: SummaryCellState }>;
}

/**
 * A summary row's cell (`role="gridcell"`, `data-summary`), positioned in its row as a body cell:
 * pinned, spanning (`aria-colspan`, a `td`'s `colSpan`), active and in interaction alike. A `<td>`
 * with `as="td"`. Its content is the app's: the column's `renderSummaryCell`.
 */
export const SummaryCell: DataGridComponent<
    SummaryCellProps,
    SummaryCellSlots
> = definePrimitive<SummaryCellProps, SummaryCellSlots>(
    "SummaryCell",
    ["cell", "as"],
    (props, { attrs, slots }) => {
        const { engine } = useRootGrid();
        const view = useGridView();
        const pinnedRef = layerRef(engine, "pinned");
        return () => {
            const { cell } = props;
            const own = summaryCellPartOf(view.value, cell);
            return renderCellElement({
                as: props.as,
                attrs,
                render: slots.render,
                own,
                pinnedRef,
                content: () =>
                    slots.default
                        ? slots.default({ state: own.state })
                        : summaryCellContent(cell),
                columnSpan: own.columnSpan,
                measured: own.measured,
            });
        };
    },
);
