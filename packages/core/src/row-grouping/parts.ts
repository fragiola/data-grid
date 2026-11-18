import { controlPart, type PartResult } from "../adapter/props";
import { GROUP_TOGGLE_ATTRIBUTE } from "../engine/dom";
import type { RowRead } from "../engine/parts";
import type { GridView } from "../engine/types";
import { depthOf, groupExpanded, groupKeyAt, rowMetaAt } from "../model/source";
import type { RowKey, RowMeta } from "../model/types";
import type { RowGroupingView } from "./types";

// A row group's toggle (Epic #87; row grouping's since Epic #151): a control in a row's cell that
// expands its group, marked for the engine (a click on it runs `row-groups.toggle`).

/**
 * The state of a row group's toggle (Epic #87): the control the app renders in a group row (or a
 * row that expands), which expands and collapses it.
 */
export interface GroupToggleState {
    readonly rowIndex: number;
    /** the key it expands by (a group row's group key, a row's own key), `undefined` when it does not */
    readonly groupKey: RowKey | undefined;
    /** its row expands: a click on it toggles; else it does nothing (render none) */
    readonly expandable: boolean;
    /** its row shows its rows */
    readonly expanded: boolean;
    /** its row's depth, 0 at the top */
    readonly depth: number;
}

/** A row group's toggle's state and its attributes (Epic #87): marked with its row's index. */
export interface GroupTogglePart {
    readonly state: GroupToggleState;
    /** `undefined` for a row that does not expand: render no toggle */
    readonly attributes:
        | {
              readonly "aria-expanded": boolean;
              readonly [GROUP_TOGGLE_ATTRIBUTE]: number;
          }
        | undefined;
}

/**
 * A row group's toggle (Epic #87): whether its row expands and is expanded, and the attributes
 * that mark it for the engine (a click on it runs `row-groups.toggle`) with its `aria-expanded`.
 */
export function groupTogglePart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
    read?: RowRead,
): GroupTogglePart {
    const meta = read ? read.meta : rowMetaAt(view.source, rowIndex);
    const groupKey = groupKeyAt(view, rowIndex, meta);
    const expanded = groupExpanded(
        view as GridView<TRow, TNode> & Partial<RowGroupingView>,
        groupKey,
    );
    return {
        state: {
            rowIndex,
            groupKey,
            expandable: groupKey !== undefined,
            expanded,
            depth: depthOf(meta),
        },
        attributes:
            groupKey === undefined
                ? undefined
                : {
                      "aria-expanded": expanded,
                      [GROUP_TOGGLE_ATTRIBUTE]: rowIndex,
                  },
    };
}

const groupToggleData = (state: GroupToggleState) => ({
    "grid-part": "group-toggle",
    expanded: state.expanded,
});

/** A row group's toggle's state and props (`useGroupToggle`): none under a row that does not expand. */
export function groupTogglePartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: {
        readonly rowIndex: number;
        /** the row's kind as read (a row's or a cell's info carries it): not read again */
        readonly meta?: RowMeta | undefined;
    },
): PartResult<GroupToggleState> {
    const { state, attributes } = groupTogglePart(
        view,
        row.rowIndex,
        "meta" in row ? { meta: row.meta } : undefined,
    );
    return controlPart(state, attributes, groupToggleData);
}
