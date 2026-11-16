import { summaryHeight } from "@fragiola/data-grid";
import type { ReactNode } from "react";
import { useLayer } from "../hooks/internal";
import { useGridView } from "../hooks/use-grid-view";
import { LAYER_KEYS } from "../utils/drop-keys";
import { inlineSide } from "../utils/inline-side";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "../utils/use-render";
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
        props: {
            role: "rowgroup",
            ...dataAttributes({ "grid-part": "body" }),
            style: {
                position: "absolute",
                top: view.headerHeight + summaryHeight(view, "top"),
                [inlineSide(view.direction)]: 0,
                boxSizing: "border-box",
            },
        },
    });
}
