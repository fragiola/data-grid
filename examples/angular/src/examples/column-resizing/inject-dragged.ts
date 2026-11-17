import { effect, type Signal, signal } from "@angular/core";
import {
    type ColumnResize,
    type DataGridRef,
    injectDataGrid,
} from "@fragiola/data-grid-angular";

/** The column a person is dragging, through the grid's ref: `engine.get("column-resize")`. */
export function injectDragged<TRow>(
    gridRef: DataGridRef<TRow>,
): Signal<ColumnResize | null> {
    const grid = injectDataGrid(gridRef);
    const dragged = signal<ColumnResize | null>(null);
    // follows the root the ref holds: the drag now, then each change
    effect((onCleanup) => {
        const engine = grid()?.engine;
        dragged.set(engine?.get("column-resize") ?? null);
        if (!engine) return;
        onCleanup(
            engine.subscribe("column-resize", () => {
                dragged.set(engine.get("column-resize") ?? null);
            }),
        );
    });
    return dragged.asReadonly();
}
