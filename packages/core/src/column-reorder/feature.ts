import { inlineKey } from "../engine/dom";
import { dropTargetOf, type FeatureDrag, landingIndex } from "../engine/drag";
import type { HeaderCellState } from "../engine/parts";
import type { ColumnReorder, GridView } from "../engine/types";
import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
    type FeatureEngine,
    type FeatureEngineContext,
    type FeaturePartContribution,
    type FeatureState,
} from "../feature/feature";
import { keptOrder, sameOrder } from "../model/key-lists";
import { done, fail, invalid, notOneOf } from "../model/result";
import type {
    ColumnOrder,
    HeaderCellLayout,
    HeaderLayout,
    ReorderSide,
} from "../model/types";
import { lowerBound } from "../utils/utils";
import {
    hasReorderable,
    isReorderable,
    movedOrder,
    type Siblings,
    siblingOrder,
    siblingsOf,
} from "./order";
import type {
    ColumnReorderProps,
    ColumnReorderTypes,
    ColumnReorderView,
} from "./types";

// Column reordering (Epic #75, O1–O6; a feature since Epic #148): the model keeps the column
// order (`column-order.set`, `.move`, `.reset`), the columns are laid out in it, a reorderable
// header cell drags among its siblings (the edge scroll, its drop's side, within its part: a
// pinned strip or the columns that scroll) and moves with Ctrl/⌘+Shift+←/→. The pinned parts are
// read as declared (the core's column model) and the strips in effect from the engine's layout:
// reordering never reads pinning's code.

/** The state as reordering reads it. */
type State = FeatureState<ColumnReorderTypes>;

/** The sides a column lands on, beside a sibling. */
const REORDER_SIDES: readonly ReorderSide[] = ["before", "after"];

/** A column's part, as a refused move names it. */
const PART_NAMES = {
    start: "pinned at the start",
    end: "pinned at the end",
    none: "unpinned",
} as const;

/** The state in a new column order (the same object for the same order), and the order. */
function withOrder(state: State, columnOrder: ColumnOrder) {
    const next = sameOrder(columnOrder, state.columnOrder)
        ? state
        : { ...state, columnOrder };
    return done(next, next.columnOrder);
}

/** A header cell's move: reorderable, dragged, or where a drag would drop beside it. */
function headerCellPart(
    view: GridView<unknown, unknown>,
    cell: HeaderCellLayout<unknown, unknown>,
): FeaturePartContribution<HeaderCellState> {
    // its engine's field, on the view by name
    const reorder = (view as GridView<unknown, unknown> & ColumnReorderView)
        .columnReorder;
    return {
        state: {
            reorderable: isReorderable(cell),
            dragging: reorder?.columnKey === cell.key,
            dropTarget: reorder?.targetKey === cell.key ? reorder.side : null,
        },
    };
}

/**
 * A drag of a reorderable header cell (O3): a press that drags once it moves past a click's slop
 * (until then, it may be a click), and its siblings, found again when the header changes.
 */
interface ReorderDrag extends FeatureDrag {
    /** the column's or the group's key */
    readonly columnKey: string;
    /** the header its siblings were found in, and them */
    header: HeaderLayout<unknown, unknown> | null;
    siblings: Siblings<unknown, unknown> | null;
}

/** Reordering's keys, presses and drag in one engine (O3, O6). */
function reorderEngine(
    context: FeatureEngineContext<ColumnReorderTypes>,
): FeatureEngine {
    const { model, engine: kit } = context;
    /** the drag on now, and what it would do (`ColumnReorder`) */
    let current: ReorderDrag | null = null;
    let reorder: ColumnReorder | null = null;
    /** the value last told (`column-reorder`): a follow of the columns tells it once laid out */
    let told: ColumnReorder | null = null;

    function setReorder(next: ColumnReorder | null) {
        reorder = next;
        told = next;
        kit.refresh();
        kit.emit("column-reorder", next);
    }

    /** The drag's siblings, found again when the header changed. */
    function siblingsFor(drag: ReorderDrag): Siblings<unknown, unknown> | null {
        const { header, columns } = model.state;
        if (drag.header !== header) {
            drag.header = header;
            drag.siblings = siblingsOf(columns, header, drag.columnKey);
        }
        return drag.siblings;
    }

    /** Whether a drag's cell is pinned with the pinned columns in effect: always in view. */
    function inPinnedStrip(siblings: Siblings<unknown, unknown>): boolean {
        const pinned = kit.pinned();
        return siblings.pinned === "start"
            ? pinned.startCount > 0
            : siblings.pinned === "end" && pinned.endCount > 0;
    }

    /**
     * Where a drop would move a drag's column or group (O3), its pointer at `x` in the view: beside
     * the sibling under it, on the side of its middle, among the ones it may move among. The
     * pointer is kept over the part of the view they show in (the pinned strip, or the columns
     * that scroll), so the target is the nearest one in view: the edge scroll reaches further.
     * From the column axis, not the DOM: a sibling scrolled out of the rendered columns counts,
     * scaled or not. No target when it would land where it is; the current state while the same.
     */
    function reorderTarget(drag: ReorderDrag, x: number): ColumnReorder | null {
        const siblings = siblingsFor(drag);
        if (!siblings) return null;
        const { cells, index, start, end } = siblings;
        const axis = kit.columnAxis();
        const offset = kit.columnOffsetAt(
            inPinnedStrip(siblings) ? siblings.pinned : undefined,
            x,
        );
        const endOf = (cell: HeaderCellLayout<unknown, unknown>) =>
            axis.offsetOf(cell.columnIndex + cell.columnSpan);
        // the first one ending past the pointer, else the last
        const at = Math.min(
            start +
                lowerBound(end - start, (i) => {
                    const cell = cells[start + i];
                    return cell !== undefined && endOf(cell) <= offset;
                }),
            end - 1,
        );
        const target = cells[at];
        if (!target) return null;
        const { columnKey } = drag;
        return dropTargetOf<ColumnReorder>(
            reorder,
            offset,
            index,
            at,
            axis.offsetOf(target.columnIndex),
            endOf(target),
            true,
            (side) =>
                side
                    ? { columnKey, targetKey: target.key, side }
                    : { columnKey, targetKey: null, side: null },
        );
    }

    /**
     * A drag's edge step near the start or end edge of the columns that scroll (or past it): far
     * siblings come into reach. 0 for a pinned cell in effect (always in view) and toward an edge
     * its siblings already end inside.
     */
    function columnEdgeStep(drag: ReorderDrag, x: number): number {
        const siblings = siblingsFor(drag);
        if (!siblings || inPinnedStrip(siblings)) return 0;
        const step = kit.columnEdgeStep(x);
        if (step === 0) return 0;
        // nothing more comes into reach that way: the siblings end inside the view on that side
        const { cells, start, end } = siblings;
        const edge = step > 0 ? cells[end - 1] : cells[start];
        const axis = kit.columnAxis();
        const left = kit.scrollLeft();
        const pinned = kit.pinned();
        if (
            !edge ||
            (step > 0
                ? axis.offsetOf(edge.columnIndex + edge.columnSpan) <=
                  left + kit.viewportWidth() - pinned.endWidth
                : axis.offsetOf(edge.columnIndex) >= left + pinned.startWidth)
        ) {
            return 0;
        }
        return step;
    }

    /** A header cell's press, taken: a drag once it moves past the slop. */
    function pressed(
        event: PointerEvent,
        cell: HeaderCellLayout<unknown, unknown>,
        element: Element,
        doc: Document,
    ): true {
        const drag: ReorderDrag = {
            kind: "feature",
            axis: "x",
            // a header cell's press is not prevented: under the slop it is a click (focus, a sort)
            dragged: false,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            element,
            doc,
            x: event.clientX,
            y: event.clientY,
            frame: null,
            columnKey: cell.key,
            header: null,
            siblings: null,
            // past the slop: its header cell drags, holding the pointer
            start: () => {
                drag.dragged = true;
                kit.capture(drag);
                const target = reorderTarget(drag, kit.viewX(drag.x));
                // the cell gone since the press (new columns): nothing to drag
                if (target) setReorder(target);
                else kit.stopDrag();
            },
            // a frame: the pointer's place in the view read once (before the scroll writes), the
            // edge scroll, then the target; held near an edge, it keeps scrolling
            step: () => {
                const at = kit.viewX(drag.x);
                const scrolled = kit.edgeScroll(0, columnEdgeStep(drag, at));
                const target = reorderTarget(drag, at);
                if (target && target !== reorder) setReorder(target);
                if (scrolled) kit.askFrame(drag);
            },
            // a drop moves its column or group on a release only, once, and not where it is
            end: (how) => {
                if (current === drag) current = null;
                if (!drag.dragged) return;
                const target =
                    how === "release"
                        ? reorderTarget(drag, kit.viewX(drag.x))
                        : null;
                setReorder(null);
                if (target && target.targetKey !== null) {
                    model.run("column-order.move", {
                        columnKey: drag.columnKey,
                        targetKey: target.targetKey,
                        side: target.side,
                    });
                }
            },
        };
        current = drag;
        return kit.press(event, drag);
    }

    /**
     * Ctrl/⌘+Shift+←/→ on a reorderable header cell in navigation (O6): one move among its
     * siblings, before the previous one or after the next, the active cell following its column.
     * Handled even when nothing moves (at an end, past the pinned ones, refused): the page never
     * gets them.
     */
    function reorderKey(event: KeyboardEvent, target: Element): boolean {
        const key = inlineKey(event.key, kit.direction());
        const left = key === "ArrowLeft";
        if (
            (!left && key !== "ArrowRight") ||
            !event.shiftKey ||
            !(event.ctrlKey || event.metaKey) ||
            !kit.isCellElement(target)
        ) {
            return false;
        }
        const cell = context.headerCellOf(target);
        const { columns, header } = model.state;
        const siblings =
            cell && isReorderable(cell)
                ? siblingsOf(columns, header, cell.key)
                : null;
        if (!siblings) return false;
        event.preventDefault();
        const neighbour = siblings.cells[siblings.index + (left ? -1 : 1)];
        // focus follows once the cells render in their new order (the commit); the cell moved
        // by the keys is kept in view
        if (
            neighbour &&
            model.run("column-order.move", {
                columnKey: siblings.cell.key,
                targetKey: neighbour.key,
                side: left ? "before" : "after",
            }).ok
        ) {
            const active = model.state.activePosition;
            if (active) kit.scrollToCell(active);
        }
        return true;
    }

    return {
        keydown: reorderKey,
        // a primary press on a reorderable header cell may become a drag (O3): with no
        // reorderable column, there is none
        pointerdown: (event) => {
            const viewport = kit.viewport();
            if (
                !viewport ||
                !hasReorderable(model.state.columnEntries) ||
                !kit.inViewport(event.target)
            ) {
                return false;
            }
            const cell = context.headerCellOf(event.target);
            if (!cell || !isReorderable(cell)) return false;
            const element = kit.cellElement(cell);
            return element
                ? pressed(event, cell, element, viewport.ownerDocument)
                : false;
        },
        // after the columns changed during a drag: it follows its column or group, its target
        // worked out again, and ends when that is gone or can no longer be moved (set, not
        // refreshed: the change's view shows it)
        columnsFollowed: () => {
            const drag = current;
            if (!drag?.dragged || kit.drag() !== drag) return;
            const siblings = siblingsFor(drag);
            if (siblings && isReorderable(siblings.cell)) {
                reorder = reorderTarget(drag, kit.viewX(drag.x));
                return;
            }
            current = null;
            kit.stopDrag();
            reorder = null;
        },
        // and told once the engine laid out for the change
        followed: () => {
            if (reorder === told) return;
            told = reorder;
            kit.emit("column-reorder", reorder);
        },
        view: () => ({ columnReorder: reorder }),
        queries: { "column-reorder": () => reorder },
    };
}

/** Reordering's definition: every grid installing it shares it. */
const REORDER = defineFeature<ColumnReorderTypes>({
    name: "columnReorder",
    initial: (_state, options) => ({
        columnOrder: keptOrder(options.columnOrder),
    }),
    commands: {
        "column-order.set": (state, { columnOrder }) => {
            if (
                !Array.isArray(columnOrder) ||
                columnOrder.some((key) => typeof key !== "string")
            ) {
                return invalid("columnOrder must be an array of keys");
            }
            if (new Set(columnOrder).size !== columnOrder.length) {
                return invalid("columnOrder lists a key twice");
            }
            return withOrder(state, [...columnOrder]);
        },
        "column-order.move": (state, { columnKey, targetKey, side }) => {
            if (!REORDER_SIDES.includes(side)) {
                return notOneOf("side", REORDER_SIDES);
            }
            const siblings = siblingsOf(state.columns, state.header, columnKey);
            const missing = !siblings
                ? columnKey
                : state.header.cellByKey(targetKey)
                  ? null
                  : targetKey;
            if (!siblings || missing !== null) {
                return fail("not_found", `no column or group "${missing}"`);
            }
            const { cells, index, start, end } = siblings;
            if (!isReorderable(siblings.cell)) {
                return fail("refused", `"${columnKey}" is not reorderable`);
            }
            // a column a header span covers (E1.2) has no cell among its siblings
            if (index < 0) {
                return fail(
                    "refused",
                    `"${columnKey}" is covered by a header span`,
                );
            }
            const target = cells.findIndex((cell) => cell.key === targetKey);
            if (target < 0) {
                return fail(
                    "refused",
                    `"${targetKey}" is not a sibling of "${columnKey}"`,
                );
            }
            // pinned columns lead and trail (P1): each part's land among their own
            // (beside the first one past the edge, on its near side, is still their own part)
            const to = landingIndex(index, target, side);
            if (to < start || to >= end) {
                return fail(
                    "refused",
                    `"${columnKey}" moves among the ${PART_NAMES[siblings.pinned ?? "none"]} ones only`,
                );
            }
            if (to === index) return done(state, state.columnOrder);
            // a column whose header spans its siblings (E1.2) moves with the ones it covers
            const units = cells.map((cell) =>
                cell.group || cell.columnSpan === 1
                    ? [cell.key]
                    : state.columns
                          .slice(
                              cell.columnIndex,
                              cell.columnIndex + cell.columnSpan,
                          )
                          .map((column) => column.key),
            );
            const [moved = [columnKey]] = units.splice(index, 1);
            units.splice(to, 0, moved);
            return withOrder(
                state,
                movedOrder(state.columnOrder, units.flat()),
            );
        },
        "column-order.reset": (state) => withOrder(state, []),
    },
    queries: {
        "column-order": (state) => state.columnOrder,
    },
    columnLayout: {
        changed: (after, before) => after.columnOrder !== before.columnOrder,
        arrangement: (state) => ({ arrange: siblingOrder(state.columnOrder) }),
    },
    view: ["columnReorder"],
    headerCell: headerCellPart,
    engine: reorderEngine,
    root: {
        props: ["columnOrder", "defaultColumnOrder", "onColumnOrderChange"],
        options: (props) => ({
            columnOrder: props.columnOrder ?? props.defaultColumnOrder,
        }),
        controlled: (model) => [
            defineControlled<ColumnReorderProps, State, ColumnOrder>({
                prefix: "column-order.",
                prop: (props) => props.columnOrder,
                onChange: (props) => props.onColumnOrderChange,
                // an uncontrolled order to start with that listed a key twice (or a value that is
                // no key) starts without those: the app is told the order the grid holds
                start: (props) => props.defaultColumnOrder,
                read: (state) => state.columnOrder,
                same: sameOrder,
                // kept as at mount, and the parent told the order as it settled
                apply: (columnOrder) => {
                    model.run("column-order.set", {
                        columnOrder: keptOrder(columnOrder),
                    });
                },
                // a layout input: settled first, the active cell it moved in the same pass
                first: "layout",
            }),
        ],
    },
});

/**
 * Column reordering (`@fragiola/data-grid/column-reorder`): install it on a grid (`features:
 * [columnReorder()]`) for its `reorderable` columns and groups to move, by their header cell's
 * drag or Ctrl/⌘+Shift+←/→. Without it, the columns keep their declared order.
 */
export function columnReorder(): DataGridFeature<ColumnReorderTypes> {
    return REORDER;
}
