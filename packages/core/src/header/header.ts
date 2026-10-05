import type {
    Column,
    ColumnGroup,
    ColumnOrGroup,
    GroupShow,
    HeaderCellLayout,
    HeaderLayout,
    PinnedSide,
} from "../model/types";
import { isWidth, keySet, lowerBound, spanValue } from "../utils";

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
 * columns (so no group inside itself), every width finite and not negative (limits and `flex`
 * too, the minimum not above the maximum), `flex`, `autoSize` and `colSpan` (a function) on
 * columns only, at least one column under every group, the columns pinned at the start first and
 * the ones pinned at the end last, and a group's columns in one part; `groupShow` only under a
 * collapsible group, which shows a column in each of its states (E1.3).
 */
export function columnsError(entries: unknown): string | null {
    if (!Array.isArray(entries)) return "columns must be an array";
    // a group inside itself repeats its own key: refused as a duplicate before it is entered again
    const keys = new Set<string>();
    /** each column's part, in order: pinned at the start (0), not pinned (1), at the end (2) */
    const parts: number[] = [];
    /** the columns below `list` (the children of a collapsible group or not), or an error */
    const visit = (
        list: readonly unknown[],
        collapsible: boolean,
    ): number | string => {
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
            const show: unknown = Reflect.get(entry, "groupShow");
            if (show !== undefined) {
                if (show !== "expanded" && show !== "collapsed") {
                    return `"${key}" has an invalid groupShow`;
                }
                if (!collapsible) {
                    return `"${key}" has a groupShow, and its group is not collapsible`;
                }
            }
            const children: unknown = Reflect.get(entry, "children");
            if (children === undefined) {
                if (!isWidth(Reflect.get(entry, "width"))) {
                    return `column "${key}" has an invalid width`;
                }
                const limits = limitsError(entry);
                if (limits) return `column "${key}" ${limits}`;
                const flex: unknown = Reflect.get(entry, "flex");
                if (flex !== undefined && !isWidth(flex)) {
                    return `column "${key}" has an invalid flex`;
                }
                const autoSize: unknown = Reflect.get(entry, "autoSize");
                if (autoSize !== undefined && typeof autoSize !== "boolean") {
                    return `column "${key}" has an invalid autoSize`;
                }
                const colSpan: unknown = Reflect.get(entry, "colSpan");
                if (colSpan !== undefined && typeof colSpan !== "function") {
                    return `column "${key}" has a colSpan that is not a function`;
                }
                if (Reflect.get(entry, "collapsible") !== undefined) {
                    return `column "${key}" is collapsible: a group collapses`;
                }
                const pinned: unknown = Reflect.get(entry, "pinned");
                if (
                    pinned !== undefined &&
                    pinned !== "start" &&
                    pinned !== "end"
                ) {
                    return `column "${key}" has an invalid pin`;
                }
                const part = pinned === "start" ? 0 : pinned === "end" ? 2 : 1;
                const previous = parts[parts.length - 1] ?? 0;
                if (part < previous) {
                    return part === 0
                        ? `pinned column "${key}" comes after one that is not pinned at the start: pinned columns come first`
                        : `column "${key}" comes after one pinned at the end: those come last`;
                }
                parts.push(part);
                leaves += 1;
                continue;
            }
            if (!Array.isArray(children)) {
                return `group "${key}" has children that are not an array`;
            }
            if (Reflect.get(entry, "pinned") !== undefined) {
                return `group "${key}" is pinned: a group is pinned by its columns`;
            }
            if (
                Reflect.get(entry, "flex") !== undefined ||
                Reflect.get(entry, "autoSize") !== undefined
            ) {
                return `group "${key}" flexes or fits itself: a group is sized by its columns`;
            }
            if (Reflect.get(entry, "colSpan") !== undefined) {
                return `group "${key}" has a colSpan: a group spans its columns`;
            }
            const collapses: unknown = Reflect.get(entry, "collapsible");
            if (collapses !== undefined && typeof collapses !== "boolean") {
                return `group "${key}" has an invalid collapsible`;
            }
            const from = parts.length;
            const below = visit(children, collapses === true);
            if (typeof below === "string") return below;
            if (below === 0) return `group "${key}" has no column`;
            if (collapses === true) {
                // each state shows a child, and every child shows a column (a collapsible one too)
                for (const state of GROUP_SHOWS) {
                    if (!children.some((child) => showsIn(child, state))) {
                        return `group "${key}" shows no column ${state}`;
                    }
                }
            }
            // the parts come in order: its columns are in one part when its first and last are
            const first = parts[from];
            const last = parts[parts.length - 1];
            if (first !== last) {
                return first === 1 || last === 1
                    ? `group "${key}" mixes pinned and unpinned columns`
                    : `group "${key}" mixes columns pinned at the start and at the end`;
            }
            leaves += below;
        }
        return leaves;
    };
    const result = visit(entries, false);
    return typeof result === "string" ? result : null;
}

/** The states a collapsible group is in. */
const GROUP_SHOWS: readonly GroupShow[] = ["expanded", "collapsed"];

/** Whether a child of a collapsible group shows while it is in `state` (its `groupShow`, E1.3). */
function showsIn(child: unknown, state: GroupShow): boolean {
    const show: unknown =
        typeof child === "object" && child !== null
            ? Reflect.get(child, "groupShow")
            : undefined;
    return show === undefined || show === state;
}

/**
 * The column or group with this key among the entries, at any depth, the ones a collapsed group
 * hides included (E1.3): what a sort and a toggle find their entry by.
 */
export function entryByKey<TRow, TNode>(
    entries: readonly ColumnOrGroup<TRow, TNode>[],
    key: unknown,
): ColumnOrGroup<TRow, TNode> | undefined {
    for (const entry of entries) {
        if (entry.key === key) return entry;
        if (isColumnGroup(entry)) {
            const found = entryByKey(childrenOf(entry), key);
            if (found) return found;
        }
    }
    return undefined;
}

/**
 * Every leaf of the entries, in declared order, the ones a collapsed group hides included (E1.3):
 * the data a pipeline over rows reads (`/local`), not the grid's layout. The same array without
 * a group.
 */
export function leafColumns<TRow, TNode>(
    entries: readonly ColumnOrGroup<TRow, TNode>[],
): readonly Column<TRow, TNode>[] {
    if (
        entries.every(
            (entry): entry is Column<TRow, TNode> => !isColumnGroup(entry),
        )
    ) {
        return entries;
    }
    const leaves: Column<TRow, TNode>[] = [];
    const walk = (list: readonly ColumnOrGroup<TRow, TNode>[]) => {
        for (const entry of list) {
            if (isColumnGroup(entry)) walk(childrenOf(entry));
            else leaves.push(entry);
        }
    };
    walk(entries);
    return leaves;
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

/**
 * The part an entry is pinned in: a column's `pinned`, a group's its first column's (a group's
 * columns are all in one part); `undefined` when it is not pinned.
 */
export function pinnedPart(entry: unknown): PinnedSide | undefined {
    if (typeof entry !== "object" || entry === null) return undefined;
    const children: unknown = Reflect.get(entry, "children");
    if (Array.isArray(children)) return pinnedPart(children[0]);
    const pinned: unknown = Reflect.get(entry, "pinned");
    return pinned === "start" || pinned === "end" ? pinned : undefined;
}

/** How many columns are pinned at the start: the leading ones with `pinned: "start"`. */
export function pinnedColumnCount<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
): number {
    let count = 0;
    while (columns[count]?.pinned === "start") count += 1;
    return count;
}

/**
 * The first column pinned at the end, of `columnCount` columns with `pinnedEndCount` pinned there:
 * the column count without one. What tells a column of the end part (`index >= pinnedEndFrom`).
 */
export function pinnedEndFrom(
    columnCount: number,
    pinnedEndCount: number,
): number {
    return columnCount - pinnedEndCount;
}

/** How many columns are pinned at the end: the trailing ones with `pinned: "end"`. */
export function pinnedEndColumnCount<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
): number {
    let count = 0;
    while (columns[columns.length - 1 - count]?.pinned === "end") count += 1;
    return count;
}

/**
 * The parts the columns are pinned in as declared: how many lead pinned at the start, and the
 * first pinned at the end (`pinnedEndFrom`: the column count without one).
 */
export function pinnedPartsOf<TRow, TNode>(
    columns: readonly Column<TRow, TNode>[],
): { readonly startCount: number; readonly endFrom: number } {
    return {
        startCount: pinnedColumnCount(columns),
        endFrom: pinnedEndFrom(columns.length, pinnedEndColumnCount(columns)),
    };
}

/**
 * The part a column is in (P1, E1.1), of parts ending at `startCount` (the columns pinned at the
 * start) and starting at `endFrom` (the first pinned at the end, `pinnedEndFrom`): `"start"`,
 * `"end"`, or `undefined` for the columns that scroll. The one rule every part question asks.
 */
export function columnPart(
    columnIndex: number,
    startCount: number,
    endFrom: number,
): PinnedSide | undefined {
    if (columnIndex < startCount) return "start";
    return columnIndex >= endFrom ? "end" : undefined;
}

/** The first column of the part holding `columnIndex` (`columnPart`). */
export function partStart(
    columnIndex: number,
    startCount: number,
    endFrom: number,
): number {
    const part = columnPart(columnIndex, startCount, endFrom);
    return part === "start" ? 0 : part === "end" ? endFrom : startCount;
}

/** The end of the part holding `columnIndex` (`columnPart`), of `columnCount` columns. */
export function partEnd(
    columnIndex: number,
    startCount: number,
    endFrom: number,
    columnCount: number,
): number {
    const part = columnPart(columnIndex, startCount, endFrom);
    return part === "start"
        ? startCount
        : part === "end"
          ? columnCount
          : endFrom;
}

/**
 * A span `wanted` from the item at `at` (E1.2), never across its part: kept before `end` (its
 * part's end) and, with `inside`, to the items after it `inside` keeps in its run (a header cell's
 * column siblings). At least 1. The one clamp a body cell's and a header cell's spans share.
 */
export function keptSpan(
    wanted: unknown,
    at: number,
    end: number,
    inside?: (index: number) => boolean,
): number {
    const most = Math.min(spanValue(wanted), end - at);
    if (!inside) return Math.max(1, most);
    let span = 1;
    while (span < most && inside(at + span)) span += 1;
    return span;
}

/**
 * How many columns a column's header cell spans (E1.2): its `colSpan` for the header, kept to
 * the columns right after it among its siblings, in its part. 1 for a group, or without one.
 */
function headerSpan<TRow, TNode>(
    siblings: readonly ColumnOrGroup<TRow, TNode>[],
    at: number,
): number {
    const column = siblings[at];
    if (!column || isColumnGroup(column) || !column.colSpan) return 1;
    return keptSpan(
        column.colSpan({ type: "header", rowIndex: -1 }),
        at,
        siblings.length,
        (index) => {
            const next = siblings[index];
            return (
                next !== undefined &&
                !isColumnGroup(next) &&
                next.pinned === column.pinned
            );
        },
    );
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
 * Lays the entries of `columns` out: their leaves, and the header's rows and cells, each sibling
 * list in the order `order` gives it (the column order, Epic #75), and a collapsible group's
 * children shown by its state (`collapsed`, the collapsed groups' keys, E1.3: the ones it hides
 * are no columns, but keep their places in the order; the header keeps the rows every entry
 * needs, so a toggle never changes its height). Without a group, a `colSpan` and an order, the
 * columns are the entries themselves (the same array). It never throws: a group inside itself is
 * not entered again, and a group without columns has no cell (`columnsError` refuses both).
 */
export function layoutColumns<TRow, TNode>(
    entries: readonly ColumnOrGroup<TRow, TNode>[],
    order?: <E extends ColumnOrGroup<TRow, TNode>>(
        list: readonly E[],
    ) => readonly E[],
    collapsed: readonly string[] = [],
): ColumnLayout<TRow, TNode> {
    // a header span (E1.2) is laid out as a group is
    if (
        entries.every((entry) => !isColumnGroup(entry)) &&
        !entries.some((entry) => entry.colSpan)
    ) {
        const columns = order ? order(entries) : entries;
        return { columns, header: flatHeader(columns) };
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
    /** the columns' cells a header span covers: no cell on screen, kept for `cellByKey` */
    const covered: HeaderCellLayout<TRow, TNode>[] = [];
    const collapsedKeys = keySet(collapsed);
    /** places `list`, the children of a collapsible group in `state` showing only that state's */
    const place = (
        list: readonly ColumnOrGroup<TRow, TNode>[],
        level: number,
        state?: GroupShow,
    ) => {
        const ordered = order ? order(list) : list;
        const siblings = state
            ? ordered.filter((entry) => showsIn(entry, state))
            : ordered;
        /** the siblings after a header span it covers */
        let skip = 0;
        for (const [index, entry] of siblings.entries()) {
            const row = rows[level];
            if (!row) return;
            if (!isColumnGroup(entry)) {
                const columnSpan = skip > 0 ? 1 : headerSpan(siblings, index);
                const cell: HeaderCellLayout<TRow, TNode> = {
                    key: entry.key,
                    rowIndex: level - depth,
                    columnIndex: columns.length,
                    columnSpan,
                    rowSpan: depth - level,
                    column: entry,
                };
                if (skip > 0) {
                    skip -= 1;
                    covered.push(cell);
                } else {
                    skip = columnSpan - 1;
                    row.push(cell);
                }
                columns.push(entry);
                continue;
            }
            if (path.has(entry)) continue;
            // its cell goes before its children's in the row: reserve its place
            const at = row.length;
            const columnIndex = columns.length;
            path.add(entry);
            place(
                childrenOf(entry),
                level + 1,
                entry.collapsible !== true
                    ? undefined
                    : collapsedKeys.has(entry.key)
                      ? "collapsed"
                      : "expanded",
            );
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
            cellByKey: cellsByKey(
                covered.length > 0 ? [...rows, covered] : rows,
            ),
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
