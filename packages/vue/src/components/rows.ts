import { rowElementKey } from "@fragiola/data-grid";
import { Fragment, h } from "vue";
import { useRows } from "../composables/use-rows";
import { type RowInfo, useGridView } from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type SlotFunction,
} from "../utils/primitive";
import { Row } from "./row";

export type RowsProps = Record<never, never>;

export interface RowsSlots<TRow = unknown> {
    /** renders a row; without it, `<DataGrid.Row :row="row" />` */
    default?: SlotFunction<{ row: RowInfo<TRow> }>;
}

/** The rendered rows (the row window, plus the active row), in order. */
export const Rows: DataGridComponent<RowsProps, RowsSlots> = definePrimitive<
    RowsProps,
    RowsSlots
>("Rows", [], (_props, { slots }) => {
    const rows = useRows();
    const view = useGridView();
    return () =>
        rows.value.map((row) =>
            h(
                Fragment,
                // keyed by the app's keys when it gives some, else by index (the core's rule)
                { key: rowElementKey(view.value, row) },
                slots.default ? slots.default({ row }) : [h(Row, { row })],
            ),
        );
});
