import type { Signal } from "@angular/core";
import type { AxisWindow } from "@fragiola/data-grid";
import type { DataGridRef } from "../context";
import { injectWindow } from "./internal";

/** The columns in view and rendered, as a signal following either range. Takes a `gridRef` too. */
export function injectColumnWindow<TRow>(
    gridRef?: DataGridRef<TRow>,
): Signal<AxisWindow> {
    return injectWindow("column-window", gridRef);
}
