import { type ComputedRef, computed } from "vue";
import { type HeaderRowInfo, useGridView } from "../context";

/** The header rows a render shows, the top one first (none without a header). */
export function useHeaderRows<TRow = unknown>(): ComputedRef<
    readonly HeaderRowInfo<TRow>[]
> {
    const view = useGridView<TRow>();
    return computed(() => view.value.headerRows);
}
