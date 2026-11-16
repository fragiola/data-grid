import { bodyPropsOf, LAYER_KEYS } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import { useLayer } from "../hooks/internal";
import { useGridView } from "../hooks/use-grid-view";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";
import { Rows } from "./rows";

export type BodyProps = DivPrimitiveProps<Record<string, never>> & {
    children?: ReactNode;
};

/**
 * The body (`role="rowgroup"`), the layer the engine moves with the rows, below the header and the
 * top summary rows. A `<tbody>`.
 */
export function Body(props: BodyProps) {
    const { children = <Rows />, ...rest } = props;
    const view = useGridView();
    return useRenderElement("div", rest, {
        state: {},
        ref: useLayer("body"),
        drop: LAYER_KEYS,
        children,
        props: bodyPropsOf(view),
    });
}
