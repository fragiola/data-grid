import { dataRowAt, depthOf, rowKeyOf, rowMetaAt } from "@fragiola/data-grid";
import { type RowInfo, useRootGrid } from "../context";

import { useGridView } from "./use-grid-view";

/** The rows a render shows, with their data, keys and kinds (Epic #87: a group row, a depth). */
export function useRows<TRow = unknown>(): RowInfo<TRow>[] {
    // outside a `Root`, the grid's own error first
    useRootGrid();
    const view = useGridView<TRow>();
    const { source } = view;
    return view.rows.map((rowIndex) => {
        // read once: its kind (a grid without them asks for none), its data row, and its key by
        // the core's one rule (the engine's measured keys share it)
        const meta = rowMetaAt(source, rowIndex);
        const row = dataRowAt(source, rowIndex, meta);
        const group = meta?.group;
        return {
            rowIndex,
            row,
            loaded: row !== undefined || group !== undefined,
            key: rowKeyOf(view, rowIndex, meta, row) ?? rowIndex,
            group,
            depth: depthOf(meta),
            meta,
        };
    });
}
