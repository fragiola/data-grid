// @fragiola/data-grid-react/row-selection: row selection (Epic #57; a feature since Epic #144),
// the core's (`@fragiola/data-grid/row-selection`) re-exported, and its "select all" hook. An
// opt-in entry point: the primitives never import it, and an app that never installs row
// selection never ships it.

import type {
    DataGridFeature,
    DataGridModel,
    RowKey,
} from "@fragiola/data-grid";
import {
    type RowSelectionTypes,
    type SelectionStatus,
    selectAllState,
    selectAllToggled,
} from "@fragiola/data-grid/row-selection";
import {
    type ReactNode,
    useCallback,
    useMemo,
    useSyncExternalStore,
} from "react";
import { useDataGrid } from "../context";
import { type DataGridRef, noSubscription } from "../hooks/use-data-grid-ref";

export {
    type RowSelectionCommands,
    type RowSelectionOptions,
    type RowSelectionProps,
    type RowSelectionState,
    type RowSelectionTypes,
    rowSelection,
    type SelectAllState,
    type SelectionStatus,
    selectAllState,
    selectAllToggled,
    selectionStatus,
    toggledRowKeys,
    withoutRowKeys,
    withRowKeys,
} from "@fragiola/data-grid/row-selection";

/** A model with row selection installed (what `useSelectAll` reads and runs). */
type SelectionModel<TRow> = DataGridModel<
    TRow,
    ReactNode,
    readonly [DataGridFeature<RowSelectionTypes>]
>;

/** What `useSelectAll` gives a "select all" control. */
export interface SelectAll {
    /** how much of the rows is selected: `"some"` is a checkbox's indeterminate state */
    readonly status: SelectionStatus;
    /** how many of the rows are selected */
    readonly count: number;
    /**
     * selects every one of the rows, or clears them when every one is selected; with one row at
     * a time (single mode), it only clears
     */
    readonly toggle: () => void;
    /**
     * whether `toggle` does something: rows are selectable, and with one row at a time, one of
     * them is selected (to clear). A control can be disabled meanwhile
     */
    readonly canToggle: boolean;
}

/**
 * A "select all" control's state over the rows the app names (`rowKeys`: the rows on screen, a
 * page, every filtered row; leave out the rows that cannot be selected), and its toggle, through
 * `selected-rows.set` (a controlled grid asks the parent). While rows are not selectable, nothing
 * is selected and the toggle does nothing; without `rowSelection()` installed, rows never are.
 * Inside a `Root`, or with a `gridRef` (nothing selected until a `Root` takes it).
 */
export function useSelectAll<TRow>(
    rowKeys: readonly RowKey[],
    gridRef?: DataGridRef<TRow>,
): SelectAll {
    // the feature's state and command: `undefined` and `not_found` without it installed
    const model = useDataGrid(gridRef)?.model as
        | SelectionModel<TRow>
        | undefined;
    const subscribe = useMemo(
        () =>
            model
                ? (listener: () => void) => model.subscribe(listener)
                : noSubscription,
        [model],
    );
    // the keys and the mode alone: a move or a sort renders nothing here
    const readKeys = () => model?.state.selectedRowKeys;
    const readMode = () => model?.state.rowSelection;
    const selected = useSyncExternalStore(subscribe, readKeys, readKeys);
    const mode = useSyncExternalStore(subscribe, readMode, readMode);
    const { status, count, canToggle } = useMemo(
        () => selectAllState(mode, selected ?? [], rowKeys),
        [mode, selected, rowKeys],
    );
    const toggle = useCallback(() => {
        if (!model) return;
        const rowKeysSet = selectAllToggled(
            mode,
            model.state.selectedRowKeys,
            rowKeys,
        );
        if (rowKeysSet) {
            model.run("selected-rows.set", { rowKeys: rowKeysSet });
        }
    }, [model, mode, rowKeys]);
    return { status, count, toggle, canToggle };
}
