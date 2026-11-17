import { computed, type Signal } from "@angular/core";
import { rowCellsOf } from "@fragiola/data-grid";
import type { CellInfo, RowInfo } from "../context";
import { injectGridView } from "./inject-data-grid";
import { type ValueOrSignal, valueNow } from "./internal";

/**
 * The cells a row renders, with their columns and values (React's `useCells`): one per rendered
 * column, but a cell spanning columns (a column's `colSpan`, Epic #85) stands for the ones it
 * covers.
 */
export function injectCells<TRow = unknown>(
    row: ValueOrSignal<RowInfo<TRow>>,
): Signal<CellInfo<TRow>[]> {
    const view = injectGridView<TRow>();
    return computed(() => rowCellsOf(view(), valueNow(row)));
}
