import type { ColumnResizerState } from "@fragiola/data-grid";
import { columnResizerPartOf } from "@fragiola/data-grid";
import type { HeaderCellInfo } from "../context";
import { injectGridView } from "./inject-data-grid";
import {
    type PartInjectResult,
    partResult,
    type ValueOrSignal,
    valueNow,
} from "./internal";

/** A column resizer's state and props (Epic #70; React's `useColumnResizer`): no props under a cell that does not resize. `*dataGridColumnResizer` is its directive. */
export function injectColumnResizer<TRow>(
    cell: ValueOrSignal<HeaderCellInfo<TRow>>,
): PartInjectResult<ColumnResizerState> {
    const view = injectGridView<TRow>();
    return partResult(() => columnResizerPartOf(view(), valueNow(cell)));
}
