// @fragiola/data-grid-react/selection: the selection's extras (Epic #57, R8). An opt-in entry
// point: the primitives never import it, and an app that never imports it never ships it.

import type { RowKey } from "@fragiola/data-grid";
import {
    type SelectionStatus,
    selectAllState,
    selectAllToggled,
} from "@fragiola/data-grid/selection";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useDataGrid } from "../context";
import { type DataGridRef, noSubscription } from "../hooks/use-data-grid-ref";

export {
    type SelectionStatus,
    selectionStatus,
    toggledRowKeys,
    withoutRowKeys,
    withRowKeys,
} from "@fragiola/data-grid/selection";

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
 * is selected and the toggle does nothing. Inside a `Root`, or with a `gridRef` (nothing selected
 * until a `Root` takes it).
 */
export function useSelectAll<TRow>(
    rowKeys: readonly RowKey[],
    gridRef?: DataGridRef<TRow>,
): SelectAll {
    const model = useDataGrid(gridRef)?.model;
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
