import {
    attachGridHandle,
    createGridHandle,
    type DataGridFeatures,
    type GridHandle,
} from "@fragiola/data-grid";
import { useState, useSyncExternalStore } from "react";
import type { DataGridContextValue } from "../context";

/**
 * A handle on a grid from outside its `DataGrid.Root`: `current` is the grid's model and engine
 * while a `Root` holds it (`<DataGrid.Root gridRef={gridRef}>`), `null` otherwise. Unlike a plain
 * ref it tells when that changes, so hooks take it (`useRowWindow(gridRef)`,
 * `useDataGrid(gridRef)`) and follow the grid from anywhere, re-rendering only their component.
 */
export type DataGridRef<
    TRow = unknown,
    TFeatures extends DataGridFeatures = DataGridFeatures,
> = GridHandle<DataGridContextValue<TRow, TFeatures>>;

const noop = () => {};

/** A subscription to nothing (no grid to follow yet): its unsubscription does nothing. */
export const noSubscription = () => noop;

/**
 * A handle on a grid, made outside a component (a module, a test, a store): the same as
 * `useDataGridRef()` returns. A `gridRef` must be made by one of the two. Its model's keys are
 * the core's and the features' it is typed with (`createDataGridRef<Person, typeof features>()`).
 */
export function createDataGridRef<
    TRow = unknown,
    TFeatures extends DataGridFeatures = [],
>(): DataGridRef<TRow, TFeatures> {
    return createGridHandle<DataGridContextValue<TRow, TFeatures>>();
}

/**
 * A handle on a grid, for `<DataGrid.Root gridRef>`: the same object for the component's life,
 * typed by the row and the features (`useDataGridRef<Person, typeof features>()`).
 */
export function useDataGridRef<
    TRow = unknown,
    TFeatures extends DataGridFeatures = [],
>(): DataGridRef<TRow, TFeatures> {
    const [gridRef] = useState(createDataGridRef<TRow, TFeatures>);
    return gridRef;
}

/**
 * Hands a `Root`'s grid to its `gridRef`; returns the release. A ref belongs to one mounted
 * `Root` at a time: a second one is told about in the console and does not take it, rather than
 * breaking the page for a mistake the types cannot see.
 */
export function attachGridRef<TRow>(
    gridRef: DataGridRef<TRow>,
    grid: DataGridContextValue<TRow>,
): () => void {
    return attachGridHandle(gridRef, grid);
}

const noGrid = () => null;

/** The grid a ref holds, following it as `Root`s take and release it (`null` without a ref). */
export function useGridRefCurrent<TRow>(
    gridRef: DataGridRef<TRow> | undefined,
): DataGridContextValue<TRow> | null {
    const read = gridRef ? () => gridRef.current : noGrid;
    return useSyncExternalStore(
        gridRef ? gridRef.subscribe : noSubscription,
        read,
        read,
    );
}
