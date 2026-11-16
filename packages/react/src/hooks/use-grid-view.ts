import type { GridView } from "@fragiola/data-grid";
import { type ReactNode, useContext } from "react";
import { ViewContext } from "../context";

/** The view the engine reports: what to render. A component re-renders only when it changes. */
export function useGridView<TRow = unknown>(): GridView<TRow, ReactNode> {
    const view = useContext(ViewContext);
    if (!view) {
        throw new Error("useGridView() must be used inside <DataGrid.Root>");
    }
    // the root that provides it was given the row type
    return view as GridView<TRow, ReactNode>;
}
