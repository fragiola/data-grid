import type { AxisWindow } from "@fragiola/data-grid";
import { useWindow } from "./internal";
import type { DataGridRef } from "./use-data-grid-ref";

/**
 * The rows in view and rendered; re-renders when either range changes (e.g. to show them). With
 * a `gridRef`, from outside the `Root` too (the empty window until a `Root` takes the ref).
 */
export function useRowWindow<TRow>(gridRef?: DataGridRef<TRow>): AxisWindow {
    return useWindow("row-window", gridRef);
}
