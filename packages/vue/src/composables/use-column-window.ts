import type { AxisWindow } from "@fragiola/data-grid";
import type { ShallowRef } from "vue";
import type { DataGridRef } from "../context";
import { useWindow } from "./internal";

/** The columns in view and rendered, as a ref following either range. Takes a `gridRef` too. */
export function useColumnWindow<TRow>(
    gridRef?: DataGridRef<TRow>,
): Readonly<ShallowRef<AxisWindow>> {
    return useWindow("column-window", gridRef);
}
