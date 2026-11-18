import { summaryCellsOf } from "@fragiola/data-grid";
import {
    type ComputedRef,
    computed,
    inject,
    type MaybeRefOrGetter,
    toValue,
} from "vue";
import {
    type SummaryCellInfo,
    type SummaryRowInfo,
    SummaryRowKey,
    useGridView,
} from "../context";

/**
 * The cells a summary row renders, with their columns: one per rendered column, but a cell
 * spanning columns stands for the ones it covers. The given row, else the one rendering (inside
 * `DataGrid.SummaryRow`).
 */
export function useSummaryCells<TRow = unknown>(
    row?: MaybeRefOrGetter<SummaryRowInfo | undefined>,
): ComputedRef<SummaryCellInfo<TRow>[]> {
    const view = useGridView<TRow>();
    const rendering = inject(SummaryRowKey, null);
    if (toValue(row) === undefined && !rendering) {
        throw new Error(
            "useSummaryCells() must be given a row, or be used inside <DataGrid.SummaryRow>",
        );
    }
    return computed(() => {
        const at = toValue(row) ?? rendering?.();
        return at ? summaryCellsOf(view.value, at) : [];
    });
}
