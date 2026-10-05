import {
    columnPart,
    isHeaderRow,
    partEnd,
    partStart,
    pinnedPart,
    pinnedPartsOf,
} from "../header/header";
import { lowerBound, sameList } from "../utils";
import type {
    Column,
    HeaderCellLayout,
    HeaderLayout,
    PinnedSide,
    ReorderSide,
} from "./types";

// The column order (Epic #75, O1, O2, O5): the model keeps the keys of columns and groups in the
// order siblings take; the entries of `columns` are laid out in it, each sibling list on its own
// (a group's children, or the top level), so an entry moves only among its siblings and a group
// moves whole. Pure: the model lays the columns out with it, the engine drags and moves by it.

/** What orders an entry among its siblings: its key (`pinnedPart` tells its part). */
interface Entry {
    readonly key: string;
}

/** The parts a sibling list is ordered in, each apart. */
const PARTS = ["start", undefined, "end"] as const;

/** What tells an entry reorderable: its own flag, or for a group one below it. */
interface ReorderableEntry {
    readonly reorderable?: boolean | undefined;
    readonly children?: readonly ReorderableEntry[] | undefined;
}

/**
 * How the layout orders a sibling list (`layoutColumns`): the entries the order lists take the
 * places of the listed ones, in its order; the others keep theirs. Each part (pinned at the
 * start, not pinned, pinned at the end) is ordered apart, so the pinned ones lead and trail
 * whatever the order says (P1). `undefined` for an empty order: the entries as declared.
 */
export function siblingOrder(
    columnOrder: readonly string[],
): (<E extends Entry>(list: readonly E[]) => readonly E[]) | undefined {
    if (columnOrder.length === 0) return undefined;
    const rank = new Map(columnOrder.map((key, index) => [key, index]));
    return (list) => {
        const ordered = [...list];
        for (const part of PARTS) {
            const slots: number[] = [];
            const listed: { entry: (typeof list)[number]; at: number }[] = [];
            list.forEach((entry, index) => {
                const at = rank.get(entry.key);
                // a group is pinned by its columns, all in one part
                if (at !== undefined && pinnedPart(entry) === part) {
                    slots.push(index);
                    listed.push({ entry, at });
                }
            });
            listed.sort((a, b) => a.at - b.at);
            slots.forEach((slot, i) => {
                const item = listed[i];
                if (item) ordered[slot] = item.entry;
            });
        }
        return ordered;
    };
}

/** The order kept of a value: its strings, each once (an option's, lenient as the others). */
export function keptOrder(columnOrder: unknown): readonly string[] {
    if (!Array.isArray(columnOrder)) return [];
    return [
        ...new Set(
            columnOrder.filter((key): key is string => typeof key === "string"),
        ),
    ];
}

/** Whether two orders list the same keys in the same order. */
export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
    return sameList(a, b, Object.is);
}

/** Whether a header cell's column or group can be moved (`reorderable`). */
export function isReorderable(cell: {
    readonly column?: ReorderableEntry | undefined;
    readonly group?: ReorderableEntry | undefined;
}): boolean {
    return (cell.group ?? cell.column)?.reorderable === true;
}

const reorderableLists = new WeakMap<readonly ReorderableEntry[], boolean>();

/**
 * Whether a column or a group of the grid is reorderable: found once per list (the state's are
 * never mutated).
 */
export function hasReorderable(entries: readonly ReorderableEntry[]): boolean {
    let has = reorderableLists.get(entries);
    if (has === undefined) {
        has = entries.some(
            (entry) =>
                entry.reorderable === true ||
                (entry.children !== undefined &&
                    hasReorderable(entry.children)),
        );
        reorderableLists.set(entries, has);
    }
    return has;
}

/**
 * A header cell among its siblings (O2): the cells of the same parent group (or of the top level)
 * in order, where it is among them (-1 for a column a header span covers, E1.2: it has no cell
 * there), and the part it may move within, the ones pinned at the start, the ones pinned at the
 * end or the others (`[start, end)`).
 */
export interface Siblings<TRow, TNode> {
    readonly cell: HeaderCellLayout<TRow, TNode>;
    readonly cells: readonly HeaderCellLayout<TRow, TNode>[];
    readonly index: number;
    readonly start: number;
    readonly end: number;
    /** where it is pinned: it moves among the cells pinned there; `undefined`, among the others */
    readonly pinned: PinnedSide | undefined;
}

/**
 * The siblings of the cell with this key, from the header's layout: its parent is the cell
 * above its first column, and its siblings the cells of its row under that parent. `null` for a
 * key that is no column or group.
 */
export function siblingsOf<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
    header: HeaderLayout<TRow, TNode>,
    columnKey: string,
): Siblings<TRow, TNode> | null {
    const cell = header.cellByKey(columnKey);
    const row = cell && header.rows[cell.rowIndex + header.depth];
    if (!cell || !row) return null;
    const parent = header.cellAt(cell.rowIndex - 1, cell.columnIndex);
    const from = parent?.columnIndex ?? 0;
    const to = parent
        ? parent.columnIndex + parent.columnSpan
        : Number.POSITIVE_INFINITY;
    const cells: HeaderCellLayout<TRow, TNode>[] = [];
    for (
        let i = lowerBound(
            row.length,
            (j) => (row[j]?.columnIndex ?? 0) < from,
        );
        i < row.length;
        i++
    ) {
        const sibling = row[i];
        if (!sibling || sibling.columnIndex >= to) break;
        cells.push(sibling);
    }
    // pinned columns lead and trail: the pinned cells too, among their part's
    const { startCount, endFrom } = pinnedPartsOf(columns);
    /** the index of the first of `cells` from column `columnIndex` on */
    const firstFrom = (columnIndex: number) =>
        lowerBound(
            cells.length,
            (i) => (cells[i]?.columnIndex ?? columnIndex) < columnIndex,
        );
    const at = cell.columnIndex;
    return {
        cell,
        cells,
        index: cells.indexOf(cell),
        start: firstFrom(partStart(at, startCount, endFrom)),
        end: firstFrom(partEnd(at, startCount, endFrom, columns.length)),
        pinned: columnPart(at, startCount, endFrom),
    };
}

/**
 * The key of a cell's column or group: a header cell's own, a body (or summary row) cell's
 * column's. What an order change keeps the active cell on.
 */
export function cellKeyAt<TRow, TNode>(
    state: {
        readonly header: HeaderLayout<TRow, TNode>;
        readonly columns: readonly Column<TRow, TNode>[];
    },
    position: { readonly rowIndex: number; readonly columnIndex: number },
): string | undefined {
    return isHeaderRow(position.rowIndex, state.header)
        ? state.header.cellAt(position.rowIndex, position.columnIndex)?.key
        : state.columns[position.columnIndex]?.key;
}

/**
 * Where an entry at `index` among its siblings lands, dropped on `side` of the one at
 * `targetIndex` (itself included): its index once moved.
 */
export function landingIndex(
    index: number,
    targetIndex: number,
    side: ReorderSide,
): number {
    const to = side === "before" ? targetIndex : targetIndex + 1;
    return to > index ? to - 1 : to;
}

/**
 * The order after a move among siblings: the siblings' keys in their new order (`keys`), in place
 * of where the first of them was listed (or last), the other keys kept as they are.
 */
export function movedOrder(
    columnOrder: readonly string[],
    keys: readonly string[],
): readonly string[] {
    const moved = new Set(keys);
    const kept = columnOrder.filter((key) => !moved.has(key));
    // nothing before the first of them is one of them
    const at = columnOrder.findIndex((key) => moved.has(key));
    const index = at < 0 ? kept.length : at;
    return [...kept.slice(0, index), ...keys, ...kept.slice(index)];
}
