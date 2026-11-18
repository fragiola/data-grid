import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
    type FeatureState,
} from "../feature/feature";
import {
    DEFAULT_DETAIL_HEIGHT,
    holdsRow,
    isRowKey,
    newRowsOf,
    sameRowKeys,
    uniqueRowKeys,
} from "../model/expansion";
import { validEstimate, validRowKeys } from "../model/model";
import { done, fail, invalid } from "../model/result";
import { groupAt, loadedKeyAt, loadedRowKey } from "../model/source";
import type { RowKey } from "../model/types";
import { keySet, toggledKey } from "../utils/utils";
import { expandedRowsOf, withExpandedRows, withRow } from "./expansion";
import type {
    RowExpansionProps,
    RowExpansionState,
    RowExpansionTypes,
} from "./types";

// Expanded rows and their details (M1–M4; a feature since Epic #151): the model keeps the
// expanded rows' keys (`expanded-rows.set`, `expanded-rows.toggle`) and derives the rows shown
// expanded, which it tells the core through its `rowDetails` contribution point: the core lays
// their details out on the rows' axis, sizes them (`detailHeight`, a size: D7) and measures them
// (`"auto"`, the engine's `detail` layer). The adapters' `RowDetail` renders one. Without it, no
// row expands and no detail renders.

/** The state as row expansion reads it. */
type State = FeatureState<RowExpansionTypes>;

/** The refusal of a toggle given neither a row's index nor its key. */
const TOGGLE_BY =
    "toggle a rowIndex, or a rowKey (a string or a finite number)";

/**
 * The expanded rows before the model's first rows are given (`initial`): looked for in them once
 * the model is made (`stateChanged`, at creation).
 */
const UNSEARCHED: readonly number[] = Object.freeze([]);

/** Row expansion's definition: every grid installing it shares it. */
const EXPANSION = defineFeature<RowExpansionTypes>({
    name: "rowExpansion",
    initial: (state, options) => {
        const slice: RowExpansionState = {
            expandedRowKeys: uniqueRowKeys(options.expandedRowKeys ?? []) ?? [],
            expandedRows: UNSEARCHED,
            // one cache per grid: where each expanded key's row was last seen
            expandedRowHints: new Map(),
        };
        // a detail's sizes are the core's (D7), given by its options
        const sizes = {
            detailHeight: options.detailHeight ?? state.detailHeight,
            estimatedDetailHeight: validEstimate(options.estimatedDetailHeight)
                ? options.estimatedDetailHeight
                : state.estimatedDetailHeight,
        };
        return { ...slice, ...sizes };
    },
    commands: {
        "expanded-rows.set": (state, { rowKeys }) => {
            const keys = validRowKeys(rowKeys);
            if (!keys.ok) return keys;
            const next = sameRowKeys(keys.value, state.expandedRowKeys)
                ? state
                : withExpandedRows(
                      { ...state, expandedRowKeys: keys.value },
                      state.expandedRowHints,
                  );
            return done(next, next.expandedRowKeys);
        },
        "expanded-rows.toggle": (state, payload) => {
            const hints = state.expandedRowHints;
            let key: RowKey;
            if (payload.rowIndex !== undefined) {
                // its key is unknown until it loads; a group row has no detail (Epic #87)
                const found = loadedKeyAt(state, payload.rowIndex, (rowIndex) =>
                    fail(
                        "refused",
                        groupAt(state.source, rowIndex)
                            ? `row ${rowIndex} is a group row: it has no detail`
                            : `row ${rowIndex} is not loaded`,
                    ),
                );
                if (!found.ok) return found;
                key = found.value;
            } else if (isRowKey(payload.rowKey)) {
                key = payload.rowKey;
            } else {
                return invalid(TOGGLE_BY);
            }
            const expanded = keySet(state.expandedRowKeys).has(key);
            const keys = toggledKey(state.expandedRowKeys, key);
            let expandedRows: readonly number[];
            if (payload.rowIndex !== undefined) {
                // the toggled row alone changes: the others are where they were
                const index = payload.rowIndex;
                hints.set(key, index);
                // collapsed: every row showing the key goes (a key the data repeats included)
                expandedRows = expanded
                    ? state.expandedRows.filter(
                          (entry) => loadedRowKey(state, entry) !== key,
                      )
                    : withRow(state.expandedRows, index);
            } else {
                expandedRows = expandedRowsOf(
                    { ...state, expandedRowKeys: keys },
                    hints,
                    { start: 0, end: state.rowCount },
                );
            }
            return done(
                { ...state, expandedRowKeys: keys, expandedRows },
                keys,
            );
        },
    },
    queries: {
        "expanded-row-keys": (state) => state.expandedRowKeys,
        "expanded-rows": (state) => state.expandedRows,
        "detail-height": (state) => state.detailHeight,
    },
    questions: {
        "row-expanded": (state, { rowIndex }) =>
            holdsRow(state.expandedRows, rowIndex),
    },
    // the expanded rows looked for where a new source, or the rows told changed, may hold them
    sourceChanged: (after, before) => {
        if (after.source !== before.source || after.rowKey !== before.rowKey) {
            return withExpandedRows(
                after,
                after.expandedRowHints,
                newRowsOf(before, after),
            );
        }
        if (after.rowsChanged !== before.rowsChanged) {
            return withExpandedRows(
                after,
                after.expandedRowHints,
                after.rowsChanged,
            );
        }
        return after;
    },
    // at creation: the keys given looked for in the rows given
    stateChanged: (after) =>
        after.expandedRows === UNSEARCHED
            ? {
                  ...after,
                  expandedRows: expandedRowsOf(after, after.expandedRowHints, {
                      start: 0,
                      end: after.rowCount,
                  }),
              }
            : after,
    rowDetails: (state) => state.expandedRows,
    root: {
        props: [
            "expandedRowKeys",
            "defaultExpandedRowKeys",
            "onExpandedRowKeysChange",
            "detailHeight",
            "estimatedDetailHeight",
        ],
        options: (props) => ({
            expandedRowKeys:
                props.expandedRowKeys ?? props.defaultExpandedRowKeys,
            detailHeight: props.detailHeight,
            estimatedDetailHeight: props.estimatedDetailHeight,
        }),
        controlled: (model) => [
            defineControlled<
                RowExpansionProps<unknown>,
                State,
                readonly RowKey[]
            >({
                prefix: "expanded-rows.",
                prop: (props) => props.expandedRowKeys,
                onChange: (props) => props.onExpandedRowKeysChange,
                read: (state) => state.expandedRowKeys,
                same: sameRowKeys,
                apply: (rowKeys) => {
                    model.run("expanded-rows.set", { rowKeys });
                },
            }),
        ],
        // a detail's sizes, each on its own and only when it changed (a prop removed goes back to
        // the default): an estimate refused (no size above 0) never holds the height back
        follow: (model) => [
            {
                inputs: (props) => [
                    props.detailHeight,
                    props.estimatedDetailHeight,
                ],
                run: (props) => {
                    const detail = props.detailHeight ?? DEFAULT_DETAIL_HEIGHT;
                    if (detail !== model.state.detailHeight) {
                        model.run("sizes.set", { detailHeight: detail });
                    }
                    const estimate =
                        props.estimatedDetailHeight ?? DEFAULT_DETAIL_HEIGHT;
                    if (estimate !== model.state.estimatedDetailHeight) {
                        model.run("sizes.set", {
                            estimatedDetailHeight: estimate,
                        });
                    }
                },
            },
        ],
    },
});

/**
 * Expanded rows and their details (M1–M4), as a feature (Epic #151): install it (`features:
 * [rowExpansion()]`) for rows to expand (`expanded-rows.*`, the `expandedRowKeys` props) and
 * show their detail (the adapters' `RowDetail`, from their `/row-expansion`).
 */
export function rowExpansion(): DataGridFeature<RowExpansionTypes> {
    return EXPANSION;
}
