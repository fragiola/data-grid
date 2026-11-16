import { attachGridHandle, createGridHandle } from "@fragiola/data-grid";
import type { DataGridContextValue, DataGridRef } from "../context";

/**
 * A handle on a grid, made outside a component (a module, a test, a store): the same as
 * `useDataGridRef()` returns. A `gridRef` must be made by one of the two.
 */
export function createDataGridRef<TRow = unknown>(): DataGridRef<TRow> {
    return createGridHandle<DataGridContextValue<TRow>>();
}

/**
 * A handle on a grid, for `<DataGrid.Root :grid-ref="gridRef">`: call it in `setup`, it is the
 * same object for the component's life.
 */
export function useDataGridRef<TRow = unknown>(): DataGridRef<TRow> {
    return createDataGridRef<TRow>();
}

/** Hands a `Root`'s grid to its `gridRef`; returns the release (one mounted root at a time). */
export function attachGridRef<TRow>(
    gridRef: DataGridRef<TRow>,
    grid: DataGridContextValue<TRow>,
): () => void {
    return attachGridHandle(gridRef, grid, "<DataGrid.Root :grid-ref>");
}
