import type { ReorderSide, RowKey } from "../model/types";
import { keptIfSame } from "../utils/utils";

// The engine's drags (Epics #86, #88): what each one keeps while the pointer moves, and the pure
// geometry they share (the edge scroll's step, a drop's side). The engine starts, follows and
// ends them; a feature's drag (a range's, a fill's: Epic #144; a column's resize and move: Epic
// #148) through its own steps.

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
 * A feature's drag (Epic #144: a range's, a fill handle's): a press it takes (`FeatureEngine.
 * pointerdown`) that the engine follows as its own, past the slop and once a frame, both axes,
 * telling it each step and how it ends.
 */
export interface FeatureDrag extends PointerDrag {
    readonly kind: "feature";
    /** it moved past the slop (a press that did not drag from the start): it drags from now on */
    readonly start?: (() => void) | undefined;
    /** a frame of its drag: the pointer moved (`x`, `y`), or the edge scroll goes on */
    readonly step: () => void;
    /** it ended: released, cancelled or lost (a press that never dragged ends too) */
    readonly end: (how: DragEnd) => void;
    /**
     * the axis its steps follow (Epic #148: a column's drags follow the pointer's x); both
     * without one
     */
    readonly axis?: "x" | "y" | undefined;
    /**
     * its step follows the pointer alone, never a scroll (Epic #148: a resizer's): a scroll during
     * the drag asks no frame of it
     */
    readonly fixed?: boolean | undefined;
    /** the click ending it, once it dragged (Epic #148: a resizer's double click fits) */
    readonly click?: ((event: MouseEvent) => void) | undefined;
}

export type Drag = RowDrag | FeatureDrag;

/**
 * How a drag ends: a release, a cancel (Escape, `pointercancel`) or a loss (the capture lost, a
 * move with no button, the viewport detached). A column's resize keeps its width but on a
 * cancel; a move (a column's, a row's) moves only on a release.
 */
export type DragEnd = "release" | "cancel" | "lost";

/**
 * How near the view's edges a header cell's drag scrolls the columns (O3), and a row's the rows
 * (E2.3), in pixels.
 */
const EDGE_ZONE = 40;
/** The edge scroll's pixels per frame at the edge or past it; fewer farther from it. */
const EDGE_STEP = 20;

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
