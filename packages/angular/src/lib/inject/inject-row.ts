import { type RowState, rowPartOf } from "@fragiola/data-grid";
import type { RowInfo } from "../context";
import { injectGridView } from "./inject-data-grid";
import {
    type PartInjectResult,
    partResult,
    type ValueOrSignal,
    valueNow,
} from "./internal";

/**
 * A body row's state, and the props for its element (ARIA, `data-*`, structural style; React's
 * `useRow`). A measured row (`rowHeight: "auto"`) is read by the engine through `[dataGridRow]`:
 * use the directive for one.
 */
export function injectRow<TRow>(
    row: ValueOrSignal<RowInfo<TRow>>,
): PartInjectResult<RowState> {
    const view = injectGridView<TRow>();
    return partResult(() => rowPartOf(view(), valueNow(row)));
}
