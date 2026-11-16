import { ariaRowCount, gridRole, summaryHeight } from "@fragiola/data-grid";
import { isValidElement, type ReactNode, useLayoutEffect } from "react";
import { TableContext, useRootGrid } from "../context";
import { useGridView } from "../hooks/use-grid-view";
import { layerRef } from "../utils/layer-ref";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "../utils/use-render";

/** The grid's state. */
export interface GridState {
    readonly rowCount: number;
    readonly columnCount: number;
}

export type GridProps = DivPrimitiveProps<GridState> & { children?: ReactNode };

/**
 * The grid (`role="grid"`; `treegrid` when its rows have kinds, Epic #87: `getRowMeta` on the
 * root) and the sizer: as large as the whole dataset (the physical size, under scroll scaling), so
 * the scrollbars represent it. A `<table>` through `render`. It is the grid's tab stop while no
 * cell is active.
 */
export function Grid(props: GridProps) {
    const { children, ...rest } = props;
    const { engine } = useRootGrid();
    const view = useGridView();
    // the view is on screen: the engine writes the layers' offsets for it and moves focus
    useLayoutEffect(() => {
        engine.adapter.commit(view);
    }, [engine, view]);
    const empty = view.rowCount === 0;
    // without rows, and with expanded rows (a detail is as wide as the view), the sizer spans at
    // least the visible area: it clips what it holds
    const wide = empty || view.expandedRows.length > 0;
    // a `<table>`: what it holds takes a table's structure (`Empty`)
    const table = isValidElement(rest.render) && rest.render.type === "table";
    return useRenderElement("div", rest, {
        state: { rowCount: view.rowCount, columnCount: view.columnCount },
        ref: layerRef(engine, "grid"),
        children: table ? (
            <TableContext value={true}>{children}</TableContext>
        ) : (
            children
        ),
        props: {
            role: gridRole(view),
            "aria-rowcount": ariaRowCount(view),
            "aria-colcount": view.columnCount,
            // many rows selectable (R7), or ranges of cells (Epic #88)
            ...(view.rowSelection === "multiple" || view.cellSelection
                ? { "aria-multiselectable": true }
                : {}),
            // the grid's tab stop until a cell is active (roving: then that cell is)
            // (a nested grid's only while its holder's active cell holds it: Epic #89, E5.2)
            tabIndex: view.active || !view.tabbable ? -1 : 0,
            ...dataAttributes({ "grid-part": "grid", empty }),
            style: {
                position: "relative",
                display: "block",
                // without rows, the sizer still spans the visible area: the empty state has room
                width: wide
                    ? Math.max(view.width, view.viewportWidth)
                    : view.width,
                height:
                    view.headerHeight +
                    summaryHeight(view, "top") +
                    summaryHeight(view, "bottom") +
                    (empty
                        ? Math.max(view.height, view.viewportBodyHeight)
                        : view.height),
                // clips the rendered rows to the sizer without being a scroll container (sticky
                // headers stick to the viewport)
                overflow: "clip",
                boxSizing: "border-box",
            },
        },
    });
}
