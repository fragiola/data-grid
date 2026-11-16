import {
    EMPTY_FILL,
    emptyAreaPropsOf,
    emptyCellPropsOf,
} from "@fragiola/data-grid";
import type * as React from "react";
import { cloneElement, createElement, type ReactNode, useContext } from "react";
import { TableContext, useRootGrid } from "../context";
import { useGridView } from "../hooks/use-grid-view";
import { layerRef } from "../utils/layer-ref";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export type EmptyProps = DivPrimitiveProps<Record<string, never>> & {
    children?: ReactNode;
};

/** The props the empty state's cell is given back as a table's `<td>`. */
interface EmptyCellProps {
    readonly role?: undefined;
    readonly "aria-colspan"?: undefined;
    readonly colSpan: number;
    readonly style?: React.CSSProperties;
}

/**
 * What the grid shows while it has no rows: its children, in a cell of its own (Epic #89, E5.2),
 * in a row of its own, in an area below the header as large as the visible body that stays in
 * view when the grid scrolls sideways. Nothing renders while there are rows; it has no text or
 * name of its own. `Empty` is the cell (`role="gridcell"`, spanning every column, as tall as the
 * area): your class, style and children go on it. Place it after the `Header`. As a table, render
 * it as a `<td>`: its row and area are then a `<tr>` and a `<tbody>`.
 */
export function Empty(props: EmptyProps) {
    const { children, ...rest } = props;
    const view = useGridView();
    const { engine } = useRootGrid();
    // in a table grid, a cell of a table (a `<td>` without `render`); a `<td>` rendered says so
    // in any grid
    const tableGrid = useContext(TableContext);
    const rendered = useRenderElement(tableGrid ? "td" : "div", rest, {
        state: {},
        // mounted, its row counts in ARIA (`emptyShown`)
        ref: layerRef(engine, "empty"),
        children,
        props: emptyCellPropsOf(view),
    });
    if (view.rowCount !== 0) return null;
    // a table's cell (in a table grid, or a `<td>` from a `render` element or function) spans the
    // columns natively, in a table's row and row group; else divs with roles
    const table = tableGrid || rendered.type === "td";
    const cell = table
        ? cloneElement(rendered as React.ReactElement<EmptyCellProps>, {
              role: undefined,
              "aria-colspan": undefined,
              colSpan: Math.max(1, view.columnCount),
              style: {
                  ...(rendered.props as EmptyCellProps).style,
                  ...EMPTY_FILL,
              },
          })
        : rendered;
    const { area, row } = emptyAreaPropsOf(view, table);
    return createElement(
        table ? "tbody" : "div",
        area,
        createElement(table ? "tr" : "div", row, cell),
    );
}
