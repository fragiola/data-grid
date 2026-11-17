import type { CellState } from "@fragiola/data-grid";
import { cellPartOf } from "@fragiola/data-grid";
import type { CellInfo } from "../context";
import { injectGridView } from "./inject-data-grid";
import {
    type PartInjectResult,
    partResult,
    type ValueOrSignal,
    valueNow,
} from "./internal";

/** A body cell's state, and the props for its element (React's `useCell`): the roving tab stop, ARIA, `data-*`, its structural style. */
export function injectCell<TRow>(
    cell: ValueOrSignal<CellInfo<TRow>>,
): PartInjectResult<CellState> {
    const view = injectGridView<TRow>();
    return partResult(() => cellPartOf(view(), valueNow(cell)));
}
