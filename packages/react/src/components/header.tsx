import { headerPropsOf } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import { useGridView } from "../hooks/use-grid-view";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";
import { HeaderRows } from "./header-rows";

export type HeaderProps = DivPrimitiveProps<Record<string, never>> & {
    children?: ReactNode;
};

/**
 * The header (`role="rowgroup"`): sticky at the viewport's top, as tall as its header rows, above
 * the rows scrolling under it and the summary rows (a structural `z-index`). A `<thead>` through
 * `render`. Nothing renders without a header. Its background is the consumer's: give it one so
 * the rows are hidden under it. Without children, a header row per level
 * (`DataGrid.HeaderRows`).
 */
export function Header(props: HeaderProps) {
    const { children = <HeaderRows />, ...rest } = props;
    const view = useGridView();
    const element = useRenderElement("div", rest, {
        state: {},
        children,
        props: headerPropsOf(view),
    });
    return view.headerRowCount > 0 ? element : null;
}
