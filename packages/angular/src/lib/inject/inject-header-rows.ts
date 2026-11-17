import { computed, type Signal } from "@angular/core";
import type { HeaderRowInfo } from "../context";
import { injectGridView } from "./inject-data-grid";

/** The header rows a render shows, the top one first (none without a header; React's `useHeaderRows`). */
export function injectHeaderRows<TRow = unknown>(): Signal<
    readonly HeaderRowInfo<TRow>[]
> {
    const view = injectGridView<TRow>();
    return computed(() => view().headerRows);
}
