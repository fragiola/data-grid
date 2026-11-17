import { type GridState, gridPartOf } from "@fragiola/data-grid";
import { isValidElement, type ReactNode, useLayoutEffect } from "react";
import { TableContext, useRootGrid } from "../context";
import { useGridView } from "../hooks/use-grid-view";
import { layerRef } from "../utils/layer-ref";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export type { GridState } from "@fragiola/data-grid";

export type GridProps = DivPrimitiveProps<GridState> & { children?: ReactNode };

/**
 * The grid (`role="grid"` with `navigation()` installed, `treegrid` when its rows have kinds,
 * Epic #87: `getRowMeta` on the root; `role="table"` without navigation) and the sizer: as large
 * as the whole dataset (the physical size, under scroll scaling), so the scrollbars represent it.
 * A `<table>` through `render`. With navigation, it is the grid's tab stop while no cell is
 * active; without it, neither it nor a cell is a tab stop.
 */
export function Grid(props: GridProps) {
    const { children, ...rest } = props;
    const { engine } = useRootGrid();
    const view = useGridView();
    // the view is on screen: the engine writes the layers' offsets for it and moves focus
    useLayoutEffect(() => {
        engine.adapter.commit(view);
    }, [engine, view]);
    // a `<table>`: what it holds takes a table's structure (`Empty`)
    const table = isValidElement(rest.render) && rest.render.type === "table";
    return useRenderElement("div", rest, {
        ...gridPartOf(view),
        ref: layerRef(engine, "grid"),
        children: table ? (
            <TableContext value={true}>{children}</TableContext>
        ) : (
            children
        ),
    });
}
