import { rowsOf } from "@fragiola/data-grid";
import { type RowInfo, useRootGrid } from "../context";

import { useGridView } from "./use-grid-view";

/** The rows a render shows, with their data, keys and kinds (Epic #87: a group row, a depth). */
export function useRows<TRow = unknown>(): RowInfo<TRow>[] {
    // outside a `Root`, the grid's own error first
    useRootGrid();
    return rowsOf(useGridView<TRow>());
}
