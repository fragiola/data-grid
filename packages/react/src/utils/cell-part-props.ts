import {
    type CellPart,
    cellBox,
    type GridView,
    type SummaryCellPart,
} from "@fragiola/data-grid";
import type { ReactNode } from "react";

import type { PartHookResult } from "../hooks/internal";
import { cellProps } from "./cell-props";

/**
 * A body or summary row cell's part as a hook returns it, with its span: its state, its props
 * (`cellProps`) on its box in its row, `height` tall (default: its row's own height), or in a
 * `measured` row as tall as its row's tallest cell.
 */
export function cellPartProps<TRow, P extends CellPart | SummaryCellPart>(
    view: GridView<TRow, ReactNode>,
    part: P,
    cell: { readonly rowIndex: number; readonly columnIndex: number },
    height?: number,
    measured = false,
): PartHookResult<P["state"]> & { columnSpan: number; measured: boolean } {
    const columnSpan = part.ariaColSpan ?? 1;
    return {
        state: part.state,
        props: cellProps(
            view,
            part,
            cellBox(view, cell.rowIndex, cell.columnIndex, columnSpan, height),
            measured,
        ),
        columnSpan,
        measured,
    };
}
