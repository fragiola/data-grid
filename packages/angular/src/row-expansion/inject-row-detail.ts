import {
    type RowDetailState,
    rowDetailPartOf,
} from "@fragiola/data-grid/row-expansion";
import {
    injectGridView,
    type PartInjectResult,
    ɵpartResult as partResult,
    type RowInfo,
    type ValueOrSignal,
    ɵvalueNow as valueNow,
} from "@fragiola/data-grid-angular";

/** A row's detail (M3): its state, and the props for its element (render it only while `state().expanded`; React's `useRowDetail`). */
export function injectRowDetail<TRow>(
    row: ValueOrSignal<RowInfo<TRow>>,
): PartInjectResult<RowDetailState> {
    const view = injectGridView<TRow>();
    return partResult(() => rowDetailPartOf(view(), valueNow(row)));
}
