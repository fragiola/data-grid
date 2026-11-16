// @fragiola/data-grid-vue/selection: the selection's extras (Epic #57, R8). An opt-in entry
// point: the primitives never import it, and an app that never imports it never ships it.

import type { RowKey } from "@fragiola/data-grid";
import {
    type SelectAllState,
    selectAllState,
    selectAllToggled,
} from "@fragiola/data-grid/selection";
import {
    computed,
    type MaybeRefOrGetter,
    shallowRef,
    toValue,
    watch,
} from "vue";
import { type DataGridRef, useGrid } from "../context";

export {
    type SelectionStatus,
    selectionStatus,
    toggledRowKeys,
    withoutRowKeys,
    withRowKeys,
} from "@fragiola/data-grid/selection";

/** What `useSelectAll` gives a "select all" control: each field read when used. */
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
 * `selected-rows.set` (a controlled grid asks the parent). While rows are not selectable, nothing
 * is selected and the toggle does nothing. Inside a `Root`, or with a `gridRef` (nothing selected
 * until a `Root` takes it). Call it in `setup`.
 */
export function useSelectAll<TRow>(
    rowKeys: MaybeRefOrGetter<readonly RowKey[]>,
    gridRef?: DataGridRef<TRow>,
): SelectAll {
    const grid = useGrid(
        gridRef,
        "useSelectAll() must be used inside <DataGrid.Root>, or be given a gridRef",
    );
    // the keys and the mode alone: a move or a sort changes nothing here
    const selected = shallowRef<readonly RowKey[]>([]);
    const mode = shallowRef(grid.value?.model.state.rowSelection);
    watch(
        () => grid.value?.model,
        (model, _previous, onCleanup) => {
            const read = () => {
                selected.value = model?.state.selectedRowKeys ?? [];
                mode.value = model?.state.rowSelection;
            };
            read();
            if (model) onCleanup(model.subscribe(read));
        },
        { immediate: true, flush: "sync" },
    );
    const state = computed(() =>
        selectAllState(mode.value, selected.value, toValue(rowKeys)),
    );
    const toggle = () => {
        const model = grid.value?.model;
        if (!model) return;
        const next = selectAllToggled(
            model.state.rowSelection,
            model.state.selectedRowKeys,
            toValue(rowKeys),
        );
        if (next) model.run("selected-rows.set", { rowKeys: next });
    };
    return {
        get status() {
            return state.value.status;
        },
        get count() {
            return state.value.count;
        },
        get canToggle() {
            return state.value.canToggle;
        },
        toggle,
    };
}
