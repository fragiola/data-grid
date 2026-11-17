// @fragiola/data-grid-angular/selection: the selection's extras (Epic #57, R8). An opt-in entry
// point: the directives never import it, and an app that never imports it never ships it.

import {
    computed,
    effect,
    isSignal,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import type { RowKey, RowSelection } from "@fragiola/data-grid";
import {
    type SelectAllState,
    selectAllState,
    selectAllToggled,
} from "@fragiola/data-grid/selection";
import {
    type DataGridContextValue,
    type DataGridRef,
    injectDataGrid,
} from "@fragiola/data-grid-angular";

export {
    type SelectionStatus,
    selectionStatus,
    toggledRowKeys,
    withoutRowKeys,
    withRowKeys,
} from "@fragiola/data-grid/selection";

/** What `injectSelectAll` gives a "select all" control: each field read when used. */
export interface SelectAll extends SelectAllState {
    /**
     * selects every one of the rows, or clears them when every one is selected; with one row at
     * a time (single mode), it only clears
     */
    readonly toggle: () => void;
}

/**
 * A "select all" control's state over the rows the app names (`rowKeys`: the rows on screen, a
 * page, every filtered row; leave out the rows that cannot be selected), and its toggle, through
 * `selected-rows.set` (a controlled grid asks the parent; React's `useSelectAll`). While rows are
 * not selectable, nothing is selected and the toggle does nothing. Inside a root, or with a
 * `gridRef` (nothing selected until a root takes it). Call it in an injection context.
 */
export function injectSelectAll<TRow>(
    rowKeys:
        | readonly RowKey[]
        | Signal<readonly RowKey[]>
        | (() => readonly RowKey[]),
    gridRef?: DataGridRef<TRow>,
): SelectAll {
    const keys = () =>
        isSignal(rowKeys) || typeof rowKeys === "function"
            ? (rowKeys as () => readonly RowKey[])()
            : rowKeys;
    const grid: Signal<DataGridContextValue<TRow> | null> = gridRef
        ? injectDataGrid(gridRef)
        : signal(injectDataGrid<TRow>()).asReadonly();
    // the keys and the mode alone: a move or a sort changes nothing here
    const selected = signal<readonly RowKey[]>([]);
    const mode = signal<RowSelection | undefined>(undefined);
    effect((onCleanup) => {
        const model = grid()?.model;
        untracked(() => {
            const read = () => {
                selected.set(model?.state.selectedRowKeys ?? []);
                mode.set(model?.state.rowSelection);
            };
            read();
            if (model) onCleanup(model.subscribe(read));
        });
    });
    const state = computed(() => selectAllState(mode(), selected(), keys()));
    const toggle = () => {
        const model = untracked(grid)?.model;
        if (!model) return;
        const next = selectAllToggled(
            model.state.rowSelection,
            model.state.selectedRowKeys,
            untracked(keys),
        );
        if (next) model.run("selected-rows.set", { rowKeys: next });
    };
    return {
        get status() {
            return state().status;
        },
        get count() {
            return state().count;
        },
        get canToggle() {
            return state().canToggle;
        },
        toggle,
    };
}
