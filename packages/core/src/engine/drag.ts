import { landingIndex, type Siblings } from "../model/order";
import type {
    CellKeys,
    CellPosition,
    CellRange,
    ColumnWidths,
    HeaderLayout,
    RangeKeys,
    ReorderSide,
    RowKey,
} from "../model/types";
import { keptIfSame } from "../utils";

// The engine's drags (Epics #70, #75, #86, #88): what each one keeps while the pointer moves, and
// the pure geometry they share (the edge scroll's step, a drop's side, a fill's target). The
// engine starts, follows and ends them.

/**
 * A drag the engine follows with the pointer: where it started, and where the pointer is. A
 * column's drags follow its x, a row's its y.
 */
export interface PointerDrag {
    /** it moved past a click's slop (a resizer's at once): Escape and its click are its */
    dragged: boolean;
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    /**
     * what holds the pointer: the resizer, the dragged header cell, the row's handle, or the
     * viewport (a range's: the cells it was pressed in may scroll out of the rendered ones)
     */
    readonly element: Element;
    readonly doc: Document;
    /** the pointer's last place */
    x: number;
    y: number;
    /** the animation frame the next step waits for, if any */
    frame: number | null;
}

/** A drag on a column resizer (W4). */
export interface ResizeDrag extends PointerDrag {
    readonly kind: "resize";
    /** the column's or the group's key */
    readonly columnKey: string;
    /** the column's (or the group's) width when it started */
    readonly startWidth: number;
    /** which way it grows on screen (`resizeSign`) */
    readonly sign: number;
    /** the engine's widths when it started: its columns resized back to them need none of theirs */
    readonly autoWidths: ColumnWidths;
    /** the x the last resize was for */
    appliedX: number;
}

/**
 * A drag of a reorderable header cell (Epic #75, O3): a press that drags once it moves past a
 * click's slop (until then, it may be a click), and its siblings, found again when the header
 * changes.
 */
export interface ReorderDrag<TRow, TNode> extends PointerDrag {
    readonly kind: "reorder";
    /** the column's or the group's key */
    readonly columnKey: string;
    /** the header its siblings were found in, and them */
    header: HeaderLayout<TRow, TNode> | null;
    siblings: Siblings<TRow, TNode> | null;
}

/**
 * A drag of a row by its handle (Epic #86, E2.3): a press that drags once it moves past a click's
 * slop, the row followed by its key.
 */
export interface RowDrag extends PointerDrag {
    readonly kind: "row";
    readonly rowIndex: number;
    readonly rowKey: RowKey;
    /**
     * the pointer's y in the view, as last read (a layout read: at the drag's start, once a frame
     * and on the release, never during a model change)
     */
    viewY: number;
}

/**
 * A drag selecting a range of cells (Epic #88, E4.1): a press on a body cell that drags once it
 * moves past a click's slop, from its anchor to the cell under the pointer.
 */
export interface RangeDrag extends PointerDrag {
    readonly kind: "range";
    /** the range's anchor: the pressed cell, or with Shift the range's own */
    readonly anchor: CellPosition;
    /** the keys at the anchor at the press: other ones there end the drag */
    readonly anchorKeys: CellKeys | undefined;
    /** the cell the range reaches, as last set */
    focus: CellPosition;
}

/**
 * A fill handle's drag (Epic #88, E4.4): from the press on, the source (the range or the active
 * cell when it started, widened to the spans it cuts) and the cell the selection is anchored at
 * then, the target following the cell under the pointer.
 */
export interface FillHandleDrag extends PointerDrag {
    readonly kind: "fill";
    readonly source: CellRange;
    /** the keys at the source's corners at the press: other ones there end the drag */
    readonly sourceKeys: RangeKeys;
    readonly anchor: CellPosition;
    /** the body cell the pointer was last over, `null` before a move */
    cell: CellPosition | null;
}

export type Drag<TRow, TNode> =
    | ResizeDrag
    | ReorderDrag<TRow, TNode>
    | RowDrag
    | RangeDrag
    | FillHandleDrag;

/**
 * How a drag ends: a release, a cancel (Escape, `pointercancel`) or a loss (the capture lost, a
 * move with no button, the viewport detached). A resize keeps its width but on a cancel; a
 * reorder (a column's, a row's) moves only on a release.
 */
export type DragEnd = "release" | "cancel" | "lost";

/**
 * How near the view's edges a header cell's drag scrolls the columns (O3), and a row's the rows
 * (E2.3), in pixels.
 */
const EDGE_ZONE = 40;
/** The edge scroll's pixels per frame at the edge or past it; fewer farther from it. */
const EDGE_STEP = 20;

/** The keys a focused resizer resizes with (W6). */
export const RESIZE_KEYS: ReadonlySet<string> = new Set([
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
]);

/** The resizer keys' steps in pixels (W6): an arrow, and Shift with it. */
export const RESIZE_STEP = 10;
export const RESIZE_SHIFT_STEP = 50;

/**
 * The edge scroll's step (signed, 0 for none) for a pointer at `at` over a part of the view
 * `length` long from `start`: near its start or end edge (or past it), toward it, faster
 * nearer. The two zones never overlap: in a narrow part each is half of it.
 */
export function edgeStep(at: number, start: number, length: number): number {
    const zone = Math.min(EDGE_ZONE, length / 2);
    if (zone <= 0) return 0;
    const low = start + zone;
    const high = start + length - zone;
    const depth = at < low ? at - low : at > high ? at - high : 0;
    return (
        Math.sign(depth) *
        Math.ceil(EDGE_STEP * Math.min(1, Math.abs(depth) / zone))
    );
}

/**
 * Where a drag would drop (O3, E2.3): beside the item at `at` (from `start` to `end` on its
 * axis), on the side of its middle `offset` is on, when that moves the dragged item at
 * `index` and `allowed`; else nowhere (`make(null)`). The current state while the same.
 */
export function dropTargetOf<T extends object>(
    current: T | null,
    offset: number,
    index: number,
    at: number,
    start: number,
    end: number,
    allowed: boolean,
    make: (side: ReorderSide | null) => T,
): T {
    const side = offset < (start + end) / 2 ? "before" : "after";
    return keptIfSame(
        current,
        make(allowed && landingIndex(index, at, side) !== index ? side : null),
    );
}

/**
 * The cells a fill from `source` reaches with the pointer over `cell` (E4.4): below it, as
 * wide, down to the cell's row; or to its end, as tall, to the cell's column; whichever the
 * pointer went farther past (down on a tie); `null` over the source, above it or before it.
 */
export function fillTargetOf(
    source: CellRange,
    cell: CellPosition,
): CellRange | null {
    const { anchor: first, focus: last } = source;
    const down = cell.rowIndex - last.rowIndex;
    const across = cell.columnIndex - last.columnIndex;
    if (down <= 0 && across <= 0) return null;
    return down >= across
        ? {
              anchor: {
                  rowIndex: last.rowIndex + 1,
                  columnIndex: first.columnIndex,
              },
              focus: {
                  rowIndex: cell.rowIndex,
                  columnIndex: last.columnIndex,
              },
          }
        : {
              anchor: {
                  rowIndex: first.rowIndex,
                  columnIndex: last.columnIndex + 1,
              },
              focus: {
                  rowIndex: last.rowIndex,
                  columnIndex: cell.columnIndex,
              },
          };
}
