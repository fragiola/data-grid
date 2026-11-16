import { ariaEmptyRowIndex } from "@fragiola/data-grid";
import type * as React from "react";
import { cloneElement, createElement, type ReactNode, useContext } from "react";
import { TableContext, useRootGrid } from "../context";
import { useGridView } from "../hooks/use-grid-view";
import { inlineSide } from "../utils/inline-side";
import { layerRef } from "../utils/layer-ref";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "../utils/use-render";

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

/** The structural style of the empty state's row: a block the area's full height. */
const EMPTY_FILL = {
    display: "block",
    height: "100%",
    boxSizing: "border-box",
} as const;

/**
 * The empty state's cell: the area's full height; a table's cell a block too (in a block row), a
 * div's display left to the app (its content's layout: a flex column, a grid)
 */
const EMPTY_CELL = { height: "100%", boxSizing: "border-box" } as const;

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
    const columns = Math.max(1, view.columnCount);
    const rendered = useRenderElement(tableGrid ? "td" : "div", rest, {
        state: {},
        // mounted, its row counts in ARIA (`emptyShown`)
        ref: layerRef(engine, "empty"),
        children,
        props: {
            ...dataAttributes({ "grid-part": "empty" }),
            role: "gridcell",
            ...(columns > 1 ? { "aria-colspan": columns } : {}),
            style: EMPTY_CELL,
        },
    });
    if (view.rowCount !== 0) return null;
    // a table's cell (in a table grid, or a `<td>` from a `render` element or function) spans the
    // columns natively, in a table's row and row group; else divs with roles
    const table = tableGrid || rendered.type === "td";
    const cell = table
        ? cloneElement(rendered as React.ReactElement<EmptyCellProps>, {
              role: undefined,
              "aria-colspan": undefined,
              colSpan: columns,
              style: {
                  ...(rendered.props as EmptyCellProps).style,
                  ...EMPTY_FILL,
              },
          })
        : rendered;
    return createElement(
        table ? "tbody" : "div",
        {
            "data-grid-part": "empty-area",
            style: {
                position: "sticky",
                [inlineSide(view.direction)]: 0,
                display: "block",
                // under the columns in view (Epic #113): as wide as they are, at most the view;
                // no columns, the whole view
                width:
                    view.width > 0
                        ? Math.min(view.width, view.viewportWidth)
                        : view.viewportWidth,
                height: view.viewportBodyHeight,
                boxSizing: "border-box",
            },
        },
        createElement(
            table ? "tr" : "div",
            {
                "data-grid-part": "empty-row",
                ...(table ? {} : { role: "row" }),
                // the body's first line while it has no other (Epic #89, E5.2)
                "aria-rowindex": ariaEmptyRowIndex(view),
                style: EMPTY_FILL,
            },
            cell,
        ),
    );
}
