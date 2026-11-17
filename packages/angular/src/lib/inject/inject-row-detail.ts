import type { RowDetailState } from "@fragiola/data-grid";
import { rowDetailPartOf } from "@fragiola/data-grid";
import type { RowInfo } from "../context";
import { injectGridView } from "./inject-data-grid";
import {
    type PartInjectResult,
    partResult,
    type ValueOrSignal,
    valueNow,
} from "./internal";

/** A row's detail (M3): its state, and the props for its element (render it only while `state().expanded`; React's `useRowDetail`). */
export function injectRowDetail<TRow>(
    row: ValueOrSignal<RowInfo<TRow>>,
): PartInjectResult<RowDetailState> {
    const view = injectGridView<TRow>();
    return partResult(() => rowDetailPartOf(view(), valueNow(row)));
}
