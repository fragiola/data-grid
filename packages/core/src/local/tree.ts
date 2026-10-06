import type { Column, RowKey, RowKeyGetter, SortColumn } from "../model/types";
import { keySet } from "../utils";
import type { RowEntry } from "./filter";
import type { ShownRow } from "./group";
import { sortEntries } from "./sort";

// Tree data in memory (Epic #87, E3.3): rows with rows of their own under them (`getSubRows`),
// flattened as the grid shows them, the same shape as grouped rows (`GroupedRows`). A parent is a
// data row that expands (`RowMeta.expandable`) by its own key, through the grid's expanded group
// keys. Every row of the tree, at any depth, is an entry: its index is its place in the tree read
// top to bottom, every parent before its rows (what a column's `getValue` and the default key
// get), so filters, the search and the keys work on the whole tree at once.

/** A row of the tree: its entry, and the rows under it (none for a leaf). */
export interface TreeNode<TRow> {
    readonly entry: RowEntry<TRow>;
    readonly children: readonly TreeNode<TRow>[];
}

/** A tree read from its top rows: its top nodes, and every row's entry, in the tree's order. */
export interface Tree<TRow> {
    readonly roots: readonly TreeNode<TRow>[];
    /** every row at every depth, each parent before the rows under it: `entries[i].index` is `i` */
    readonly entries: readonly RowEntry<TRow>[];
}

/** The tree under `rows` (the top ones), `getSubRows` telling each row's rows. */
export function treeOf<TRow>(
    rows: readonly TRow[],
    getSubRows: (row: TRow) => readonly TRow[] | undefined,
): Tree<TRow> {
    const entries: RowEntry<TRow>[] = [];
    const read = (level: readonly TRow[]): TreeNode<TRow>[] =>
        level.map((row) => {
            const entry = { row, index: entries.length };
            entries.push(entry);
            return { entry, children: read(getSubRows(row) ?? []) };
        });
    return { roots: read(rows), entries };
}

/**
 * The tree the filters and the search leave (`matched`: the entries that pass), the usual tree
 * filter: a row that passes, and every row above it (its ancestors stay, to reach it); a row that
 * does not pass and holds none that does goes. Each parent's rows sorted among themselves by
 * `sortColumns` (as `sortEntries` sorts rows). The same tree when nothing filters or sorts.
 */
export function keptTree<TRow, TNode>(
    roots: readonly TreeNode<TRow>[],
    all: readonly RowEntry<TRow>[],
    matched: readonly RowEntry<TRow>[],
    sortColumns: readonly SortColumn[],
    columns: readonly Column<TRow, TNode>[],
): readonly TreeNode<TRow>[] {
    const keeps = matched === all ? null : new Set(matched);
    if (!keeps && sortColumns.length === 0) return roots;
    const keep = (nodes: readonly TreeNode<TRow>[]): TreeNode<TRow>[] => {
        const kept: TreeNode<TRow>[] = [];
        for (const node of nodes) {
            const children = keep(node.children);
            if (keeps && !keeps.has(node.entry) && children.length === 0) {
                continue;
            }
            kept.push(
                children.length === node.children.length &&
                    children.every((child, at) => child === node.children[at])
                    ? node
                    : { entry: node.entry, children },
            );
        }
        if (sortColumns.length === 0 || kept.length < 2) return kept;
        // siblings sorted among themselves: the sort hands the same entries back, in order
        const nodeOf = new Map(kept.map((node) => [node.entry, node]));
        return sortEntries(
            kept.map((node) => node.entry),
            sortColumns,
            columns,
        ).flatMap((entry) => {
            const node = nodeOf.get(entry);
            return node ? [node] : [];
        });
    };
    return keep(roots);
}

/** A tree row's key: `rowKey`'s answer with its index in the tree, else that index. */
export function treeKeyOf<TRow>(
    entry: RowEntry<TRow>,
    rowKey: RowKeyGetter<TRow> | undefined,
): RowKey {
    return rowKey ? rowKey(entry.row, entry.index) : entry.index;
}

/** The keys of every parent, at every depth, the outer ones first: what expanding them all sets. */
export function parentKeysOf<TRow>(
    roots: readonly TreeNode<TRow>[],
    rowKey: RowKeyGetter<TRow> | undefined,
): readonly RowKey[] {
    const keys: RowKey[] = [];
    const add = (nodes: readonly TreeNode<TRow>[]) => {
        for (const node of nodes) {
            if (node.children.length === 0) continue;
            keys.push(treeKeyOf(node.entry, rowKey));
            add(node.children);
        }
    };
    add(roots);
    return keys;
}

/** A node's subtree keys, as last worked out, and what they were worked out with. */
const subtrees = new WeakMap<
    object,
    {
        readonly rowKey: unknown;
        readonly isRowSelectable: unknown;
        readonly keys: readonly RowKey[];
    }
>();

/**
 * The keys of every row under a node, at every depth (the tree as kept), less the rows
 * `isRowSelectable` refuses: worked out once per node (a kept tree's nodes are new only where it
 * changed), key getter and predicate.
 */
export function subtreeKeysOf<TRow>(
    node: TreeNode<TRow>,
    rowKey: RowKeyGetter<TRow> | undefined,
    isRowSelectable?: ((row: TRow) => boolean) | undefined,
): readonly RowKey[] {
    const known = subtrees.get(node);
    if (
        known &&
        known.rowKey === rowKey &&
        known.isRowSelectable === isRowSelectable
    ) {
        return known.keys;
    }
    const keys: RowKey[] = [];
    const add = (nodes: readonly TreeNode<TRow>[]) => {
        for (const child of nodes) {
            if (!isRowSelectable || isRowSelectable(child.entry.row)) {
                keys.push(treeKeyOf(child.entry, rowKey));
            }
            add(child.children);
        }
    };
    add(node.children);
    subtrees.set(node, { rowKey, isRowSelectable, keys });
    return keys;
}

/** Every row of a kept tree, at every depth, in its order (each parent before its rows). */
export function treeEntriesOf<TRow>(
    roots: readonly TreeNode<TRow>[],
): readonly RowEntry<TRow>[] {
    const entries: RowEntry<TRow>[] = [];
    const add = (nodes: readonly TreeNode<TRow>[]) => {
        for (const node of nodes) {
            entries.push(node.entry);
            add(node.children);
        }
    };
    add(roots);
    return entries;
}

/**
 * The rows the grid shows of a tree: each row, then, while it is a parent whose key is expanded,
 * its rows, each with its kind: its depth, whether it expands, the index of the row it is under,
 * its set's size and its place in it.
 */
export function shownTreeOf<TRow>(
    roots: readonly TreeNode<TRow>[],
    expandedGroupKeys: readonly RowKey[],
    rowKey: RowKeyGetter<TRow> | undefined,
): readonly ShownRow<TRow>[] {
    const expanded = keySet(expandedGroupKeys);
    const shown: ShownRow<TRow>[] = [];
    const add = (
        nodes: readonly TreeNode<TRow>[],
        depth: number,
        parentIndex: number | undefined,
    ) => {
        nodes.forEach((node, at) => {
            const index = shown.length;
            const parent = node.children.length > 0;
            shown.push({
                meta: {
                    depth,
                    ...(parent ? { expandable: true } : {}),
                    parentIndex,
                    setSize: nodes.length,
                    posInSet: at + 1,
                },
                entry: node.entry,
                node,
            });
            if (parent && expanded.has(treeKeyOf(node.entry, rowKey))) {
                add(node.children, depth + 1, index);
            }
        });
    };
    add(roots, 0, undefined);
    return shown;
}
