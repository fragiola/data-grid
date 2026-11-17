import type { HeaderCellState } from "@fragiola/data-grid";
import { headerCellPartOf } from "@fragiola/data-grid";
import type { HeaderCellInfo } from "../context";
import { injectGridView } from "./inject-data-grid";
import {
    type PartInjectResult,
    partResult,
    type ValueOrSignal,
    valueNow,
} from "./internal";

/** A header cell's state, and the props for its element (React's `useHeaderCell`). */
export function injectHeaderCell<TRow>(
    cell: ValueOrSignal<HeaderCellInfo<TRow>>,
): PartInjectResult<HeaderCellState> {
    const view = injectGridView<TRow>();
    return partResult(() => headerCellPartOf(view(), valueNow(cell)));
}
