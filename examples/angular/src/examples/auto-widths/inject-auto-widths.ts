import { effect, type Signal, signal } from "@angular/core";
import {
    type ColumnWidths,
    type DataGridRef,
    injectDataGrid,
} from "@fragiola/data-grid-angular";

const NONE: ColumnWidths = {};

/** The widths the grid gives columns itself, through its ref: `engine.get("column-auto-widths")`. */
export function injectAutoWidths<TRow>(
    gridRef: DataGridRef<TRow>,
): Signal<ColumnWidths> {
    const grid = injectDataGrid(gridRef);
    const widths = signal<ColumnWidths>(NONE);
    // follows the root the ref holds: its widths now, then each change
    effect((onCleanup) => {
        const engine = grid()?.engine;
        widths.set(engine?.get("column-auto-widths") ?? NONE);
        if (!engine) return;
        onCleanup(
            engine.subscribe("column-auto-widths", () => {
                widths.set(engine.get("column-auto-widths") ?? NONE);
            }),
        );
    });
    return widths.asReadonly();
}
