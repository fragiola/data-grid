import { isValidElement } from "react";

/**
 * A cell's props with its table spans: a `render` element that is a `th` or a `td` takes `colSpan`
 * and `rowSpan`, each only over 1 (a render function finds them in its props' `aria-colspan` and
 * `aria-rowspan`, a header cell's in its state too). The same props without.
 */
export function withTableSpans(
    props: Record<string, unknown>,
    render: unknown,
    colSpan: number,
    rowSpan = 1,
): Record<string, unknown> {
    if (
        (colSpan <= 1 && rowSpan <= 1) ||
        !isValidElement(render) ||
        (render.type !== "th" && render.type !== "td")
    ) {
        return props;
    }
    return {
        ...props,
        ...(colSpan > 1 ? { colSpan } : {}),
        ...(rowSpan > 1 ? { rowSpan } : {}),
    };
}
