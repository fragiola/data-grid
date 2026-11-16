import type { ReactNode } from "react";
import { useGridView } from "../hooks/use-grid-view";
import { HEADER_LAYER } from "../utils/sticky-layers";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "../utils/use-render";
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
        props: {
            role: "rowgroup",
            ...dataAttributes({ "grid-part": "header" }),
            style: {
                position: "sticky",
                top: 0,
                // above the rows scrolling under it and the summary rows (Epic #89, E5.2); its
                // background is the app's
                zIndex: HEADER_LAYER,
                display: "block",
                height: view.headerHeight,
                boxSizing: "border-box",
            },
        },
    });
    return view.headerRowCount > 0 ? element : null;
}
