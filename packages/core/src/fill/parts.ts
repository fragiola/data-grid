import { controlPart, type PartResult } from "../adapter/props";
import { FILL_HANDLE_ATTRIBUTE } from "../engine/dom";
import { cellSpan } from "../engine/geometry";
import type { FillDrag, GridView } from "../engine/types";
import type { CellPosition, CellRange } from "../model/types";

// The fill handle's parts (Epic #88, E4.4; the fill handle's since Epic #144): the handle an app
// renders at the corner a fill drags from, and the cells a fill would fill.

/** What a view carries for the fill handle (its engine's own fields). */
export interface FillView {
    /** cells fill by a handle (the fill handle installed, its root having `onFill`) */
    readonly fillable: boolean;
    /** the fill a handle's drag is making, or `null` */
    readonly fill: FillDrag | null;
    /**
     * the cells a fill drags from (E4.4): the selected range, else the active body cell, widened
     * to the column spans it cuts, as its first and last cells; its handle at the last one.
     * `null` without one, cells not filling, or while a cell is edited
     */
    readonly fillSource: CellRange | null;
}

/** The state of a fill handle (Epic #88, E4.4): the element the app renders at a range's corner. */
export interface FillHandleState {
    /**
     * its cell is the corner a fill drags from: the last row's last cell of the selected range,
     * else the active body cell; cells fill and no cell is edited. Else render none
     */
    readonly visible: boolean;
    /** a drag on it is filling */
    readonly filling: boolean;
}

/** A fill handle's state and its attributes (the mark the engine finds it by), when visible. */
export interface FillHandlePart {
    readonly state: FillHandleState;
    readonly attributes:
        | { readonly [FILL_HANDLE_ATTRIBUTE]: number }
        | undefined;
}

/** A fill handle not shown (the one part for every other cell: nothing allocated). */
const HIDDEN: FillHandlePart = {
    state: { visible: false, filling: false },
    attributes: undefined,
};
const HIDDEN_FILLING: FillHandlePart = {
    state: { visible: false, filling: true },
    attributes: undefined,
};

/**
 * A cell's fill handle (Epic #88, E4.4): visible in the cell at the last cell of what a fill
 * drags from (`fillSource`, worked out once a view: the selected range's last row and last
 * column, widened to the spans it cuts, else the active body cell; a cell spanning columns when
 * it reaches it), while cells fill and none is edited; its attributes then. Hidden without the
 * fill handle installed.
 */
export function fillHandlePart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: CellPosition,
): FillHandlePart {
    const { fill, fillSource } = view as GridView<TRow, TNode> &
        Partial<FillView>;
    const filling = fill !== null && fill !== undefined;
    const corner = fillSource?.focus;
    const visible =
        corner !== undefined &&
        corner.rowIndex === cell.rowIndex &&
        corner.columnIndex >= cell.columnIndex &&
        corner.columnIndex <
            cell.columnIndex + cellSpan(view, cell.rowIndex, cell.columnIndex);
    return visible
        ? {
              state: { visible, filling },
              attributes: { [FILL_HANDLE_ATTRIBUTE]: cell.rowIndex },
          }
        : filling
          ? HIDDEN_FILLING
          : HIDDEN;
}

const fillHandleData = (state: FillHandleState) => ({
    "grid-part": "fill-handle",
    filling: state.filling,
});

/** A fill handle's state and props (`useFillHandle`): none in a cell but the range's corner. */
export function fillHandlePartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    cell: { readonly rowIndex: number; readonly columnIndex: number },
): PartResult<FillHandleState> {
    const { state, attributes } = fillHandlePart(view, cell);
    return controlPart(state, attributes, fillHandleData);
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
