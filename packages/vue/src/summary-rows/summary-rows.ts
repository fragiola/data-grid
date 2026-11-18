import type { SummaryPosition } from "@fragiola/data-grid";
import { Fragment, h } from "vue";
import { useSummaryRows } from "../composables/use-summary-rows";
import type { SummaryRowInfo } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type SlotFunction,
} from "../utils/primitive";
import { SummaryRow } from "./summary-row";

export interface SummaryRowsProps {
    /** whose rows: without it, the `DataGrid.Summary` around's */
    position?: SummaryPosition | undefined;
}

export interface SummaryRowsSlots {
    /** renders a summary row; without it, `<DataGrid.SummaryRow :row="row" />` */
    default?: SlotFunction<{ row: SummaryRowInfo }>;
}

/** A position's summary rows, the first one first. */
export const SummaryRows: DataGridComponent<
    SummaryRowsProps,
    SummaryRowsSlots
> = definePrimitive<SummaryRowsProps, SummaryRowsSlots>(
    "SummaryRows",
    ["position"],
    (props, { slots }) => {
        const rows = useSummaryRows(() => props.position);
        return () =>
            rows.value.map((row) =>
                h(
                    Fragment,
                    { key: row.summaryIndex },
                    slots.default
                        ? slots.default({ row })
                        : [h(SummaryRow, { row })],
                ),
            );
    },
);
