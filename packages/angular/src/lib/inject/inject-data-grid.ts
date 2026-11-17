import type { Signal } from "@angular/core";
import type { DataGridFeatures, GridView } from "@fragiola/data-grid";
import type { DataGridContextValue, DataGridRef } from "../context";
import type { DataGridNode } from "../utils/content";
import { gridRefCurrent, injectRootGrid } from "./internal";

const OUTSIDE_ROOT = "injectDataGrid() must be used inside [dataGridRoot]";

/**
 * The grid's model and engine, typed by the row type and the features the app passes
 * (`injectDataGrid<Person, typeof features>()`: a feature's keys compile only when it is listed;
 * an injection cannot carry a generic: the root that provides it was given them). Call it in an
 * injection context (a constructor, a field); the model and the engine are read when used (the
 * root makes them from its inputs).
 *
 * With a `gridRef`, it works outside the root too: a signal of the grid that ref's root holds, or
 * `null` until one does; typed as the ref is.
 */
export function injectDataGrid<
    TRow = unknown,
    TFeatures extends DataGridFeatures = [],
>(): DataGridContextValue<TRow, TFeatures>;
export function injectDataGrid<
    TRow,
    TFeatures extends DataGridFeatures = DataGridFeatures,
>(
    gridRef: DataGridRef<TRow, TFeatures>,
): Signal<DataGridContextValue<TRow, TFeatures> | null>;
export function injectDataGrid<TRow>(
    gridRef?: DataGridRef<TRow>,
): DataGridContextValue<TRow> | Signal<DataGridContextValue<TRow> | null> {
    if (gridRef) return gridRefCurrent(gridRef);
    const grid = injectRootGrid(OUTSIDE_ROOT);
    // the root that provides it was given the row type the caller states
    return {
        get model() {
            return grid.model;
        },
        get engine() {
            return grid.engine;
        },
    } as unknown as DataGridContextValue<TRow>;
}

/** The view of the root around, typed by the row type the caller states. */
export function injectGridView<TRow = unknown>(): Signal<
    GridView<TRow, DataGridNode>
> {
    const grid = injectRootGrid(
        "injectGridView() must be used inside [dataGridRoot]",
    );
    // the root that provides it was given the row type
    return grid.view as unknown as Signal<GridView<TRow, DataGridNode>>;
}
