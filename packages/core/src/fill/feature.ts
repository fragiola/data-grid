import type { EditingState } from "../editing/types";
import { FILL_HANDLE_ATTRIBUTE } from "../engine/dom";
import type { FeatureDrag } from "../engine/drag";
import type { FillDrag, RangeFill } from "../engine/types";
import {
    type DataGridFeature,
    defineFeature,
    type FeatureState,
} from "../feature/feature";
import type { DataGridModel } from "../model/model";
import {
    inRange,
    sameCellRange,
    selectedArea,
    spannedArea,
} from "../model/range";
import { cellKeysAt } from "../model/source";
import type { CellPosition, CellRange, RangeKeys } from "../model/types";
import type { NavigationTypes } from "../navigation/types";
import type { CellRangeTypes } from "../range/types";
import { type FillView, fillTargetOf } from "./parts";
import type { FillHandleTypes } from "./types";

// The fill handle (Epic #88, E4.4; a feature since Epic #144, requiring cell ranges): while cells
// fill (a root's `onFill`), a press on the handle the app renders at the range's corner
// (`useFillHandle`) drags it down or to the end, and the release tells a `range-fill` the app
// writes (`repeatedFill` repeats the source's values); the range becomes the source and the
// target together. The grid writes no data.

/**
 * The state as the fill reads it: the range's and the navigation's (the features it needs), and
 * the edit's when editing is installed (`undefined` without it).
 */
type State = FeatureState<CellRangeTypes> & Partial<EditingState>;

/**
 * A fill handle's drag (E4.4): from the press on, the source (the range or the active cell when it
 * started, widened to the spans it cuts) and the cell the selection is anchored at then, the
 * target following the cell under the pointer.
 */
interface FillHandleDrag extends FeatureDrag {
    readonly source: CellRange;
    /** the keys at the source's corners at the press: other ones there end the drag */
    readonly sourceKeys: RangeKeys;
    readonly anchor: CellPosition;
    /** the body cell the pointer was last over, `null` before a move */
    cell: CellPosition | null;
}

/** The fill handle's definition: every grid installing it shares it. */
const FILL_HANDLE = defineFeature<FillHandleTypes>({
    name: "fillHandle",
    requires: ["cellRange"],
    // its engine's own: whether cells fill, the drag, what it drags from
    view: ["fillable", "fill", "fillSource"],
    cell: (view, cell, span, share) => {
        const { fillable, fill } = view as unknown as Partial<FillView>;
        if (fillable) {
            share.fillTarget = inRange(
                fill?.target ?? null,
                cell.rowIndex,
                cell.columnIndex,
                span,
            );
        }
    },
    engine: ({ model, engine }) => {
        // the range's and the active cell's commands, through their keys
        const grid = model as unknown as DataGridModel<
            unknown,
            unknown,
            readonly [
                DataGridFeature<CellRangeTypes>,
                DataGridFeature<NavigationTypes>,
            ]
        >;
        const stateOf = () => grid.state as unknown as State;
        /** the fill a handle's drag is making */
        let fill: FillDrag | null = null;
        /** the handle's drag, while one is on */
        let fillDrag: FillHandleDrag | null = null;

        /**
         * What a fill starts from: the selected range, else the active body cell, as its first and
         * last cells, widened to the column spans it cuts (`spannedArea`); `null` without one,
         * cells not filling, or while a cell is edited (its handle shows nothing then).
         */
        const fillSource = (): CellRange | null => {
            const state = stateOf();
            const area =
                engine.options().fillable && !state.editingCell
                    ? selectedArea(state)
                    : null;
            return area && spannedArea(state, area);
        };
        /**
         * the cells a fill drags from now, cells filling: worked out when the range, the active
         * cell, the edit, the rows or the columns change, not per cell nor per press
         */
        let fillFrom = fillSource();

        const setFill = (next: FillDrag | null) => {
            fill = next;
            engine.refresh();
            engine.emit("fill", next);
        };

        /**
         * A fill's drag at the pointer's cell (the last one when unchanged): its target, a new
         * state when it changed.
         */
        const fillTo = (current: FillHandleDrag, cell: CellPosition) => {
            if (cell === current.cell) return;
            current.cell = cell;
            const target = fillTargetOf(current.source, cell);
            if (
                target === fill?.target ||
                (target && fill?.target && sameCellRange(target, fill.target))
            ) {
                return;
            }
            setFill({ source: current.source, target });
        };

        /**
         * A fill released past its source: told once (`range-fill`, the app writes the values),
         * then, cells selectable, the range is the source and the target together, from the
         * press's values (a selection changing during the drag ends it). Its anchor stays the
         * active cell's corner of the source, on the same sides: the active cell moves only when
         * it was at the source's bottom or end and the fill reached past that side (to the filled
         * cells' last row or column), and an active cell between the source's edges (in a span it
         * was widened to) takes its first side.
         */
        const fillRange = (current: FillHandleDrag, target: CellRange) => {
            const { source, anchor: was } = current;
            const filled: RangeFill = { source, target };
            engine.emit("range-fill", filled);
            if (!stateOf().cellSelection) return;
            const first = source.anchor;
            const last = source.focus;
            const bottom = Math.max(last.rowIndex, target.focus.rowIndex);
            const end = Math.max(last.columnIndex, target.focus.columnIndex);
            const atBottom =
                was.rowIndex === last.rowIndex &&
                was.rowIndex !== first.rowIndex;
            const atEnd =
                was.columnIndex === last.columnIndex &&
                was.columnIndex !== first.columnIndex;
            const anchor = {
                rowIndex: atBottom ? bottom : first.rowIndex,
                columnIndex: atEnd ? end : first.columnIndex,
            };
            if (!engine.same(grid.state.activePosition, anchor)) {
                grid.run("active-position.set", anchor);
                // refused, or snapped into a span: the selection stays as the model left it
                if (!engine.same(grid.state.activePosition, anchor)) return;
            }
            grid.run("selected-range.set", {
                anchor,
                focus: {
                    rowIndex: atBottom ? first.rowIndex : bottom,
                    columnIndex: atEnd ? first.columnIndex : end,
                },
            });
        };

        return {
            // a fill handle: a drag at once, prevented (no focus, no text selection, never a
            // range, an edit or a sort), held by the viewport (its cell may scroll away)
            pointerdown: (event) => {
                const viewport = engine.viewport();
                if (!viewport || !engine.options().fillable) return false;
                const handle = engine.markedOf(
                    event.target,
                    FILL_HANDLE_ATTRIBUTE,
                );
                const source = handle && fillFrom;
                const state = stateOf();
                const anchor =
                    state.activePosition ?? state.selectedRange?.anchor;
                if (!source || !anchor) return false;
                event.preventDefault();
                const current: FillHandleDrag = {
                    kind: "feature",
                    dragged: true,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    doc: viewport.ownerDocument,
                    x: event.clientX,
                    y: event.clientY,
                    frame: null,
                    element: viewport,
                    source,
                    sourceKeys: {
                        anchor: cellKeysAt(state, source.anchor),
                        focus: cellKeysAt(state, source.focus),
                    },
                    anchor,
                    cell: null,
                    step: () => {
                        const at = engine.cellDragStep(current, current.cell);
                        if (at) fillTo(current, at);
                    },
                    // released: the cell under it fills, once; cancelled or lost, nothing
                    end: (how) => {
                        if (fillDrag === current) fillDrag = null;
                        const at =
                            how === "release"
                                ? engine.cellUnder(current, current.cell)
                                : null;
                        const target = at
                            ? fillTargetOf(current.source, at)
                            : null;
                        setFill(null);
                        if (target) fillRange(current, target);
                    },
                };
                fillDrag = current;
                engine.press(event, current);
                setFill({ source, target: null });
                return true;
            },
            changed: (before, after) => {
                const was = before as State;
                const now = after as State;
                // what a fill drags from, its handle's corner
                if (
                    now.selectedRange !== was.selectedRange ||
                    after.activePosition !== before.activePosition ||
                    now.editingCell !== was.editingCell ||
                    after.source !== before.source ||
                    after.columns !== before.columns ||
                    after.rowsChanged !== before.rowsChanged
                ) {
                    fillFrom = fillSource();
                }
                // an edit started: the drag ends, filling nothing
                if (
                    fillDrag &&
                    engine.drag() === fillDrag &&
                    now.editingCell &&
                    now.editingCell !== was.editingCell
                ) {
                    engine.endDrag("lost");
                }
            },
            // the engine laid out for the change: other rows or columns at its source's corners,
            // or a selection changing (a key, the app), end the drag, filling nothing
            followed: (before, after) => {
                const current = fillDrag;
                if (!current || engine.drag() !== current) return;
                const was = before as State;
                const now = after as State;
                const shaped =
                    after.source !== before.source ||
                    after.columns !== before.columns;
                if (
                    (shaped &&
                        (!engine.keptAt(
                            current.source.anchor,
                            current.sourceKeys.anchor,
                        ) ||
                            !engine.keptAt(
                                current.source.focus,
                                current.sourceKeys.focus,
                            ))) ||
                    now.selectedRange !== was.selectedRange ||
                    after.activePosition !== before.activePosition
                ) {
                    engine.endDrag("lost");
                }
            },
            // cells that stop filling end a fill's drag
            optionsChanged: (options) => {
                fillFrom = fillSource();
                if (
                    !options.fillable &&
                    fillDrag &&
                    engine.drag() === fillDrag
                ) {
                    engine.endDrag("lost");
                }
            },
            view: () => ({
                fillable: engine.options().fillable === true,
                fill,
                fillSource: fillFrom,
            }),
            queries: { fill: () => fill },
        };
    },
    root: {
        props: ["onFill"],
        // cells fill while the app takes their fills
        engineOptions: (props) => ({ fillable: props.onFill !== undefined }),
        events: (engine, props) => {
            engine.subscribe("range-fill", (filled: RangeFill) =>
                props().onFill?.(filled),
            );
        },
    },
});

/**
 * The fill handle (`@fragiola/data-grid/fill`): install it on a grid with cell ranges
 * (`features: [navigation(), cellRange(), fillHandle()]`) for its cells to fill (`onFill`) by the
 * handle the app renders at the range's corner (`useFillHandle`).
 */
export function fillHandle(): DataGridFeature<FillHandleTypes> {
    return FILL_HANDLE;
}
