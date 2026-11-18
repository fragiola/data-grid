import {
    FILL_HANDLE_ATTRIBUTE,
    ROW_DRAG_HANDLE_ATTRIBUTE,
} from "../engine/dom";
import { dropTargetOf, type FeatureDrag, landingIndex } from "../engine/drag";
import { cellsSizeOf } from "../engine/geometry";
import type { RowShare } from "../engine/parts";
import type { GridView, RowMove, RowReorder } from "../engine/types";
import {
    type DataGridFeature,
    defineFeature,
    type FeatureEngineContext,
} from "../feature/feature";
import { loadedRowKey } from "../model/source";
import type {
    CellPosition,
    DataGridState,
    RowKey,
    RowMeta,
} from "../model/types";
import { indexAfterMove } from "../utils/utils";
import { rowsMove } from "./parts";
import type { RowReorderTypes, RowReorderView } from "./types";

// Rows moved by the person (Epic #86, E2.3; a feature since Epic #151): a press on a row's drag
// handle drags its row (the edge scroll near the body's edges, a drop on a side of the row under
// the pointer), Ctrl/⌘+Shift+↑/↓ on a body cell moves its row by one; each move is a `row-move`
// event the app applies to its rows (the grid never orders them: `onRowMove`, `moveRow` in
// `@fragiola/data-grid/local`), the active cell following its row once moved. The drag runs on
// the engine's shared drag machinery (a `FeatureDrag` along y). Without it, a row's handle drags
// nothing and the keys move nothing.

/** A row's drag by its handle: its row followed by its key, the pointer's y in the view. */
interface RowDrag extends FeatureDrag {
    readonly rowIndex: number;
    readonly rowKey: RowKey;
    /**
     * the pointer's y in the view, as last read (a layout read: at the drag's start, once a frame
     * and on the release, never during a model change)
     */
    viewY: number;
}

/** A body row's share of row reorder: dragged, or where a drag would drop beside it. */
function rowShare(
    given: GridView<unknown, unknown>,
    rowIndex: number,
    _meta: RowMeta | undefined,
    share: RowShare,
): void {
    // the fields its engine holds (`view()`), on the view by name
    const view = given as GridView<unknown, unknown> & RowReorderView;
    if (!view.reorderableRows) return;
    const reorder = view.rowReorder;
    share.dragging = reorder?.rowIndex === rowIndex;
    share.dropTarget = reorder?.targetIndex === rowIndex ? reorder.side : null;
}

/** Row reorder's handlers in an engine: a handle's press and its drag, the keys, the moves. */
function reorderEngine({
    model,
    engine: kit,
}: FeatureEngineContext<RowReorderTypes>) {
    /** the row a drag is moving, and where it would land, or `null` */
    let reorder: RowReorder | null = null;
    /** the drag on now, if it is a row's */
    let current: RowDrag | null = null;
    /** whether the rows moved at the last options (a change renders a new view) */
    let reorderable = kit.options().reorderableRows === true;
    /**
     * the last move told, until the app moved its row: the active cell as it was then and its
     * row's key, which it follows once the moved key is where the move put it
     * (`followMovedRow`); only with `rowKey` (a row keyed by its index cannot be told from
     * another) and an active body row
     */
    let movedRow: {
        readonly move: RowMove;
        readonly active: CellPosition;
        readonly activeKey: RowKey;
    } | null = null;

    /** Whether the grid's rows move now (`rowsMove`): reorderable, in no feature's order. */
    function rowsMoveNow(): boolean {
        return rowsMove(
            kit.options().reorderableRows,
            kit.rowsOrdered(),
            model.state.source,
        );
    }

    /** A row's drag's state changed: a new view, and its event. */
    function setReorder(next: RowReorder | null) {
        reorder = next;
        kit.refresh();
        kit.emit("row-reorder", next);
    }

    /**
     * Where a drop would move a drag's row, its pointer at `y` in the view: beside the row under
     * it, on the side of its cells' middle (a detail below them is after it), the pointer kept
     * over the body (the edge scroll reaches further). From the row axis, not the DOM: a row
     * scrolled out of the rendered ones counts, measured, expanded and scaled alike. No target
     * when it would land where it is or on a row not loaded (rows that stop moving end the drag:
     * `followRowDrag`); the current state while the same.
     */
    function reorderTarget(drag: RowDrag, y: number): RowReorder {
        const rowAxis = kit.rowAxis();
        const offset = kit.rowOffsetAt(y);
        const at = rowAxis.indexAt(offset);
        const start = rowAxis.offsetOf(at);
        const { rowIndex, rowKey } = drag;
        return dropTargetOf<RowReorder>(
            reorder,
            offset,
            rowIndex,
            at,
            start,
            start + cellsSizeOf(rowAxis, at),
            at >= 0 && loadedRowKey(model.state, at) !== undefined,
            (side) =>
                side
                    ? { rowIndex, rowKey, targetIndex: at, side }
                    : { rowIndex, rowKey, targetIndex: null, side: null },
        );
    }

    /** Asks for a row's drag's next frame while its pointer is in an edge zone: it scrolls on. */
    function scrollAtEdge(drag: RowDrag) {
        if (kit.rowEdgeStep(drag.viewY) !== 0) kit.askFrame(drag);
    }

    /** A row moves (a drop, the keys): the app is told, and the active cell will follow its row. */
    function moveRow(fromIndex: number, toIndex: number, rowKey: RowKey) {
        const move = { fromIndex, toIndex, rowKey };
        const state = model.state;
        const active = state.activePosition;
        const activeKey =
            state.rowKey && active
                ? loadedRowKey(state, active.rowIndex)
                : undefined;
        movedRow =
            active && activeKey !== undefined
                ? { move, active, activeKey }
                : null;
        kit.emit("row-move", move);
    }

    /** A press on a row's handle, taken: a drag once it moves past the slop. */
    function pressed(
        event: PointerEvent,
        element: HTMLElement,
        doc: Document,
        rowIndex: number,
        rowKey: RowKey,
    ): true {
        const drag: RowDrag = {
            kind: "feature",
            axis: "y",
            // a handle's press is not prevented: under the slop it is a click
            dragged: false,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            doc,
            x: event.clientX,
            y: event.clientY,
            frame: null,
            rowIndex,
            rowKey,
            element,
            viewY: 0,
            // past the slop: its row drags, holding the pointer. The view keeps it rendered
            // (`heldRow`) while the edge scroll takes it out of the rendered rows
            start: () => {
                drag.dragged = true;
                kit.capture(drag);
                drag.viewY = kit.viewY(drag.y);
                setReorder(reorderTarget(drag, drag.viewY));
                scrollAtEdge(drag);
            },
            // a frame: the pointer's place in the view read once (before the scroll writes; kept
            // as `viewY`), the edge scroll, then the target; held near an edge, it scrolls on
            step: () => {
                const at = kit.viewY(drag.y);
                drag.viewY = at;
                const scrolled = kit.edgeScroll(kit.rowEdgeStep(at), 0);
                const target = reorderTarget(drag, at);
                if (target !== reorder) setReorder(target);
                if (scrolled) kit.askFrame(drag);
            },
            // a drop moves its row on a release only, once, and not where it is
            end: (how) => {
                if (current === drag) current = null;
                if (!drag.dragged) return;
                const target =
                    how === "release"
                        ? reorderTarget(drag, kit.viewY(drag.y))
                        : null;
                setReorder(null);
                if (target && target.targetIndex !== null) {
                    moveRow(
                        drag.rowIndex,
                        landingIndex(
                            drag.rowIndex,
                            target.targetIndex,
                            target.side,
                        ),
                        drag.rowKey,
                    );
                }
            },
        };
        current = drag;
        return kit.press(event, drag);
    }

    /**
     * After a change of the model, laid out (the offset clamped to the new rows): a row's drag
     * follows its row, its target worked out again from the pointer's last y in the view (no
     * layout read), and ends when its row is no longer at its index (by key) or rows no longer
     * move. Held in an edge zone, the edge scroll goes on (rows added at the end come into reach).
     */
    function followRowDrag(drag: RowDrag) {
        if (
            !rowsMoveNow() ||
            loadedRowKey(model.state, drag.rowIndex) !== drag.rowKey
        ) {
            if (kit.drag() === drag) kit.stopDrag();
            current = null;
            setReorder(null);
            return;
        }
        const target = reorderTarget(drag, drag.viewY);
        if (target !== reorder) setReorder(target);
        scrollAtEdge(drag);
    }

    /**
     * After a change of the model: once the rows changed (a new source, `rows.changed`) and the
     * moved key is where the last move put it (the app moved it), the active cell goes where its
     * row went: the moved row's to `toIndex`, a row between the two indexes one place toward
     * `fromIndex`, when its key is there (else it stays), as a command after this change. Kept
     * through rows that change otherwise (a server answering in pieces); forgotten once followed,
     * once the active cell changed otherwise (the person or the app moved it) or rows are no
     * longer keyed, at the next move and when the viewport detaches.
     */
    function followMovedRow(
        before: DataGridState<unknown, unknown>,
        after: DataGridState<unknown, unknown>,
    ) {
        if (!movedRow) return;
        const { move, active, activeKey } = movedRow;
        if (after.activePosition !== active || !after.rowKey) {
            movedRow = null;
            return;
        }
        if (
            (after.source === before.source &&
                after.rowsChanged === before.rowsChanged) ||
            loadedRowKey(after, move.toIndex) !== move.rowKey
        ) {
            return;
        }
        movedRow = null;
        const rowIndex = indexAfterMove(
            active.rowIndex,
            move.fromIndex,
            move.toIndex,
        );
        if (
            rowIndex !== active.rowIndex &&
            loadedRowKey(after, rowIndex) === activeKey
        ) {
            kit.activate({ rowIndex, columnIndex: active.columnIndex });
        }
    }

    /**
     * Ctrl/⌘+Shift+↑/↓ on a body cell in navigation, rows moving: one move of its row by one,
     * up or down, the active cell following it (once the app moved it), once per press (a held
     * key repeats: it would move the row on and on). Handled even when nothing moves (the first
     * or last row, a neighbour not loaded, the grid sorted, a repeat): the page never gets them.
     */
    function rowMoveKey(event: KeyboardEvent, target: Element): boolean {
        const up = event.key === "ArrowUp";
        if (
            !kit.options().reorderableRows ||
            (!up && event.key !== "ArrowDown") ||
            !event.shiftKey ||
            !(event.ctrlKey || event.metaKey)
        ) {
            return false;
        }
        const position = kit.bodyCellOf(target);
        if (!position) return false;
        event.preventDefault();
        if (event.repeat) return true;
        const { rowIndex } = position;
        const toIndex = rowIndex + (up ? -1 : 1);
        const state = model.state;
        const rowKey = loadedRowKey(state, rowIndex);
        if (
            rowKey !== undefined &&
            loadedRowKey(state, toIndex) !== undefined &&
            rowsMoveNow()
        ) {
            moveRow(rowIndex, toIndex, rowKey);
        }
        return true;
    }

    return {
        // on body cells (a header cell's Ctrl/⌘+Shift+←/→ are a column's move): a row's move
        keydown: rowMoveKey,
        // a primary press on a row's drag handle may become a drag (E2.3); a fill handle inside
        // one is the fill's. With rows that do not move, there is none
        pointerdown: (event: PointerEvent) => {
            const viewport = kit.viewport();
            if (!viewport || !kit.options().reorderableRows) return false;
            const handle = kit.markedOf(
                event.target,
                ROW_DRAG_HANDLE_ATTRIBUTE,
            );
            if (
                !handle ||
                kit.markedOf(event.target, FILL_HANDLE_ATTRIBUTE) !== null
            ) {
                return false;
            }
            // a row that cannot move (sorted, not loaded): a plain press
            const rowIndex = Number(handle.value);
            const rowKey = loadedRowKey(model.state, rowIndex);
            if (rowKey === undefined || !rowsMoveNow()) return false;
            return pressed(
                event,
                handle.element,
                viewport.ownerDocument,
                rowIndex,
                rowKey,
            );
        },
        // the app moved the rows a move told it of: the active cell follows its row (E2.3)
        changed: followMovedRow,
        // a row's drag follows its row (E2.3), on the rows as laid out now
        followed: () => {
            if (current?.dragged) followRowDrag(current);
        },
        // rows that stop moving end a row's drag, moving nothing; the view tells whether they move
        optionsChanged: (options: { readonly reorderableRows?: boolean }) => {
            const next = options.reorderableRows === true;
            if (!next && current && kit.drag() === current) kit.endDrag("lost");
            if (next !== reorderable) {
                reorderable = next;
                kit.refresh();
            }
        },
        // a move told is no longer followed once the viewport detaches
        attach: () => () => {
            movedRow = null;
        },
        heldRow: () => reorder?.rowIndex ?? null,
        view: () => ({
            reorderableRows: kit.options().reorderableRows === true,
            rowReorder: reorder,
        }),
        queries: { "row-reorder": () => reorder },
    };
}

/** Row reorder's definition: every grid installing it shares it. */
const ROW_REORDER = defineFeature<RowReorderTypes>({
    name: "rowReorder",
    questions: {
        "row-movable": (state, { rowIndex }) =>
            state.source.getRowMeta === undefined &&
            loadedRowKey(state, rowIndex) !== undefined,
    },
    view: ["reorderableRows", "rowReorder"],
    row: rowShare,
    engine: reorderEngine,
    root: {
        props: ["onRowMove"],
        // the rows move while the app takes their moves
        engineOptions: (props) => ({
            reorderableRows: props.onRowMove !== undefined,
        }),
        events: (engine, props) => {
            engine.subscribe("row-move", (move) => props().onRowMove?.(move));
        },
    },
});

/**
 * Rows moved by their drag handles and the keys (Epic #86, E2.3), as a feature (Epic #151):
 * install it (`features: [rowReorder()]`) and give the root `onRowMove` for the rows to move
 * (the adapters' `useRowDragHandle`, from their `/row-reorder`).
 */
export function rowReorder(): DataGridFeature<RowReorderTypes> {
    return ROW_REORDER;
}
