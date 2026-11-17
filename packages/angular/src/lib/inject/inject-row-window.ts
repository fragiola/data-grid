import type { Signal } from "@angular/core";
import type { AxisWindow } from "@fragiola/data-grid";
import type { DataGridRef } from "../context";
import { injectWindow } from "./internal";

/**
 * The rows in view and rendered, as a signal following either range. With a `gridRef`, from
 * outside the root too (the empty window until a root takes the ref).
 */
export function injectRowWindow<TRow>(
    gridRef?: DataGridRef<TRow>,
): Signal<AxisWindow> {
    return injectWindow("row-window", gridRef);
}
