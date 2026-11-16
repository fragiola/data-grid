import {
    type HeaderRowState,
    headerRowPartOf,
    LAYER_KEYS,
} from "@fragiola/data-grid";
import type { ReactNode } from "react";
import { HeaderRowContext, type HeaderRowInfo } from "../context";
import { useHeaderRowOf, useLayer } from "../hooks/internal";
import { useGridView } from "../hooks/use-grid-view";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";
import { HeaderCells } from "./header-cells";

export type { HeaderRowState } from "@fragiola/data-grid";

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
        ...headerRowPartOf(view, rowIndex),
        ref: useLayer("header"),
        drop: LAYER_KEYS,
        children: (
            <HeaderRowContext
                value={(row as HeaderRowInfo | undefined) ?? null}
            >
                {children}
            </HeaderRowContext>
        ),
    });
}
