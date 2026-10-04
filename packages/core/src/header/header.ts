import type {
    Column,
    ColumnGroup,
    ColumnOrGroup,
    HeaderCellLayout,
    HeaderLayout,
} from "../model/types";
import { isWidth, lowerBound } from "../utils";

// Column groups (Epic #13, G1–G3): the entries of `columns` are columns or groups of them. The
// leaves, in order, are the grid's columns; the header has as many rows as the deepest leaf needs,
// and a leaf with fewer groups above it spans the rows down to the last (G2). Pure: the model
// lays the header out once per `columns.set`, the engine takes the cells a column window needs.

/** Whether an entry of `columns` is a group. */
export function isColumnGroup<TRow, TNode>(
    entry: ColumnOrGroup<TRow, TNode>,
): entry is ColumnGroup<TRow, TNode> {
    return entry.children !== undefined;
}

/** A group's children, or none for malformed ones (`columnsError` refuses them). */
function childrenOf<TRow, TNode>(
    group: ColumnGroup<TRow, TNode>,
): readonly ColumnOrGroup<TRow, TNode>[] {
    return Array.isArray(group.children) ? group.children : [];
}

/** The header's rows: its depth with a header, 0 without (a header row 0 high). */
export function headerRowCount(state: {
    readonly headerRowHeight: number;
    readonly header: Pick<HeaderLayout<unknown>, "depth">;
}): number {
    return state.headerRowHeight > 0 ? state.header.depth : 0;
}

/** The grid's columns and its header, from the entries of `columns`. */
export interface ColumnLayout<TRow, TNode> {
    readonly columns: readonly Column<TRow, TNode>[];
    readonly header: HeaderLayout<TRow, TNode>;
}

/**
 * Why the entries are not a valid `columns`, or `null`: every key unique across groups and
 * columns (so no group inside itself), every width finite and not negative (limits too, the
 * minimum not above the maximum), and at least one column under every group.
 */
export function columnsError(entries: unknown): string | null {
    if (!Array.isArray(entries)) return "columns must be an array";
    // a group inside itself repeats its own key: refused as a duplicate before it is entered again
    const keys = new Set<string>();
    /** an unpinned column was met: a pinned one after it would not be at the start */
    let unpinnedSeen = false;
    /** the columns below `list`, or an error */
    const visit = (list: readonly unknown[]): number | string => {
        let leaves = 0;
        for (const entry of list) {
            if (typeof entry !== "object" || entry === null) {
                return "an entry of columns is not an object";
            }
            const key: unknown = Reflect.get(entry, "key");
            if (typeof key !== "string") return "an entry has no string key";
            if (keys.has(key))
                return `two columns or groups have the key "${key}"`;
            keys.add(key);
            const children: unknown = Reflect.get(entry, "children");
            if (children === undefined) {
                if (!isWidth(Reflect.get(entry, "width"))) {
                    return `column "${key}" has an invalid width`;
                }
                const limits = limitsError(entry);
                if (limits) return `column "${key}" ${limits}`;
                const pinned: unknown = Reflect.get(entry, "pinned");
                if (pinned !== undefined && pinned !== "start") {
                    return `column "${key}" has an invalid pin`;
                }
                if (pinned === "start" && unpinnedSeen) {
                    return `pinned column "${key}" comes after an unpinned one: pinned columns come first`;
                }
                if (pinned !== "start") unpinnedSeen = true;
                leaves += 1;
                continue;
            }
            if (!Array.isArray(children)) {
                return `group "${key}" has children that are not an array`;
            }
            if (Reflect.get(entry, "pinned") !== undefined) {
                return `group "${key}" is pinned: a group is pinned by its columns`;
            }
            const before = unpinnedSeen;
            const below = visit(children);
            if (typeof below === "string") return below;
            if (below === 0) return `group "${key}" has no column`;
            // its columns all pinned, or none: one pinned column first then one that is not
            if (!before && unpinnedSeen && pinnedIn(children)) {
                return `group "${key}" mixes pinned and unpinned columns`;
            }
            leaves += below;
        }
        return leaves;
    };
    const result = visit(entries);
    return typeof result === "string" ? result : null;
}

/** Why a column's limits are invalid (W2), or `null`: each a width, the minimum not above the maximum. */
function limitsError(column: object): string | null {
    const min: unknown = Reflect.get(column, "minWidth");
    const max: unknown = Reflect.get(column, "maxWidth");
    if (min !== undefined && !isWidth(min)) return "has an invalid minWidth";
    if (max !== undefined && !isWidth(max)) return "has an invalid maxWidth";
    if (isWidth(min) && isWidth(max) && min > max) {
        return "has a minWidth above its maxWidth";
    }
    return null;
}

/** Whether a column below `list` is pinned. */
function pinnedIn(list: readonly unknown[]): boolean {
    return list.some((entry) => {
        if (typeof entry !== "object" || entry === null) return false;
        const children: unknown = Reflect.get(entry, "children");
        return Array.isArray(children)
            ? pinnedIn(children)
            : Reflect.get(entry, "pinned") === "start";
    });
}

/** How many columns are pinned at the start: the leading ones with `pinned: "start"`. */
export function pinnedColumnCount<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
): number {
    let count = 0;
    while (columns[count]?.pinned === "start") count += 1;
    return count;
}

/** A header of one row: a cell per column. */
function flatHeader<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
): HeaderLayout<TRow, TNode> {
    const cells: HeaderCellLayout<TRow, TNode>[] = columns.map(
        (column, columnIndex) => ({
            key: column.key,
            rowIndex: -1,
            columnIndex,
            columnSpan: 1,
            rowSpan: 1,
            column,
        }),
    );
    return {
        depth: 1,
        rows: [cells],
        cellAt: (rowIndex, columnIndex) =>
            rowIndex === -1 ? cells[columnIndex] : undefined,
        cellByKey: cellsByKey([cells]),
    };
}

/**
 * The lookup of the header's cells by their key (a column's or a group's): its map built on the
 * first lookup, so a grid that never looks one up never builds it.
 */
function cellsByKey<TRow, TNode>(
    rows: readonly (readonly HeaderCellLayout<TRow, TNode>[])[],
): HeaderLayout<TRow, TNode>["cellByKey"] {
    let byKey: Map<string, HeaderCellLayout<TRow, TNode>> | null = null;
    return (key) => {
        if (!byKey) {
            byKey = new Map();
            for (const row of rows) {
                for (const cell of row) byKey.set(cell.key, cell);
            }
        }
        return byKey.get(key);
    };
}

/**
 * Lays the entries of `columns` out: their leaves, and the header's rows and cells. Without a
 * group, the columns are the entries themselves (the same array). It never throws: a group inside
 * itself is not entered again, and a group without columns has no cell (`columnsError` refuses
 * both).
 */
export function layoutColumns<TRow, TNode>(
    entries: readonly ColumnOrGroup<TRow, TNode>[],
): ColumnLayout<TRow, TNode> {
    if (entries.every((entry) => !isColumnGroup(entry))) {
        return { columns: entries, header: flatHeader(entries) };
    }
    // the depth first: a cell's row counts from the top
    const path = new Set<ColumnGroup<TRow, TNode>>();
    const levels = (list: readonly ColumnOrGroup<TRow, TNode>[]): number => {
        let deepest = 0;
        for (const entry of list) {
            if (!isColumnGroup(entry)) {
                deepest = Math.max(deepest, 1);
            } else if (!path.has(entry)) {
                path.add(entry);
                const below = levels(childrenOf(entry));
                path.delete(entry);
                if (below > 0) deepest = Math.max(deepest, below + 1);
            }
        }
        return deepest;
    };
    const depth = Math.max(1, levels(entries));
    const rows: HeaderCellLayout<TRow, TNode>[][] = Array.from(
        { length: depth },
        () => [],
    );
    const columns: Column<TRow, TNode>[] = [];
    const place = (
        list: readonly ColumnOrGroup<TRow, TNode>[],
        level: number,
    ) => {
        for (const entry of list) {
            const row = rows[level];
            if (!row) return;
            if (!isColumnGroup(entry)) {
                row.push({
                    key: entry.key,
                    rowIndex: level - depth,
                    columnIndex: columns.length,
                    columnSpan: 1,
                    rowSpan: depth - level,
                    column: entry,
                });
                columns.push(entry);
                continue;
            }
            if (path.has(entry)) continue;
            // its cell goes before its children's in the row: reserve its place
            const at = row.length;
            const columnIndex = columns.length;
            path.add(entry);
            place(childrenOf(entry), level + 1);
            path.delete(entry);
            const columnSpan = columns.length - columnIndex;
            if (columnSpan === 0) continue;
            row.splice(at, 0, {
                key: entry.key,
                rowIndex: level - depth,
                columnIndex,
                columnSpan,
                rowSpan: 1,
                group: entry,
            });
        }
    };
    place(entries, 0);
    // the cell covering each header position, per row then per column
    const cover: (HeaderCellLayout<TRow, TNode> | undefined)[][] = rows.map(
        () => new Array(columns.length),
    );
    rows.forEach((row, level) => {
        for (const cell of row) {
            for (let r = level; r < level + cell.rowSpan; r++) {
                const covered = cover[r];
                if (!covered) continue;
                for (
                    let c = cell.columnIndex;
                    c < cell.columnIndex + cell.columnSpan;
                    c++
                ) {
                    covered[c] = cell;
                }
            }
        }
    });
    return {
        columns,
        header: {
            depth,
            rows,
            cellAt: (rowIndex, columnIndex) =>
                cover[rowIndex + depth]?.[columnIndex],
            cellByKey: cellsByKey(rows),
        },
    };
}

/**
 * The cells of each header row a column window needs (G3): every cell intersecting
 * `[start, end)`, a group cut by either edge included, plus the cell holding `extra` (the active
 * column, rendered outside the window).
 */
export function headerCellsIn<TRow, TNode>(
    header: HeaderLayout<TRow, TNode>,
    start: number,
    end: number,
    extra: number | null = null,
): HeaderCellLayout<TRow, TNode>[][] {
    return header.rows.map((row, level) => {
        // the cells of a row are in column order, without overlaps: the first one ending after
        // `start` is found by bisection
        const low = lowerBound(row.length, (i) => {
            const cell = row[i];
            return (
                cell !== undefined &&
                cell.columnIndex + cell.columnSpan <= start
            );
        });
        const cells: HeaderCellLayout<TRow, TNode>[] = [];
        for (let i = low; i < row.length; i++) {
            const cell = row[i];
            if (!cell || cell.columnIndex >= end) break;
            cells.push(cell);
        }
        if (extra === null || (extra >= start && extra < end)) return cells;
        // the cell holding it in this row: one starting here (a column spanning from above is
        // its top row's)
        const holder = header.cellAt(level - header.depth, extra);
        if (
            !holder ||
            holder.rowIndex !== level - header.depth ||
            cells.includes(holder)
        ) {
            return cells;
        }
        return holder.columnIndex < start
            ? [holder, ...cells]
            : [...cells, holder];
    });
}
