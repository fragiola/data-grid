import { type DataGridRef, useDataGrid } from "@fragiola/data-grid-vue";
import { shallowRef, watchEffect } from "vue";

/** The column a person is dragging, through the grid's ref: `engine.get("column-resize")`. */
export function useDragged<TRow>(gridRef: DataGridRef<TRow>) {
    const grid = useDataGrid(gridRef);
    const read = () => grid.value?.engine.get("column-resize") ?? null;
    const dragged = shallowRef(read());
    // follows the root the ref holds: the drag now, then each change
    watchEffect((onCleanup) => {
        const engine = grid.value?.engine;
        dragged.value = read();
        if (!engine) return;
        onCleanup(
            engine.subscribe("column-resize", () => {
                dragged.value = read();
            }),
        );
    });
    return dragged;
}
