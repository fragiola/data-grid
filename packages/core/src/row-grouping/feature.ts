import { GROUP_TOGGLE_ATTRIBUTE, inlineKey, KEYS } from "../engine/dom";
import type { RowShare } from "../engine/parts";
import type { GridView } from "../engine/types";
import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
    type EngineKit,
    type FeatureEngineContext,
    type FeatureState,
} from "../feature/feature";
import { isRowKey, uniqueRowKeys } from "../model/expansion";
import { validRowKeys } from "../model/model";
import { done, fail, invalid, noRow } from "../model/result";
import { depthOf, groupExpanded, groupKeyAt, rowMetaAt } from "../model/source";
import type { CellPosition, RowKey, RowMeta } from "../model/types";
import { isIndex, sameKeys, toggledKey } from "../utils/utils";
import type {
    RowGroupingProps,
    RowGroupingTypes,
    RowGroupingView,
} from "./types";

// Row groups and trees (Epic #87, E3.1; a feature since Epic #151): the model keeps the expanded
// row groups' keys (`row-groups.set`, `row-groups.toggle`); a row that expands (a group row, a
// tree's parent: `getRowMeta`) says whether it is expanded (`aria-expanded`, its toggle), the
// grid is a `treegrid` with navigation, its rows carry their level, and the keys toggle (Enter,
// Space, → and ←). Which rows are shown is the app's (`@fragiola/data-grid/local` follows the
// keys): the row kinds themselves (`getRowMeta`, a row's depth and group) are the core's data
// contract. Without it, group rows render as rows, and nothing expands them.

/** The state as row grouping reads it. */
type State = FeatureState<RowGroupingTypes>;

/** The refusal of a toggle given neither a row's index nor a key. */
const TOGGLE_GROUP_BY =
    "toggle a rowIndex, or a groupKey (a string or a finite number)";

/** The state with the expanded row groups' keys (a set: the same keys reordered change nothing). */
function withGroupKeys(state: State, keys: readonly RowKey[]) {
    const next = sameKeys(keys, state.expandedGroupKeys)
        ? state
        : { ...state, expandedGroupKeys: keys };
    return done(next, next.expandedGroupKeys);
}

/**
 * A body row's share of grouping (Epic #87): whether a row heading a group is expanded, and a
 * `treegrid` row's ARIA: its level, its expansion, its set's size and its place in it (when its
 * meta says), while the rows have kinds.
 */
function rowShare(
    view: GridView<unknown, unknown> & RowGroupingView,
    rowIndex: number,
    meta: RowMeta | undefined,
    share: RowShare,
): void {
    if (!view.source.getRowMeta) return;
    const groupKey = meta && groupKeyAt(view, rowIndex, meta);
    const expanded =
        groupKey === undefined ? undefined : groupExpanded(view, groupKey);
    share.groupExpanded = expanded;
    share.ariaTree = {
        "aria-level": depthOf(meta) + 1,
        ...(expanded === undefined ? {} : { "aria-expanded": expanded }),
        ...(meta?.setSize === undefined
            ? {}
            : { "aria-setsize": meta.setSize }),
        ...(meta?.posInSet === undefined
            ? {}
            : { "aria-posinset": meta.posInSet }),
    };
}

/** Row grouping's handlers in an engine: its toggles' clicks and its keys. */
function groupingEngine({
    model,
    engine,
}: FeatureEngineContext<RowGroupingTypes>) {
    /** the column the grid's group toggles were last found in, while the columns stay (Epic #87) */
    let treeColumn: number | null = null;

    /** The cell of this grid holding a group toggle (`value`: its attribute's, or any), or `null`. */
    function toggleCellOf(kit: EngineKit, value: string): CellPosition | null {
        const viewport = kit.viewport();
        if (!viewport) return null;
        for (const toggle of viewport.querySelectorAll(
            `[${GROUP_TOGGLE_ATTRIBUTE}${value}]`,
        )) {
            if (kit.inViewport(toggle)) return kit.cellOf(toggle);
        }
        return null;
    }

    /**
     * Whether a cell is on its row's tree cell (Epic #87): the cell holding the row's group
     * toggle; for a row rendering none (a leaf, a row loading), the column this grid's toggles are
     * in: one rendered now, else the one they were last found in (`treeColumn`, while the columns
     * stay), else the first column. The app keeps its toggles in one column.
     */
    function onTreeColumn(position: CellPosition): boolean {
        const own = toggleCellOf(engine, `="${position.rowIndex}"`);
        const found = own ?? toggleCellOf(engine, "");
        if (found) treeColumn = found.columnIndex;
        if (own) return own.columnIndex === position.columnIndex;
        return position.columnIndex === (treeColumn ?? 0);
    }

    /**
     * A row group's keys on a body cell in navigation (Epic #87, the APG treegrid), rows having
     * kinds: Enter on a group row toggles it, and Space on any row that expands (a tree's parent
     * too, Enter staying its cell's), once per press; on the cell holding the row's toggle (else,
     * the row rendering none, its first column), → expands a collapsed row group and ← collapses
     * an expanded one, or, from a row that is not an expanded group, goes to the row it is under
     * (the same column). Each through a command, so a middleware can refuse it; any other arrow,
     * or one with nothing to do here, moves.
     */
    function rowGroupKey(event: KeyboardEvent, target: Element): boolean {
        const state = model.state;
        if (
            !state.source.getRowMeta ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
        ) {
            return false;
        }
        const position = engine.bodyCellOf(target);
        if (!position) return false;
        const { rowIndex } = position;
        const meta = rowMetaAt(state.source, rowIndex);
        const groupKey = groupKeyAt(state, rowIndex, meta);
        // Enter on a group row only (a data row's Enter is its cell's: its controls, editing);
        // Space on any row that expands (a tree's parent too)
        if (
            (event.key === "Enter" && meta?.group) ||
            (event.key === " " && groupKey !== undefined)
        ) {
            event.preventDefault();
            // a held key repeats: it would open and close the group
            if (!event.repeat) model.run("row-groups.toggle", { rowIndex });
            return true;
        }
        const move = KEYS[inlineKey(event.key, engine.direction())];
        const parentIndex = meta?.parentIndex;
        // a row that neither expands nor sits under one: plain arrows, nothing looked for; else
        // on its tree cell only (`onTreeColumn`)
        if (
            (move !== "left" && move !== "right") ||
            (groupKey === undefined && parentIndex === undefined) ||
            !onTreeColumn(position)
        ) {
            return false;
        }
        // → on a collapsed row group expands it, ← on an expanded one collapses it
        if (
            groupKey !== undefined &&
            groupExpanded(state, groupKey) === (move === "left")
        ) {
            event.preventDefault();
            model.run("row-groups.toggle", { rowIndex });
            return true;
        }
        if (
            move === "right" ||
            parentIndex === undefined ||
            !isIndex(parentIndex, state.rowCount)
        ) {
            return false;
        }
        event.preventDefault();
        // the same column: the tree's (a parent's toggle is where its rows' is)
        engine.followFocus(() => {
            engine.activate({
                rowIndex: parentIndex,
                columnIndex: position.columnIndex,
            });
        });
        return true;
    }

    return {
        // on body cells (a header cell's keys are sorting's and reordering's): Enter and Space
        // toggle a group row (its controls get the keys by F2), the arrows on a row's tree cell
        // expand, collapse or go up the tree
        keydown: rowGroupKey,
        // a row group's toggle (Epic #87): a control of its cell, never a sort or a selection,
        // whatever the modifiers
        click: (event: MouseEvent) => {
            const toggle = engine.markedOf(
                event.target,
                GROUP_TOGGLE_ATTRIBUTE,
            );
            if (!toggle) return false;
            model.run("row-groups.toggle", { rowIndex: Number(toggle.value) });
            return true;
        },
        changed: (
            before: { readonly columns: unknown },
            after: { readonly columns: unknown },
        ) => {
            if (after.columns !== before.columns) treeColumn = null;
        },
    };
}

/** Row grouping's definition: every grid installing it shares it. */
const GROUPING = defineFeature<RowGroupingTypes>({
    name: "rowGrouping",
    initial: (_state, options) => ({
        expandedGroupKeys: uniqueRowKeys(options.expandedGroupKeys ?? []) ?? [],
    }),
    commands: {
        "row-groups.set": (state, { groupKeys }) => {
            const keys = validRowKeys(groupKeys, "groupKeys");
            if (!keys.ok) return keys;
            return withGroupKeys(state, keys.value);
        },
        "row-groups.toggle": (state, payload) => {
            let key: RowKey | undefined;
            if (payload.rowIndex !== undefined) {
                if (!isIndex(payload.rowIndex, state.rowCount)) {
                    return noRow(payload.rowIndex);
                }
                key = groupKeyAt(state, payload.rowIndex);
                if (key === undefined) {
                    return fail(
                        "refused",
                        `row ${payload.rowIndex} does not expand (no group row, nor a loaded row that expands)`,
                    );
                }
            } else if (isRowKey(payload.groupKey)) {
                key = payload.groupKey;
            } else {
                return invalid(TOGGLE_GROUP_BY);
            }
            return withGroupKeys(
                state,
                toggledKey(state.expandedGroupKeys, key),
            );
        },
    },
    queries: {
        "expanded-group-keys": (state) => state.expandedGroupKeys,
    },
    questions: {
        "row-group-expanded": (state, { rowIndex }) =>
            groupExpanded(state, groupKeyAt(state, rowIndex)),
    },
    // with navigation, the grid of rows having kinds is a treegrid
    tree: true,
    view: ["expandedGroupKeys"],
    row: rowShare,
    engine: groupingEngine,
    root: {
        props: [
            "expandedGroupKeys",
            "defaultExpandedGroupKeys",
            "onExpandedGroupKeysChange",
        ],
        options: (props) => ({
            expandedGroupKeys:
                props.expandedGroupKeys ?? props.defaultExpandedGroupKeys,
        }),
        controlled: (model) => [
            defineControlled<RowGroupingProps, State, readonly RowKey[]>({
                prefix: "row-groups.",
                prop: (props) => props.expandedGroupKeys,
                onChange: (props) => props.onExpandedGroupKeysChange,
                read: (state) => state.expandedGroupKeys,
                // a set: the same keys in another order are no change
                same: sameKeys,
                apply: (groupKeys) => {
                    model.run("row-groups.set", { groupKeys });
                },
            }),
        ],
    },
});

/**
 * Row groups and trees (Epic #87, E3.1), as a feature (Epic #151): install it (`features:
 * [rowGrouping()]`) for group rows and a tree's parents to expand (their toggles, the keys, the
 * `expandedGroupKeys` props) and for the grid to be a `treegrid`.
 */
export function rowGrouping(): DataGridFeature<RowGroupingTypes> {
    return GROUPING;
}
