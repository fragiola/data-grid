import { inlineKey, KEYS } from "../engine/dom";
import { CTRL_KEYS } from "../engine/shortcuts";
import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
    type FeatureState,
} from "../feature/feature";
import { isHeaderRow } from "../header/header";
import { boundsOf, cellPosition, isCell } from "../model/bounds";
import { done, fail, invalid, notOneOf } from "../model/result";
import { activeInCell, spanAt } from "../model/spans";
import type { CellPosition } from "../model/types";
import { DIRECTIONS, nextPosition, sameCell } from "./navigation";
import type { NavigationProps, NavigationTypes } from "./types";

// Navigation (D11, the APG grid pattern; a feature since Epic #144): the active cell's commands
// (`active-position.set`, `.clear`, `.move`), the arrows, Home, End and the page keys moving it
// (right to left, the arrows mirrored), the active cell as the grid's one tab stop, and a root's
// `activePosition` / `defaultActivePosition` / `onActivePositionChange`. With it, the grid has the
// grid's roles (`grid`, `treegrid`, `gridcell`); without it, the table's, and no cell takes focus
// from the grid. The active position itself, and its rules when the grid's shape changes, are
// the core's (a grid's cells are its own: an edit, a cell's controls, a nested grid's holder).

/** Whether two active positions are the same cell (or both none). */
export function samePosition(
    a: CellPosition | null | undefined,
    b: CellPosition | null | undefined,
): boolean {
    return (
        (a ?? null) === (b ?? null) ||
        (a?.rowIndex === b?.rowIndex && a?.columnIndex === b?.columnIndex)
    );
}

/** The navigation feature's definition: every grid installing it shares it. */
const NAVIGATION = defineFeature<NavigationTypes>({
    name: "navigation",
    navigable: true,
    // the position given is for the rows given: the core keeps it inside them
    initial: (_state, options) => ({
        activePosition: options.activePosition ?? null,
    }),
    commands: {
        "active-position.set": (state, payload) => {
            if (!isCell(state, payload)) {
                return fail(
                    "not_found",
                    `no cell at row ${payload.rowIndex}, column ${payload.columnIndex}`,
                );
            }
            const position = cellPosition(state, {
                rowIndex: payload.rowIndex,
                columnIndex: payload.columnIndex,
            });
            const current = state.activePosition;
            const next =
                current && sameCell(current, position)
                    ? state
                    : { ...state, activePosition: position };
            return done(next, position);
        },
        "active-position.clear": (state) =>
            done(
                state.activePosition
                    ? { ...state, activePosition: null }
                    : state,
                undefined,
            ),
        "active-position.move": (
            state,
            { direction, pageSize, visibleColumns },
        ) => {
            if (!DIRECTIONS.includes(direction)) {
                return notOneOf("direction", DIRECTIONS);
            }
            if (pageSize !== undefined && !Number.isFinite(pageSize)) {
                return invalid("pageSize must be a number");
            }
            if (
                visibleColumns !== undefined &&
                (!Number.isInteger(visibleColumns.start) ||
                    !Number.isInteger(visibleColumns.end))
            ) {
                return invalid("visibleColumns must have whole-number bounds");
            }
            const current = state.activePosition;
            if (!current) return fail("refused", "no cell is active");
            const position = nextPosition(
                current,
                direction,
                { ...boundsOf(state), visibleColumns },
                pageSize,
            );
            const next = sameCell(position, current)
                ? state
                : { ...state, activePosition: position };
            return done(next, position);
        },
    },
    queries: {
        "active-position": (state) => state.activePosition,
    },
    questions: {
        // a header cell spanning rows or columns, a body cell spanning columns (E1.2): any
        // position inside it
        "cell-active": (state, position) => {
            const active = state.activePosition;
            if (!active) return false;
            if (isHeaderRow(position.rowIndex, state.header)) {
                return sameCell(active, position, state.header.cellAt);
            }
            const span = spanAt(state, position.rowIndex, position.columnIndex);
            return activeInCell(
                active,
                position.rowIndex,
                span.columnIndex,
                span.columnSpan,
            );
        },
        "row-active": (state, { rowIndex }) =>
            state.activePosition?.rowIndex === rowIndex,
    },
    engine: ({ model, engine }) => ({
        // a cell made active (a click, a Tab, a control taking focus, an edit): refused by a
        // middleware or a controlled parent, it is not
        activate: (position) =>
            engine.same(model.state.activePosition, position) ||
            model.run("active-position.set", position).ok,
        // an edit's Enter and Tab: a step, the rows in view a page
        move: (direction) => {
            model.run("active-position.move", {
                direction,
                pageSize: engine.pageSize(),
                visibleColumns: engine.visibleColumns(),
            });
        },
        // the arrows (mirrored right to left), Home, End, Ctrl/⌘+Home and End, PageUp and
        // PageDown move the active cell, focus following; with none active, the first cell in
        // view takes it. A move to another cell leaves the range (the model's anchor rule)
        lastKeydown: (event) => {
            const move =
                (event.ctrlKey || event.metaKey
                    ? CTRL_KEYS[event.key]
                    : undefined) ??
                KEYS[inlineKey(event.key, engine.direction())];
            if (!move) return false;
            event.preventDefault();
            engine.followFocus(() => {
                if (!model.state.activePosition) {
                    engine.focusFirstVisibleCell();
                    return;
                }
                // refused, or landing where it was: focus stays where it is
                model.run("active-position.move", {
                    direction: move,
                    pageSize: engine.pageSize(),
                    visibleColumns: engine.visibleColumns(),
                });
            });
            return true;
        },
    }),
    root: {
        props: [
            "activePosition",
            "defaultActivePosition",
            "onActivePositionChange",
        ],
        options: (props) => ({
            activePosition:
                props.activePosition !== undefined
                    ? props.activePosition
                    : props.defaultActivePosition,
        }),
        controlled: (model) => [
            defineControlled<
                NavigationProps,
                FeatureState<NavigationTypes>,
                CellPosition | null
            >({
                prefix: "active-position.",
                // followed before the data props: a position valid before the rows change (rows
                // filtered down) survives them
                first: true,
                prop: (props) => props.activePosition,
                onChange: (props) => props.onActivePositionChange,
                read: (state) => state.activePosition,
                same: samePosition,
                fromCommand: (command, value) =>
                    command === "active-position.clear"
                        ? null
                        : (value as CellPosition),
                apply: (value) => {
                    if (value === null) model.run("active-position.clear");
                    else model.run("active-position.set", value);
                },
            }),
        ],
    },
});

/**
 * Navigation (`@fragiola/data-grid/navigation`): install it on a grid (`features:
 * [navigation()]`) for its cells to be navigated by keys, the APG grid pattern. Without it, a
 * grid is a table to assistive technologies, and its cells take no focus from it.
 */
export function navigation(): DataGridFeature<NavigationTypes> {
    return NAVIGATION;
}
