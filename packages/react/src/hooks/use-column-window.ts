import type { AxisWindow } from "@fragiola/data-grid";
import { useWindow } from "./internal";
import type { DataGridRef } from "./use-data-grid-ref";

/** The columns in view and rendered; re-renders when either range changes. Takes a `gridRef` too. */
export function useColumnWindow<TRow>(gridRef?: DataGridRef<TRow>): AxisWindow {
    return useWindow("column-window", gridRef);
}
