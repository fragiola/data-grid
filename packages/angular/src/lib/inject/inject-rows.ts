import { computed, type Signal } from "@angular/core";
import { rowsOf } from "@fragiola/data-grid";
import type { RowInfo } from "../context";
import { injectGridView } from "./inject-data-grid";

/** The rows a render shows, with their data, keys and kinds (Epic #87; React's `useRows`). */
export function injectRows<TRow = unknown>(): Signal<RowInfo<TRow>[]> {
    const view = injectGridView<TRow>();
    return computed(() => rowsOf(view()));
}
