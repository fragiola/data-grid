import { Fragment, h } from "vue";
import {
    type DataGridComponent,
    definePrimitive,
    type SlotFunction,
} from "../utils/primitive";
import type { SummaryCellInfo } from "./info";
import { SummaryCell } from "./summary-cell";
import { useSummaryCells } from "./use-summary-cells";

export type SummaryCellsProps = Record<never, never>;

export interface SummaryCellsSlots<TRow = unknown> {
    /** renders a cell; without it, `<DataGrid.SummaryCell :cell="cell" />` */
    default?: SlotFunction<{ cell: SummaryCellInfo<TRow> }>;
}

/** The cells of the summary row it is in, for the rendered columns. */
export const SummaryCells: DataGridComponent<
    SummaryCellsProps,
    SummaryCellsSlots
> = definePrimitive<SummaryCellsProps, SummaryCellsSlots>(
    "SummaryCells",
    [],
    (_props, { slots }) => {
        const cells = useSummaryCells();
        return () =>
            cells.value.map((cell) =>
                h(
                    Fragment,
                    { key: cell.column.key },
                    slots.default
                        ? slots.default({ cell })
                        : [h(SummaryCell, { cell })],
                ),
            );
    },
);
