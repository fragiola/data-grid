import type { RowState } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import { RowContext, type RowInfo } from "../context";
import { useRowPart } from "../hooks/internal";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";
import { Cells } from "./cells";

export type RowProps<TRow> = DivPrimitiveProps<RowState> & {
    row: RowInfo<TRow>;
    /** without children, `<DataGrid.Cells />` */
    children?: ReactNode;
};

/**
 * A body row (`role="row"`), positioned in the body layer. A `<tr>`. `data-loading` while its
 * row is not loaded, `data-active` while it holds the active cell.
 */
export function Row<TRow>(props: RowProps<TRow>) {
    const { row, children = <Cells />, ...rest } = props;
    const own = useRowPart(row);
    const element = useRenderElement("div", rest, {
        state: own.state,
        props: own.props,
        // a measured row's height is read by the engine (Epic #86)
        ref: own.ref,
        children,
    });
    return <RowContext value={row as RowInfo}>{element}</RowContext>;
}
