import { rowCellsOf } from "@fragiola/data-grid";
import {
    type ComputedRef,
    computed,
    type MaybeRefOrGetter,
    toValue,
} from "vue";
import { type CellInfo, type RowInfo, useGridView } from "../context";

/**
 * The cells a row renders, with their columns and values: one per rendered column, but a cell
 * spanning columns (a column's `colSpan`, Epic #85) stands for the ones it covers.
 */
export function useCells<TRow = unknown>(
    row: MaybeRefOrGetter<RowInfo<TRow>>,
): ComputedRef<CellInfo<TRow>[]> {
    const view = useGridView<TRow>();
    return computed(() => rowCellsOf(view.value, toValue(row)));
}
