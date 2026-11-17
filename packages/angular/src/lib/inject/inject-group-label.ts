import { type GroupLabelState, groupLabelPartOf } from "@fragiola/data-grid";
import type { HeaderCellInfo } from "../context";
import {
    type PartInjectResult,
    partResult,
    type ValueOrSignal,
    valueNow,
} from "./internal";

/**
 * A group's label's state and props (Epic #85, E1.3; React's `useGroupLabel`). The engine writes
 * its inset through `[dataGridGroupLabel]`: use the directive for its element.
 */
export function injectGroupLabel<TRow>(
    cell: ValueOrSignal<HeaderCellInfo<TRow>>,
): PartInjectResult<GroupLabelState> {
    return partResult(() => groupLabelPartOf(valueNow(cell)));
}
