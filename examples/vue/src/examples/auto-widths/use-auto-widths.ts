import {
    type ColumnWidths,
    type DataGridRef,
    useDataGrid,
} from "@fragiola/data-grid-vue";
import { type ShallowRef, shallowRef, watchEffect } from "vue";

const NONE: ColumnWidths = {};

/** The widths the grid gives columns itself, through its ref: `engine.get("column-auto-widths")`. */
export function useAutoWidths<TRow>(
    gridRef: DataGridRef<TRow>,
): Readonly<ShallowRef<ColumnWidths>> {
    const grid = useDataGrid(gridRef);
    const widths = shallowRef<ColumnWidths>(NONE);
    // follows the root the ref holds: its widths now, then each change
    watchEffect((onCleanup) => {
        const engine = grid.value?.engine;
        widths.value = engine?.get("column-auto-widths") ?? NONE;
        if (!engine) return;
        onCleanup(
            engine.subscribe("column-auto-widths", () => {
                widths.value = engine.get("column-auto-widths") ?? NONE;
            }),
        );
    });
    return widths;
}
