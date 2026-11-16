import {
    type GridView,
    renderedWidth,
    rowDisplay,
    rowLeft,
} from "@fragiola/data-grid";
import type * as React from "react";
import type { ReactNode } from "react";

import { inlineSide } from "./inline-side";

/**
 * A row's structural style (a header row's too, at `top`): in its layer, from `rowLeft`, as wide
 * as its rendered cells (an expanded row, as what holds its detail); with pinned columns, a flex
 * container their sticky cells stack in. A `measured` body row (Epic #86) has no height: a grid
 * whose one area its cells share, as tall as the tallest, its detail in the area below.
 */
export function rowStyle<TRow>(
    view: GridView<TRow, ReactNode>,
    top: number,
    height: number,
    width: number = renderedWidth(view),
    measured = false,
): React.CSSProperties {
    const display = measured ? "grid" : rowDisplay(view);
    return {
        position: "absolute",
        ...(display ? { display } : {}),
        top,
        [inlineSide(view.direction)]: rowLeft(view),
        width,
        ...(measured ? {} : { height }),
        boxSizing: "border-box",
    };
}
