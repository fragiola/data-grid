// @fragiola/data-grid-react/selection: the selection's extras (Epic #57, R8). An opt-in entry
// point: the primitives never import it, and an app that never imports it never ships it.

import type { RowKey } from "@fragiola/data-grid";
import {
    type SelectionStatus,
    selectionStatus,
    withoutRowKeys,
    withRowKeys,
} from "@fragiola/data-grid/selection";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useDataGrid } from "../context";
import type { DataGridRef } from "../gridRef";

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
}

const NONE = { status: "none", count: 0 } as const;
const noSubscription = () => () => {};

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
    // the keys and the mode: a new state object only when a command changed something
    const read = () => model?.state;
    const state = useSyncExternalStore(subscribe, read, read);
    const mode = state?.rowSelection;
    const selected = state?.selectedRowKeys;
    const { status, count } = useMemo(
        () => (mode && selected ? selectionStatus(rowKeys, selected) : NONE),
        [mode, selected, rowKeys],
    );
    const toggle = useCallback(() => {
        if (!model || !mode) return;
        const current = model.state.selectedRowKeys;
        if (status === "all" || mode === "single") {
            if (count > 0) {
                model.run("selected-rows.set", {
                    rowKeys: withoutRowKeys(current, rowKeys),
                });
            }
            return;
        }
        model.run("selected-rows.set", {
            rowKeys: withRowKeys(current, rowKeys),
        });
    }, [model, mode, status, count, rowKeys]);
    return { status, count, toggle };
}
