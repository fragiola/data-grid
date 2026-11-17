import { isSelectAll } from "../engine/shortcuts";
import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
    type FeatureState,
} from "../feature/feature";
import { isRowKey, sameRowKeys, uniqueRowKeys } from "../model/expansion";
import type { DataGridModel } from "../model/model";
import { validRowKeys } from "../model/model";
import { done, fail, invalid, noRow, notOneOf } from "../model/result";
import { dataRowAt, loadedKeyAt, rowKeyAt, rowMetaAt } from "../model/source";
import type {
    CommandFailure,
    CommandResult,
    GroupRow,
    RowKey,
    SelectionAnchor,
} from "../model/types";
import type { NavigationTypes } from "../navigation/types";
import type { CellRangeTypes } from "../range/types";
import { isIndex, keySet } from "../utils/utils";
import {
    allKeys,
    extendedKeys,
    groupSelectable,
    groupToggledKeys,
    isRowSelectable,
    isRowSelected,
    keptAnchor,
    keptRowKeys,
    notLoaded,
    ROW_SELECTIONS,
    rowSelectableWith,
    rowSelectedWith,
    sameAnchor,
    toggledKeys,
    validAnchor,
} from "./selection";
import type {
    RowSelectionCommands,
    RowSelectionProps,
    RowSelectionTypes,
} from "./types";

// Row selection (Epic #57, R1–R9; a feature since Epic #144): the model keeps the selected rows'
// keys, the mode and the anchor (`selected-rows.*`, `selection-anchor.*`, `row-selection.set`),
// Shift+Space, Shift+↑/↓ and Ctrl/⌘+A select from a body cell, the rows carry `aria-selected` and
// `data-selected`, the grid `aria-multiselectable` in multiple mode, and a root takes
// `rowSelection`, `isRowSelectable` and `selectedRowKeys` / `defaultSelectedRowKeys` /
// `onSelectedRowKeysChange`. Headless: the checkbox is the app's.

/** The state as row selection reads it. */
type State = FeatureState<RowSelectionTypes>;

/** A handler's result: the state it leaves and its value, or why not. */
type Applied<R> = CommandResult<{ readonly state: State; readonly value: R }>;

/** What `selected-rows.toggle` returns: the keys, and the anchor it leaves. */
type ToggleResult = RowSelectionCommands["selected-rows.toggle"]["result"];

/** The refusal of a toggle given neither a row's index nor its key. */
const TOGGLE_BY =
    "toggle a rowIndex, or a rowKey (a string or a finite number)";

/** Every selection command's refusal while rows are not selectable. */
function selectionOff(): CommandFailure {
    return fail("refused", "rows are not selectable (no rowSelection)");
}

/** A toggle's value: the keys, and the anchor it leaves (a controlled root keeps that part). */
function toggled(applied: Applied<readonly RowKey[]>): Applied<ToggleResult> {
    if (!applied.ok) return applied;
    const { state } = applied.value;
    return done(state, {
        rowKeys: state.selectedRowKeys,
        anchor: state.selectionAnchor,
    });
}

/** A range of rows toggled from the anchor (`extendedKeys`): selected, the anchor where it is. */
function extendedTo(
    state: State,
    extended: CommandResult<readonly RowKey[]>,
): Applied<ToggleResult> {
    return extended.ok
        ? toggled(selected(state, extended.value, state.selectionAnchor))
        : extended;
}

/** The state with the selected keys and the anchor, the same object when neither changed. */
function selected(
    state: State,
    keys: readonly RowKey[],
    anchor: SelectionAnchor | null,
): Applied<readonly RowKey[]> {
    const sameKeys = sameRowKeys(keys, state.selectedRowKeys);
    const next =
        sameKeys && sameAnchor(anchor, state.selectionAnchor)
            ? state
            : {
                  ...state,
                  selectedRowKeys: sameKeys ? state.selectedRowKeys : keys,
                  selectionAnchor: anchor,
              };
    return done(next, next.selectedRowKeys);
}

/** A setting's next value: `undefined` keeps the current one, `null` clears it. */
function setting<T>(value: T | null | undefined, current: T | undefined) {
    return value === undefined ? current : (value ?? undefined);
}

/**
 * A group row's selection toggled (Epic #87): its rows' keys, all selected or all cleared (many
 * rows only; a group naming none cannot be). With `extend`, a range from the anchor to it (group
 * rows giving their rows' keys); without an anchor, a toggle.
 */
function toggledGroup(
    state: State,
    group: GroupRow,
    rowIndex: number,
    extend: boolean,
): Applied<ToggleResult> {
    if (!groupSelectable(state, group)) {
        return fail(
            "refused",
            `group row "${String(group.key)}" cannot be selected (multiple mode, its rows' keys)`,
        );
    }
    // a range from the anchor; without one, a toggle (as a data row's)
    const extended = extend ? extendedKeys(state, rowIndex) : undefined;
    if (extended) {
        return extendedTo(state, extended);
    }
    // a toggle by index makes its row the anchor, with the state it gave (as a data row's)
    const was = isRowSelected(state, rowIndex);
    return toggled(
        selected(state, groupToggledKeys(state, group), {
            rowKey: group.key,
            rowIndex,
            selected: !was,
        }),
    );
}

/** The row selection feature's definition: every grid installing it shares it. */
const ROW_SELECTION = defineFeature<RowSelectionTypes>({
    name: "rowSelection",
    initial: (_state, options) => {
        const mode =
            options.rowSelection &&
            ROW_SELECTIONS.includes(options.rowSelection)
                ? options.rowSelection
                : undefined;
        return {
            rowSelection: mode,
            selectedRowKeys: keptRowKeys(
                uniqueRowKeys(options.selectedRowKeys ?? []) ?? [],
                mode,
            ),
            isRowSelectable: options.isRowSelectable,
            selectionAnchor: null,
        };
    },
    commands: {
        "selected-rows.set": (state, { rowKeys }) => {
            if (!state.rowSelection) return selectionOff();
            const unique = validRowKeys(rowKeys);
            if (!unique.ok) return unique;
            const keys = keptRowKeys(unique.value, state.rowSelection);
            return selected(
                state,
                keys,
                keptAnchor(state, state.selectionAnchor, keys),
            );
        },
        "selected-rows.toggle": (state, payload) => {
            if (!state.rowSelection) return selectionOff();
            if (payload.rowIndex === undefined) {
                if (!isRowKey(payload.rowKey)) return invalid(TOGGLE_BY);
                // no index to start a range from: the anchor goes
                return toggled(
                    selected(state, toggledKeys(state, payload.rowKey), null),
                );
            }
            const rowIndex = payload.rowIndex;
            // the row read once: a group row, or a data row's key
            const meta = rowMetaAt(state.source, rowIndex);
            if (meta?.group) {
                return toggledGroup(
                    state,
                    meta.group,
                    rowIndex,
                    payload.extend === true,
                );
            }
            const found = loadedKeyAt(state, rowIndex, notLoaded, meta);
            if (!found.ok) return found;
            const key = found.value;
            // one row at a time has no range: a Shift+click is a toggle there
            if (payload.extend === true && state.rowSelection === "multiple") {
                const extended = extendedKeys(state, rowIndex);
                // the range starts where it did: the anchor stays
                if (extended) {
                    return extendedTo(state, extended);
                }
                // nothing to extend from: a toggle
            }
            const was = keySet(state.selectedRowKeys).has(key);
            // a row that cannot be selected is never added; one selected already can be cleared
            if (!isRowSelectable(state, rowIndex) && !was) {
                return fail("refused", `row ${rowIndex} cannot be selected`);
            }
            return toggled(
                selected(state, toggledKeys(state, key), {
                    rowKey: key,
                    rowIndex,
                    selected: !was,
                }),
            );
        },
        "selection-anchor.clear": (state) =>
            done(
                state.selectionAnchor
                    ? { ...state, selectionAnchor: null }
                    : state,
                undefined,
            ),
        "selection-anchor.set": (state, { rowIndex, selected: selects }) => {
            if (!state.rowSelection) return selectionOff();
            if (!isIndex(rowIndex, state.rowCount)) {
                return noRow(rowIndex);
            }
            // a group row's anchor is its group key (Epic #87)
            const rowKey = rowKeyAt(state, rowIndex);
            if (rowKey === undefined) return notLoaded(rowIndex);
            const anchor = {
                rowKey,
                rowIndex,
                selected: selects !== false,
            };
            const next = sameAnchor(state.selectionAnchor, anchor)
                ? state
                : { ...state, selectionAnchor: anchor };
            return done(next, next.selectionAnchor ?? anchor);
        },
        "selected-rows.select-all": (state) => {
            if (!state.rowSelection) return selectionOff();
            if (state.rowSelection === "single") {
                return fail("refused", "a single selection selects one row");
            }
            const all = allKeys(state);
            if (!all.ok) return all;
            return selected(
                state,
                all.value,
                keptAnchor(state, state.selectionAnchor, all.value),
            );
        },
        "row-selection.set": (state, { rowSelection, isRowSelectable }) => {
            if (
                rowSelection !== undefined &&
                rowSelection !== null &&
                !ROW_SELECTIONS.includes(rowSelection)
            ) {
                return notOneOf("rowSelection", ROW_SELECTIONS);
            }
            if (
                isRowSelectable !== undefined &&
                isRowSelectable !== null &&
                typeof isRowSelectable !== "function"
            ) {
                return invalid("isRowSelectable must be a function");
            }
            const mode = setting(rowSelection, state.rowSelection);
            const filter = setting(isRowSelectable, state.isRowSelectable);
            const keys = keptRowKeys(state.selectedRowKeys, mode);
            const next =
                mode === state.rowSelection &&
                filter === state.isRowSelectable &&
                keys === state.selectedRowKeys
                    ? state
                    : {
                          ...state,
                          rowSelection: mode,
                          isRowSelectable: filter,
                          selectedRowKeys: keys,
                          // no range survives selection turned off, nor its row trimmed
                          selectionAnchor: mode
                              ? keptAnchor(state, state.selectionAnchor, keys)
                              : null,
                      };
            return done(next, undefined);
        },
    },
    queries: {
        "row-selection": (state) => state.rowSelection,
        "selected-row-keys": (state) => state.selectedRowKeys,
        "selection-anchor": (state) => validAnchor(state),
    },
    questions: {
        "row-selected": (state, { rowIndex }) => isRowSelected(state, rowIndex),
        "row-selectable": (state, { rowIndex }) =>
            isRowSelectable(state, rowIndex),
    },
    view: ["rowSelection", "selectedRowKeys", "isRowSelectable"],
    // a row selected, or one that can be (`aria-selected` false: ARIA's "selectable, not
    // selected"); its data row read only while rows are selectable
    row: (view, rowIndex, meta, share) => {
        if (!view.rowSelection) return;
        const row = dataRowAt(view.source, rowIndex, meta);
        const selected = rowSelectedWith(view, rowIndex, meta, row);
        share.selected = selected;
        share.ariaSelected =
            selected || rowSelectableWith(view, rowIndex, meta, row)
                ? selected
                : undefined;
    },
    grid: (view) =>
        view.rowSelection === "multiple" ? MULTISELECTABLE : undefined,
    engine: ({ model, engine }) => {
        // the active cell's commands are the navigation's, the cells' selection the range's:
        // asked through their keys
        const grid = model as unknown as DataGridModel<
            unknown,
            unknown,
            readonly [
                DataGridFeature<RowSelectionTypes>,
                DataGridFeature<NavigationTypes>,
                DataGridFeature<CellRangeTypes>,
            ]
        >;
        return {
            // on a body cell: Shift+Space toggles its row, Shift+↑/↓ (many rows) move and select
            // from the anchor, Ctrl/⌘+A selects every row; each one command, which a middleware
            // can refuse. While cells are selectable, Shift+↑/↓ and Ctrl/⌘+A are theirs
            laterKeydown: (event, target) => {
                const mode = grid.state.rowSelection;
                const position = mode ? engine.bodyCellOf(target) : null;
                if (!mode || !position) return false;
                const rowIndex = position.rowIndex;
                const ctrl = event.ctrlKey || event.metaKey;
                if (event.key === " " && event.shiftKey && !ctrl) {
                    event.preventDefault();
                    // a held key repeats: it would toggle the row on and off
                    if (!event.repeat) {
                        grid.run("selected-rows.toggle", { rowIndex });
                    }
                    return true;
                }
                if (mode !== "multiple" || grid.get("cell-selection")) {
                    return false;
                }
                if (isSelectAll(event)) {
                    // handled even when refused: the page's text is never selected instead
                    event.preventDefault();
                    if (!event.repeat) grid.run("selected-rows.select-all", {});
                    return true;
                }
                if (
                    !event.shiftKey ||
                    ctrl ||
                    (event.key !== "ArrowDown" && event.key !== "ArrowUp")
                ) {
                    return false;
                }
                const down = event.key === "ArrowDown";
                // up into the header: a plain move
                if (!down && rowIndex === 0) return false;
                event.preventDefault();
                if (down && rowIndex === grid.state.rowCount - 1) return true;
                const move = {
                    direction: down ? "down" : "up",
                    visibleColumns: engine.visibleColumns(),
                } as const;
                // a move refused (or no navigation) selects nothing
                const asked = grid.check("active-position.move", move);
                if (!asked.ok) return true;
                // Shift+arrows select: without an anchor that selects, the range starts from
                // this row (it included). One selection command a key: a controlled parent
                // answers each
                if (!grid.get("selection-anchor")?.selected) {
                    grid.run("selection-anchor.set", { rowIndex });
                }
                engine.followFocus(() => {
                    grid.run("active-position.move", move);
                    // extended to the row the move reached (a middleware may have redirected
                    // it), or, when a controlled parent answers the move later, to the row it
                    // was asked for
                    const moved = grid.state.activePosition?.rowIndex;
                    const reached =
                        moved !== undefined && moved !== rowIndex
                            ? moved
                            : asked.value.rowIndex;
                    if (reached >= 0 && reached !== rowIndex) {
                        grid.run("selected-rows.toggle", {
                            rowIndex: reached,
                            extend: true,
                        });
                    }
                });
                return true;
            },
        };
    },
    root: {
        props: [
            "rowSelection",
            "isRowSelectable",
            "selectedRowKeys",
            "defaultSelectedRowKeys",
            "onSelectedRowKeysChange",
        ],
        options: (props) => ({
            rowSelection: props.rowSelection,
            isRowSelectable: props.isRowSelectable,
            selectedRowKeys:
                props.selectedRowKeys ?? props.defaultSelectedRowKeys,
        }),
        controlled: (model) => [
            defineControlled<RowSelectionProps, State, readonly RowKey[]>({
                prefix: "selected-rows.",
                // the keys follow the prop while rows are selectable; off, the model keeps the
                // keys it had (no row shows them) and the prop waits until it is on again
                prop: (props) =>
                    props.rowSelection ? props.selectedRowKeys : undefined,
                onChange: (props) => props.onSelectedRowKeysChange,
                // an uncontrolled selection to start with that single mode trimmed (its last key
                // kept): the app is told the keys the grid holds
                start: (props) =>
                    props.rowSelection
                        ? props.defaultSelectedRowKeys
                        : undefined,
                read: (state) => state.selectedRowKeys,
                same: sameRowKeys,
                fromCommand: (command, value) =>
                    command === "selected-rows.toggle"
                        ? (value as ToggleResult).rowKeys
                        : (value as readonly RowKey[]),
                apply: (rowKeys) => {
                    model.run("selected-rows.set", { rowKeys });
                },
                // the parent answers the keys; where a range starts is the grid's: a toggle's
                // anchor is kept as the model would have left it
                vetoed: (command, value) => {
                    if (command !== "selected-rows.toggle") return;
                    const { anchor } = value as ToggleResult;
                    if (anchor) {
                        model.run("selection-anchor.set", {
                            rowIndex: anchor.rowIndex,
                            selected: anchor.selected,
                        });
                    } else {
                        model.run("selection-anchor.clear", {});
                    }
                },
            }),
        ],
        // the mode and the filter: a prop removed turns it off
        follow: (model) => [
            {
                inputs: (props) => [props.rowSelection, props.isRowSelectable],
                run: ({ rowSelection, isRowSelectable }) => {
                    const { state } = model;
                    if (
                        rowSelection !== state.rowSelection ||
                        isRowSelectable !== state.isRowSelectable
                    ) {
                        model.run("row-selection.set", {
                            rowSelection: rowSelection ?? null,
                            isRowSelectable: isRowSelectable ?? null,
                        });
                    }
                },
            },
        ],
    },
});

/** The grid's attribute while many rows can be selected. */
const MULTISELECTABLE = { "aria-multiselectable": true } as const;

/**
 * Row selection (`@fragiola/data-grid/row-selection`): install it on a grid (`features:
 * [rowSelection()]`) for its rows to be selected (`rowSelection: "single" | "multiple"`). The grid
 * keeps the keys; the checkbox is the app's.
 */
export function rowSelection(): DataGridFeature<RowSelectionTypes> {
    return ROW_SELECTION;
}
