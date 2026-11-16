import { rowsOf } from "@fragiola/data-grid";
import { type ComputedRef, computed } from "vue";
import { type RowInfo, useGridView, useRootGrid } from "../context";

/** The rows a render shows, with their data, keys and kinds (Epic #87: a group row, a depth). */
export function useRows<TRow = unknown>(): ComputedRef<RowInfo<TRow>[]> {
    // outside a `Root`, the grid's own error first
    useRootGrid();
    const view = useGridView<TRow>();
    return computed(() => rowsOf(view.value));
}
