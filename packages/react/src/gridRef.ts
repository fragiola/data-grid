import { useState, useSyncExternalStore } from "react";
import type { DataGridContextValue } from "./context";

/**
 * A handle on a grid from outside its `DataGrid.Root`: `current` is the grid's model and engine
 * while a `Root` holds it (`<DataGrid.Root gridRef={gridRef}>`), `null` otherwise. Unlike a plain
 * ref it tells when that changes, so hooks take it (`useRowWindow(gridRef)`,
 * `useDataGrid(gridRef)`) and follow the grid from anywhere, re-rendering only their component.
 */
export interface DataGridRef<TRow = unknown> {
    readonly current: DataGridContextValue<TRow> | null;
    /** listens to a `Root` taking or releasing it; returns the unsubscription */
    subscribe(listener: () => void): () => void;
}

/** What sets a ref's `current`: kept off the ref, so only a `Root` writes it. */
const writers = new WeakMap<object, (value: object | null) => void>();

function createDataGridRef<TRow>(): DataGridRef<TRow> {
    let current: DataGridContextValue<TRow> | null = null;
    const listeners = new Set<() => void>();
    const gridRef: DataGridRef<TRow> = {
        get current() {
            return current;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
    writers.set(gridRef, (value) => {
        // written only by `attachGridRef`, with the grid of the `Root` given this ref's row type
        current = value as DataGridContextValue<TRow> | null;
        for (const listener of [...listeners]) listener();
    });
    return gridRef;
}

/** A handle on a grid, for `<DataGrid.Root gridRef>`: the same object for the component's life. */
export function useDataGridRef<TRow = unknown>(): DataGridRef<TRow> {
    const [gridRef] = useState(createDataGridRef<TRow>);
    return gridRef;
}

/**
 * Hands a `Root`'s grid to its `gridRef`; returns the release. A ref belongs to one mounted
 * `Root` at a time.
 */
export function attachGridRef<TRow>(
    gridRef: DataGridRef<TRow>,
    grid: DataGridContextValue<TRow>,
): () => void {
    const write = writers.get(gridRef);
    if (!write) {
        throw new Error("gridRef must come from useDataGridRef()");
    }
    if (gridRef.current && gridRef.current !== grid) {
        throw new Error(
            "this gridRef is already held by another mounted <DataGrid.Root>",
        );
    }
    write(grid);
    return () => {
        if (gridRef.current === grid) write(null);
    };
}

const noSubscription = () => () => {};
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
