import { entryByKey, isColumnGroup } from "../header/header";
import type { ColumnGroup, ColumnOrGroup } from "../model/types";

// Collapsible column groups (Epic #85, E1.3; a feature since Epic #148): the feature keeps the
// collapsed groups' keys, and lays a collapsible group's children out by its state (`groupShow`).
// Pure: its commands, layout and parts share it.

/** Whether a group is collapsed: a collapsible group of the entries, its key collapsed. */
export function isGroupCollapsed<TRow, TNode>(
    state: {
        readonly columnEntries: readonly ColumnOrGroup<TRow, TNode>[];
        readonly collapsedGroupKeys: readonly string[];
    },
    groupKey: string,
): boolean {
    return (
        state.collapsedGroupKeys.includes(groupKey) &&
        groupByKey(state.columnEntries, groupKey)?.collapsible === true
    );
}

/**
 * The keys that collapse a group: the ones of the entries' collapsible groups (the others are
 * kept, and collapse nothing).
 */
export function collapsingKeys<TRow, TNode>(
    entries: readonly ColumnOrGroup<TRow, TNode>[],
    keys: readonly string[],
): readonly string[] {
    return keys.filter((key) => groupByKey(entries, key)?.collapsible === true);
}

/** The group with this key among the entries (`entryByKey`), or `undefined` for a column or none. */
export function groupByKey<TRow, TNode>(
    entries: readonly ColumnOrGroup<TRow, TNode>[],
    key: string,
): ColumnGroup<TRow, TNode> | undefined {
    const entry = entryByKey(entries, key);
    return entry && isColumnGroup(entry) ? entry : undefined;
}
