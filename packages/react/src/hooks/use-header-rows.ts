import type { HeaderRowInfo } from "../context";

import { useGridView } from "./use-grid-view";

/** The header rows a render shows, the top one first (none without a header). */
export function useHeaderRows<
    TRow = unknown,
>(): readonly HeaderRowInfo<TRow>[] {
    return useGridView<TRow>().headerRows;
}
