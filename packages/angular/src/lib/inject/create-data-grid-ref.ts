import {
    attachGridHandle,
    createGridHandle,
    type DataGridFeatures,
} from "@fragiola/data-grid";
import type { DataGridContextValue, DataGridRef } from "../context";

/**
 * A handle on a grid, for `<div dataGridRoot [gridRef]="gridRef">`: a field of a component, a
 * module's constant, a test's. React's `useDataGridRef()` and `createDataGridRef()` are this one
 * function in Angular. Its model's keys are the core's and the features' it is typed with
 * (`createDataGridRef<Person, typeof features>()`).
 */
export function createDataGridRef<
    TRow = unknown,
    TFeatures extends DataGridFeatures = [],
>(): DataGridRef<TRow, TFeatures> {
    return createGridHandle<DataGridContextValue<TRow, TFeatures>>();
}

/** @internal Hands a root's grid to its `gridRef`; returns the release (one root at a time). */
export function attachGridRef<TRow>(
    gridRef: DataGridRef<TRow>,
    grid: DataGridContextValue<TRow>,
): () => void {
    return attachGridHandle(gridRef, grid, "[dataGridRoot] [gridRef]");
}
