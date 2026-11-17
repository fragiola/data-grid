import { inlineKey, isElement, KEYS } from "../engine/dom";
import type { FeatureDrag } from "../engine/drag";
import { CTRL_KEYS, isSelectAll } from "../engine/shortcuts";
import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
    type FeatureState,
} from "../feature/feature";
import { bodyBoundsOf } from "../model/bounds";
import {
    inRange,
    isBodyCell,
    isCellSelected,
    keptRange,
    rangeEdgesOf,
    sameCellRange,
} from "../model/range";
import { done, fail, invalid, notOneOf } from "../model/result";
import { cellKeysAt, sameCellKeys, sameKnownKeys } from "../model/source";
import type {
    CellKeys,
    CellPosition,
    CellRange,
    CellSelection,
    CommandFailure,
    CommandResult,
} from "../model/types";
import { DIRECTIONS, nextPosition, sameCell } from "../navigation/navigation";
import { overlaps } from "../viewport/window";
import type { CellRangeProps, CellRangeTypes } from "./types";

// Cell ranges (Epic #88, E4.1; a feature since Epic #144, requiring navigation): the model keeps
// one range of body cells (`cell-selection.set`, `selected-range.*`), Shift with the navigation
// keys, a press dragged across cells and Shift+click select it, Ctrl/⌘+A every cell, Escape (or a
// press outside the grid) clears it; its cells carry `aria-selected`, `data-selected-cell` and
// `data-range-edge`, the grid `aria-multiselectable`, and a root takes `cellSelection` and
// `selectedRange` / `defaultSelectedRange` / `onSelectedRangeChange`.

/** The state as cell ranges read it. */
type State = FeatureState<CellRangeTypes>;

/** A handler's result: the state it leaves and its value, or why not. */
type Applied<R> = CommandResult<{ readonly state: State; readonly value: R }>;

/** The cell selection modes, for validation. */
const CELL_SELECTIONS: readonly CellSelection[] = ["range"];

/** Every range command's refusal while cells are not selectable (Epic #88). */
function cellsOff(): CommandFailure {
    return fail("refused", "cells are not selectable (no cellSelection)");
}

/** The refusal of a range corner that is no body cell. */
function noBodyCell(position: CellPosition): CommandFailure {
    return fail(
        "not_found",
        `no body cell at row ${position?.rowIndex}, column ${position?.columnIndex}`,
    );
}

/** The state with a selected range (the same object when it is the same cells), and it. */
function withRange(state: State, range: CellRange): Applied<CellRange> {
    if (sameCellRange(range, state.selectedRange) && state.selectedRange) {
        return done(state, state.selectedRange);
    }
    const kept = {
        anchor: {
            rowIndex: range.anchor.rowIndex,
            columnIndex: range.anchor.columnIndex,
        },
        focus: {
            rowIndex: range.focus.rowIndex,
            columnIndex: range.focus.columnIndex,
        },
    };
    return done({ ...state, selectedRange: kept }, kept);
}

/**
 * The state after any command, its range kept to its rules (Epic #88): a new layout of the columns
 * (an order, a collapse) leaves none (its columns are others), new rows or columns keep it inside
 * the body (`keptRange`), and the active cell moving elsewhere (a click, a Tab, a control taking
 * focus, the keys, the app's `active-position.set`) leaves none: a range's anchor is the active
 * cell where it started (one the active cell did not start, select-all's, stays until it moves).
 * It stays on the cells it was set on, by key (`withRangeKeys`), looked at only when what it
 * depends on changed (the rows, or `rows.changed` over its corners, the columns, the active cell
 * or the range), never after an unrelated command.
 */
function withRangeRules(after: State, before: State): State {
    let next = after;
    let range = next.selectedRange;
    // a new order or a new collapse laid the columns out again: a range's columns are others
    if (
        range &&
        after.header !== before.header &&
        (after.columnOrder !== before.columnOrder ||
            after.collapsedGroupKeys !== before.collapsedGroupKeys)
    ) {
        range = null;
    }
    // inside the body's rows and columns
    if (
        range &&
        (after.source !== before.source ||
            after.rowCount !== before.rowCount ||
            after.columns !== before.columns)
    ) {
        range = keptRange(next, range);
    }
    const active = next.activePosition;
    if (
        range &&
        active !== before.activePosition &&
        !(active !== null && sameCell(active, range.anchor))
    ) {
        range = null;
    }
    if (range !== next.selectedRange) next = { ...next, selectedRange: range };
    const shaped =
        after.source !== before.source || after.columns !== before.columns;
    /** rows told changed behind the same `getRow`: what holds one of them looks again */
    const changed =
        after.rowsChanged !== before.rowsChanged ? after.rowsChanged : null;
    const reread = (position: CellPosition) =>
        changed !== null &&
        overlaps(changed, position.rowIndex, position.rowIndex + 1);
    const rangeShaped =
        shaped ||
        (range !== null && (reread(range.anchor) || reread(range.focus)));
    return rangeShaped || range !== before.selectedRange
        ? withRangeKeys(next, rangeShaped ? before : null)
        : next;
}

/**
 * The state with its range's keys (E4.1): taken at its corners when it is set; after new rows or
 * columns (`before`, the state the range's keys were taken in), other keys at a corner (a sort,
 * rows inserted above, a column hidden or moved) leave no range, the same ones keep it (rows
 * growing at the end). A corner on a row not loaded is kept by index, its keys taken once it is.
 */
function withRangeKeys(state: State, before: State | null): State {
    const range = state.selectedRange;
    if (!range) {
        return state.selectedRangeKeys
            ? { ...state, selectedRangeKeys: null }
            : state;
    }
    const was = before?.selectedRange ? before.selectedRangeKeys : null;
    const anchor = cellKeysAt(state, range.anchor);
    const focus = cellKeysAt(state, range.focus);
    if (
        was &&
        (!sameKnownKeys(was.anchor, anchor) || !sameKnownKeys(was.focus, focus))
    ) {
        return { ...state, selectedRange: null, selectedRangeKeys: null };
    }
    const keys = state.selectedRangeKeys;
    const next = {
        anchor: anchor ?? was?.anchor,
        focus: focus ?? was?.focus,
    };
    return keys &&
        sameCellKeys(keys.anchor, next.anchor) &&
        sameCellKeys(keys.focus, next.focus)
        ? state
        : { ...state, selectedRangeKeys: next };
}

/** The cells of a range's drag (E4.1): the press's anchor, its keys, the cell it reaches. */
interface RangeDrag extends FeatureDrag {
    /** the range's anchor: the pressed cell, or with Shift the range's own */
    readonly anchor: CellPosition;
    /** the keys at the anchor at the press: other ones there end the drag */
    readonly anchorKeys: CellKeys | undefined;
    /** the cell the range reaches, as last set */
    focus: CellPosition;
}

/** The grid's attribute while cells can be selected. */
const MULTISELECTABLE = { "aria-multiselectable": true } as const;

/** The cell ranges feature's definition: every grid installing it shares it. */
const CELL_RANGE = defineFeature<CellRangeTypes>({
    name: "cellRange",
    requires: ["navigation"],
    initial: (_state, options) => ({
        cellSelection:
            options.cellSelection &&
            CELL_SELECTIONS.includes(options.cellSelection)
                ? options.cellSelection
                : undefined,
        // kept inside the body once the rows are given (`stateChanged`, at creation too)
        selectedRange: options.selectedRange ?? null,
        selectedRangeKeys: null,
    }),
    commands: {
        "cell-selection.set": (state, { cellSelection }) => {
            if (
                cellSelection !== null &&
                !CELL_SELECTIONS.includes(cellSelection)
            ) {
                return notOneOf("cellSelection", CELL_SELECTIONS);
            }
            const mode = cellSelection ?? undefined;
            // off, no range survives
            const next =
                mode === state.cellSelection
                    ? state
                    : {
                          ...state,
                          cellSelection: mode,
                          selectedRange: mode ? state.selectedRange : null,
                      };
            return done(next, next.cellSelection);
        },
        "selected-range.set": (state, { anchor, focus }) => {
            if (!state.cellSelection) return cellsOff();
            for (const corner of [anchor, focus]) {
                if (!isBodyCell(state, corner)) return noBodyCell(corner);
            }
            return withRange(state, { anchor, focus });
        },
        "selected-range.extend": (state, payload) => {
            if (!state.cellSelection) return cellsOff();
            const range = state.selectedRange;
            const active = isBodyCell(state, state.activePosition)
                ? state.activePosition
                : null;
            if (payload.direction !== undefined) {
                const { direction, pageSize } = payload;
                if (!DIRECTIONS.includes(direction)) {
                    return notOneOf("direction", DIRECTIONS);
                }
                if (pageSize !== undefined && !Number.isFinite(pageSize)) {
                    return invalid("pageSize must be a number");
                }
                const from =
                    range ?? (active && { anchor: active, focus: active });
                if (!from) {
                    return fail(
                        "refused",
                        "no range, nor an active body cell, to extend",
                    );
                }
                // in the body: never into the header nor the summary rows
                const focus = nextPosition(
                    from.focus,
                    direction,
                    bodyBoundsOf(state),
                    pageSize,
                );
                return withRange(state, { anchor: from.anchor, focus });
            }
            const cell = {
                rowIndex: payload.rowIndex,
                columnIndex: payload.columnIndex,
            };
            if (!isBodyCell(state, cell)) return noBodyCell(cell);
            return withRange(state, {
                anchor: range?.anchor ?? active ?? cell,
                focus: cell,
            });
        },
        "selected-range.select-all": (state) => {
            if (!state.cellSelection) return cellsOff();
            if (state.rowCount === 0 || state.columns.length === 0) {
                return fail("refused", "the grid has no body cells");
            }
            return withRange(state, {
                anchor: { rowIndex: 0, columnIndex: 0 },
                focus: {
                    rowIndex: state.rowCount - 1,
                    columnIndex: state.columns.length - 1,
                },
            });
        },
        "selected-range.clear": (state) =>
            done(
                state.selectedRange ? { ...state, selectedRange: null } : state,
                undefined,
            ),
    },
    queries: {
        "cell-selection": (state) => state.cellSelection,
        "selected-range": (state) => state.selectedRange,
    },
    questions: {
        "cell-selected": (state, position) => isCellSelected(state, position),
    },
    stateChanged: withRangeRules,
    view: ["cellSelection", "selectedRange"],
    // in the range (a cell spanning columns while any of them is), and the range's edges it sits
    // on; nothing asked while cells are not selectable
    cell: (view, cell, span, share) => {
        if (!view.cellSelection) return;
        const range = view.selectedRange;
        const selected = inRange(range, cell.rowIndex, cell.columnIndex, span);
        share.selected = selected;
        share.ariaSelected = selected;
        share.rangeEdges = selected
            ? rangeEdgesOf(range, cell.rowIndex, cell.columnIndex, span)
            : undefined;
    },
    grid: (view) => (view.cellSelection ? MULTISELECTABLE : undefined),
    engine: ({ model, engine }) => {
        /** the range's drag, while one is on */
        let rangeDrag: RangeDrag | null = null;
        /** the document whose presses a range listens to (`onRangePress`), while there is one */
        let pressDoc: Document | null = null;
        let attached: HTMLElement | null = null;

        /**
         * A range's focus at the pointer's cell (its focus when unchanged): a
         * `selected-range.set` when that cell changed, at most once a frame.
         */
        const rangeTo = (current: RangeDrag, cell: CellPosition) => {
            if (cell === current.focus) return;
            current.focus = cell;
            model.run("selected-range.set", {
                anchor: current.anchor,
                focus: current.focus,
            });
        };

        /**
         * A press outside the grid (its viewport, nested grids and scrollbars included) clears
         * the range (Epic #113), through the command: a middleware can refuse it. The active cell
         * stays.
         */
        const onRangePress = (event: PointerEvent) => {
            const { target } = event;
            if (
                !attached ||
                !model.state.selectedRange ||
                !isElement(target) ||
                attached.contains(target)
            ) {
                return;
            }
            model.run("selected-range.clear", {});
        };

        /** A range listens to the page's presses while there is one and the viewport is attached. */
        const followRange = () => {
            const doc = model.state.selectedRange
                ? attached?.ownerDocument
                : undefined;
            if (doc === (pressDoc ?? undefined)) return;
            pressDoc?.removeEventListener("pointerdown", onRangePress, true);
            pressDoc = doc ?? null;
            pressDoc?.addEventListener("pointerdown", onRangePress, true);
        };

        /**
         * A press on a body cell, cells selectable (E4.1): a new range starts there (the last one
         * cleared; the press is not prevented, so it focuses the cell, the active one and the
         * range's anchor), or with Shift the range reaches the cell from its anchor (the active
         * cell, without one), prevented (the active cell and focus stay); past the slop, the range
         * follows the pointer (a touch's press drags nothing: it scrolls). Not on a control inside
         * the cell, nor with Ctrl, ⌘ or Alt.
         */
        const pointerdown = (event: PointerEvent): boolean => {
            const viewport = engine.viewport();
            if (
                !viewport ||
                !model.state.cellSelection ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey
            ) {
                return false;
            }
            const cell = engine.pressedBodyCellOf(event.target);
            if (!cell) return false;
            let anchor = cell;
            if (event.shiftKey) {
                event.preventDefault();
                // refused (a middleware, cells no longer selectable): no range, no drag
                const extended = model.check("selected-range.extend", cell);
                if (!extended.ok) return false;
                anchor = extended.value.anchor;
                model.run("selected-range.extend", cell);
            } else if (model.state.selectedRange) {
                model.run("selected-range.clear", {});
            }
            // a touch dragged scrolls the grid: it selects no range
            if (event.pointerType === "touch") return false;
            const current: RangeDrag = {
                kind: "feature",
                dragged: false,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                doc: viewport.ownerDocument,
                x: event.clientX,
                y: event.clientY,
                frame: null,
                // held by the viewport: the pressed cell may scroll out of the rendered ones
                element: viewport,
                anchor,
                anchorKeys: cellKeysAt(model.state, anchor),
                focus: cell,
                // past the slop: the range follows the pointer, held by the viewport
                start: () => {
                    current.dragged = true;
                    engine.capture(current);
                    current.step();
                },
                step: () => {
                    const at = engine.cellDragStep(current, current.focus);
                    if (at) rangeTo(current, at);
                },
                // a release reaches the cell under it, Escape clears the range
                end: (how) => {
                    if (rangeDrag === current) rangeDrag = null;
                    if (!current.dragged) return;
                    if (how === "cancel") model.run("selected-range.clear", {});
                    else if (how === "release") {
                        const at = engine.cellUnder(current, current.focus);
                        if (at) rangeTo(current, at);
                    }
                },
            };
            rangeDrag = current;
            return engine.press(event, current);
        };

        return {
            pointerdown,
            // the range's keys (E4.1), cells selectable: Ctrl/⌘+A on any of the grid's cells
            // selects every body cell (once per press); on a body cell in navigation, Shift with
            // an arrow, Home, End, PageUp or PageDown (Ctrl/⌘+Shift+Home/End: the grid's corners)
            // moves the range's focus, the active cell staying (the anchor), the focus scrolled
            // into view; Escape clears a range. One command a key, which a middleware can refuse
            laterKeydown: (event, target) => {
                if (!model.state.cellSelection) return false;
                const ctrl = event.ctrlKey || event.metaKey;
                if (
                    event.key === "Escape" &&
                    !ctrl &&
                    model.state.selectedRange
                ) {
                    event.preventDefault();
                    model.run("selected-range.clear", {});
                    return true;
                }
                if (isSelectAll(event) && engine.isCellElement(target)) {
                    // handled even when refused: the page's text is never selected instead
                    event.preventDefault();
                    if (!event.repeat)
                        model.run("selected-range.select-all", {});
                    return true;
                }
                if (!event.shiftKey || !engine.bodyCellOf(target)) return false;
                const move =
                    (ctrl ? CTRL_KEYS[event.key] : undefined) ??
                    KEYS[inlineKey(event.key, engine.direction())];
                if (!move) return false;
                event.preventDefault();
                const payload = {
                    direction: move,
                    pageSize: engine.pageSize(),
                };
                // a move refused selects nothing; a controlled parent answers it later, scrolled
                // to now
                const asked = model.check("selected-range.extend", payload);
                if (!asked.ok) return true;
                model.run("selected-range.extend", payload);
                engine.scrollToCell(asked.value.focus);
                return true;
            },
            changed: (before, after) => {
                const state = after as State;
                if (state.selectedRange !== (before as State).selectedRange) {
                    followRange();
                }
                const current = rangeDrag;
                if (!current || engine.drag() !== current) return;
                // an edit started: the drag ends, telling nothing
                if (
                    after.editingCell &&
                    after.editingKeys !== before.editingKeys
                ) {
                    engine.endDrag("lost");
                    return;
                }
                // cells no longer selectable, or other rows or columns at its anchor, end it: its
                // indexes would point elsewhere. New rows or columns that keep the same keys
                // there (rows growing at the end, a new `columns` array, a new getter) keep it
                const shaped =
                    after.source !== before.source ||
                    after.columns !== before.columns;
                if (
                    !state.cellSelection ||
                    (shaped &&
                        !engine.keptAt(current.anchor, current.anchorKeys))
                ) {
                    rangeDrag = null;
                    engine.stopDrag();
                }
            },
            // a range given to start with listens to the page's presses too
            attach: (viewport) => {
                attached = viewport;
                followRange();
                return () => {
                    pressDoc?.removeEventListener(
                        "pointerdown",
                        onRangePress,
                        true,
                    );
                    pressDoc = null;
                    attached = null;
                };
            },
        };
    },
    root: {
        props: [
            "cellSelection",
            "selectedRange",
            "defaultSelectedRange",
            "onSelectedRangeChange",
        ],
        options: (props) => ({
            cellSelection: props.cellSelection,
            selectedRange:
                props.selectedRange !== undefined
                    ? props.selectedRange
                    : props.defaultSelectedRange,
        }),
        controlled: (model) => [
            defineControlled<CellRangeProps, State, CellRange | null>({
                prefix: "selected-range.",
                // the range follows the prop while cells are selectable; off, there is none
                prop: (props) =>
                    props.cellSelection ? props.selectedRange : undefined,
                onChange: (props) => props.onSelectedRangeChange,
                // a range to start with the body could not hold (cells outside it) starts inside
                // it: the app is told the range the grid holds
                start: (props) =>
                    props.cellSelection
                        ? props.defaultSelectedRange
                        : undefined,
                read: (state) => state.selectedRange,
                same: sameCellRange,
                fromCommand: (command, value) =>
                    command === "selected-range.clear"
                        ? null
                        : (value as CellRange),
                // kept inside the body, as at mount, and the parent told the range as it settled
                apply: (value) => {
                    const kept = keptRange(model.state, value);
                    if (kept) model.run("selected-range.set", kept);
                    else model.run("selected-range.clear", {});
                },
            }),
        ],
        // the mode: a prop removed turns it off, and the range goes
        follow: (model) => [
            {
                inputs: (props) => [props.cellSelection],
                run: ({ cellSelection }) => {
                    if (cellSelection !== model.state.cellSelection) {
                        model.run("cell-selection.set", {
                            cellSelection: cellSelection ?? null,
                        });
                    }
                },
            },
        ],
    },
});

/**
 * Cell ranges (`@fragiola/data-grid/range`): install them on a grid (`features: [navigation(),
 * cellRange()]`) for a range of its cells to be selected (`cellSelection: "range"`). They need
 * navigation: the range starts at the active cell.
 */
export function cellRange(): DataGridFeature<CellRangeTypes> {
    return CELL_RANGE;
}
