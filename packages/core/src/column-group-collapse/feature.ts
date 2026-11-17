import type { HeaderCellState } from "../engine/parts";
import type { GridView } from "../engine/types";
import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
    type FeaturePartContribution,
    type FeatureState,
} from "../feature/feature";
import { keptOrder } from "../model/key-lists";
import { done, fail, invalid } from "../model/result";
import type { HeaderCellLayout } from "../model/types";
import { keySet, sameKeys, toggledKey } from "../utils/utils";
import { collapsingKeys, groupByKey, isGroupCollapsed } from "./collapse";
import type {
    ColumnGroupCollapseProps,
    ColumnGroupCollapseTypes,
} from "./types";

// Collapsible column groups (Epic #85, E1.3; a feature since Epic #148): the model keeps the
// collapsed groups' keys (`column-groups.set`, `column-groups.toggle`), and a collapsible group's
// header cell is `collapsed` or not (`data-collapsible`, `data-collapsed`); collapsed, it shows
// only its children whose `groupShow` is `"collapsed"` or unset. The groups themselves (their
// header rows, spans and sticky labels) are the core's: without collapsing, a collapsible group
// is expanded, and its toggle does nothing.

/** The state as collapsing reads it. */
type State = FeatureState<ColumnGroupCollapseTypes>;

/** The state with the collapsed groups' keys (a set: the same keys reordered change nothing). */
function withCollapsed(state: State, collapsedGroupKeys: readonly string[]) {
    const next = sameKeys(collapsedGroupKeys, state.collapsedGroupKeys)
        ? state
        : { ...state, collapsedGroupKeys };
    return done(next, next.collapsedGroupKeys);
}

/** A header cell's collapse: a collapsible group's, collapsed or not; `undefined` for the others. */
function headerCellPart(
    view: GridView<unknown, unknown> & {
        readonly collapsedGroupKeys: readonly string[];
    },
    cell: HeaderCellLayout<unknown, unknown>,
): FeaturePartContribution<HeaderCellState> {
    return cell.group?.collapsible === true
        ? {
              state: {
                  collapsed: keySet(view.collapsedGroupKeys).has(cell.key),
              },
          }
        : NOT_COLLAPSIBLE;
}

/** A header cell that does not collapse: nothing of collapsing's. */
const NOT_COLLAPSIBLE: FeaturePartContribution<HeaderCellState> = {};

/** Collapsing's definition: every grid installing it shares it. */
const COLLAPSE = defineFeature<ColumnGroupCollapseTypes>({
    name: "columnGroupCollapse",
    initial: (_state, options) => ({
        collapsedGroupKeys: keptOrder(options.collapsedGroupKeys),
    }),
    commands: {
        "column-groups.set": (state, { groupKeys }) => {
            if (
                !Array.isArray(groupKeys) ||
                groupKeys.some((key) => typeof key !== "string")
            ) {
                return invalid("groupKeys must be an array of keys");
            }
            return withCollapsed(state, [...new Set(groupKeys)]);
        },
        "column-groups.toggle": (state, { groupKey }) => {
            const group =
                typeof groupKey === "string"
                    ? groupByKey(state.columnEntries, groupKey)
                    : undefined;
            if (!group) return fail("not_found", `no group "${groupKey}"`);
            if (group.collapsible !== true) {
                return fail("refused", `group "${groupKey}" does not collapse`);
            }
            return withCollapsed(
                state,
                toggledKey(state.collapsedGroupKeys, groupKey),
            );
        },
    },
    queries: {
        "collapsed-group-keys": (state) => state.collapsedGroupKeys,
    },
    questions: {
        "group-collapsed": (state, { groupKey }) =>
            isGroupCollapsed(state, groupKey),
    },
    columnLayout: {
        // keys of no collapsible group (kept: it may come back) collapse nothing: no new layout
        changed: (after, before) =>
            after.collapsedGroupKeys !== before.collapsedGroupKeys &&
            !sameKeys(
                collapsingKeys(after.columnEntries, after.collapsedGroupKeys),
                collapsingKeys(after.columnEntries, before.collapsedGroupKeys),
            ),
        arrangement: (state) => {
            const collapsed = keySet(state.collapsedGroupKeys);
            return { collapsed: (groupKey) => collapsed.has(groupKey) };
        },
    },
    view: ["collapsedGroupKeys"],
    headerCell: headerCellPart,
    engine: () => ({
        // a collapse keeps the view on the column it showed first, by key (E1.3)
        columnAnchored: (before, after) =>
            (after as State).collapsedGroupKeys !==
            (before as State).collapsedGroupKeys,
    }),
    root: {
        props: [
            "collapsedGroupKeys",
            "defaultCollapsedGroupKeys",
            "onCollapsedGroupKeysChange",
        ],
        options: (props) => ({
            collapsedGroupKeys:
                props.collapsedGroupKeys ?? props.defaultCollapsedGroupKeys,
        }),
        controlled: (model) => [
            defineControlled<
                ColumnGroupCollapseProps,
                State,
                readonly string[]
            >({
                prefix: "column-groups.",
                prop: (props) => props.collapsedGroupKeys,
                onChange: (props) => props.onCollapsedGroupKeysChange,
                // keys to start with that were not all strings (or listed one twice) start without
                // those: the app is told the keys the grid holds
                start: (props) => props.defaultCollapsedGroupKeys,
                read: (state) => state.collapsedGroupKeys,
                // a set: the same keys in another order are no change
                same: sameKeys,
                // kept as at mount, and the parent told the keys as they settled
                apply: (groupKeys) => {
                    model.run("column-groups.set", {
                        groupKeys: keptOrder(groupKeys),
                    });
                },
                // a layout input: settled first, a position the collapse moved in the same pass
                first: "layout",
            }),
        ],
    },
});

/**
 * Collapsible column groups (`@fragiola/data-grid/column-group-collapse`): install it on a grid
 * (`features: [columnGroupCollapse()]`) for its `collapsible` groups to collapse. Without it, a
 * collapsible group stays expanded.
 */
export function columnGroupCollapse(): DataGridFeature<ColumnGroupCollapseTypes> {
    return COLLAPSE;
}
