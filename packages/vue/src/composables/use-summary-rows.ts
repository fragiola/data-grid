import {
    type SummaryPosition,
    type SummaryRowView,
    summaryRowsOf,
} from "@fragiola/data-grid";
import {
    type ComputedRef,
    computed,
    inject,
    type MaybeRefOrGetter,
    toValue,
} from "vue";
import { SummaryKey, type SummaryRowInfo, useGridView } from "../context";

/**
 * A position's summary rows (Epic #86), the first one first: `position`'s, else the ones of the
 * `DataGrid.Summary` around. None while the grid has none there.
 */
export function useSummaryRows(
    position?: MaybeRefOrGetter<SummaryPosition | undefined>,
): ComputedRef<readonly SummaryRowInfo[]> {
    const view = useGridView();
    const around = inject(SummaryKey, null);
    if (toValue(position) === undefined && !around) {
        throw new Error(
            "useSummaryRows() must be given a position, or be used inside <DataGrid.Summary>",
        );
    }
    // the rows only change with the counts, the row count and the header: kept between views
    let last: {
        key: readonly unknown[];
        rows: readonly SummaryRowView[];
    } | null = null;
    return computed(() => {
        const at = toValue(position) ?? around?.();
        const { summaryRows, rowCount, header } = view.value;
        if (!at) return [];
        const key = [summaryRows, rowCount, header, at];
        if (last?.key.every((value, index) => value === key[index])) {
            return last.rows;
        }
        const rows = summaryRowsOf({ summaryRows, rowCount, header }, at);
        last = { key, rows };
        return rows;
    });
}
