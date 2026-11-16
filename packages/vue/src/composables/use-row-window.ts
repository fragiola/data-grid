import type { AxisWindow } from "@fragiola/data-grid";
import type { ShallowRef } from "vue";
import type { DataGridRef } from "../context";
import { useWindow } from "./internal";

/**
 * The rows in view and rendered, as a ref following either range (e.g. to show them). With a
 * `gridRef`, from outside the `Root` too (the empty window until a `Root` takes the ref).
 */
export function useRowWindow<TRow>(
    gridRef?: DataGridRef<TRow>,
): Readonly<ShallowRef<AxisWindow>> {
    return useWindow("row-window", gridRef);
}
