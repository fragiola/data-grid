import type { RowMeta } from "@fragiola/data-grid";
import {
    type GroupToggleState,
    groupTogglePartOf,
} from "@fragiola/data-grid/row-grouping";

import type { PartHookResult } from "../hooks/internal";
import { useGridView } from "../hooks/use-grid-view";

/**
 * A row group's toggle (Epic #87): the state and props of a control the app renders in a group
 * row (or a row that expands; `row` is a row's or a cell's info), which expands and collapses it:
 * a click on it runs `row-groups.toggle` (the engine's, after the app's own `onClick`; a control of
 * its cell, never a sort or a selection). The props are its `aria-expanded` and its mark; its
 * element (a `button`), name (`aria-label`), look and place are the app's. Under a row that does
 * not expand (`state.expandable` false) it has no props: render none there.
 */
export function useGroupToggle(row: {
    readonly rowIndex: number;
    /** the row's kind as read (a row's or a cell's info carries it): not read again */
    readonly meta?: RowMeta | undefined;
}): PartHookResult<GroupToggleState> {
    return groupTogglePartOf(useGridView(), row);
}
