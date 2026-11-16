import { ariaRowIndex } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import { HeaderRowContext, type HeaderRowInfo } from "../context";
import { useHeaderRowOf, useLayer } from "../hooks/internal";
import { useGridView } from "../hooks/use-grid-view";
import { LAYER_KEYS } from "../utils/drop-keys";
import { rowStyle } from "../utils/row-style";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "../utils/use-render";
import { HeaderCells } from "./header-cells";

/** The state of a header row. */
export interface HeaderRowState {
    /** -1 for the columns' row, above it for groups */
    readonly rowIndex: number;
}

export type HeaderRowProps<TRow = unknown> =
    DivPrimitiveProps<HeaderRowState> & {
        /**
         * its header row; without it, the one `HeaderRows` renders, else the columns' row (with
         * column groups, render the rows through `HeaderRows`: a column spanning header rows is
         * in the top one)
         */
        row?: HeaderRowInfo<TRow> | undefined;
        children?: ReactNode;
    };

/**
 * A header row (`role="row"`), one of the layers the engine moves with the columns. A `<tr>`.
 * Without children, its header cells.
 */
export function HeaderRow<TRow = unknown>(props: HeaderRowProps<TRow>) {
    const { row: given, children = <HeaderCells />, ...rest } = props;
    const view = useGridView<TRow>();
    const row = useHeaderRowOf(given);
    const rowIndex = row?.rowIndex ?? -1;
    return useRenderElement("div", rest, {
        state: { rowIndex },
        ref: useLayer("header"),
        drop: LAYER_KEYS,
        children: (
            <HeaderRowContext
                value={(row as HeaderRowInfo | undefined) ?? null}
            >
                {children}
            </HeaderRowContext>
        ),
        props: {
            role: "row",
            "aria-rowindex": ariaRowIndex(view, rowIndex),
            ...dataAttributes({ "grid-part": "header-row" }),
            style: {
                ...rowStyle(
                    view,
                    (rowIndex + view.headerRowCount) * view.headerRowHeight,
                    view.headerRowHeight,
                ),
                // with several rows, an upper one stays above the next: a cell spanning down
                // from it is not covered by the row it reaches into
                ...(view.headerRowCount > 1 ? { zIndex: -rowIndex } : {}),
            },
        },
    });
}
