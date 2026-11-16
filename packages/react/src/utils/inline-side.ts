import { type GridDirection, inlineStart } from "@fragiola/data-grid";

/**
 * The structural style key of an offset from a view's inline start (E1.1): `left`, or in a
 * right-to-left grid `right`; with `"margin"`, `marginLeft` or `marginRight`. Written straight
 * into the part's style object.
 */
export function inlineSide(direction: GridDirection): "left" | "right";
export function inlineSide(
    direction: GridDirection,
    prefix: "margin",
): "marginLeft" | "marginRight";
export function inlineSide(
    direction: GridDirection,
    prefix?: "margin",
): "left" | "right" | "marginLeft" | "marginRight" {
    const side = inlineStart(direction);
    if (!prefix) return side;
    return side === "left" ? "marginLeft" : "marginRight";
}
