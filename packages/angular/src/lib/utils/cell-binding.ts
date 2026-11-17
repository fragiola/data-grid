import { type PartProps, PINNED_KEYS } from "@fragiola/data-grid";
import type { PartBinding } from "./helpers";

/** Whether an element is a table's cell (`<td>`, `<th>`): it then takes the spans. */
export function isTableCell(element: Element): boolean {
    return element.tagName === "TD" || element.tagName === "TH";
}

/** A cell's props with its table spans when its element is a `<td>` or a `<th>` (each over 1). */
export function withTableSpans(
    element: Element,
    props: PartProps,
    colSpan: number,
    rowSpan = 1,
): PartProps {
    if ((colSpan <= 1 && rowSpan <= 1) || !isTableCell(element)) return props;
    return {
        ...props,
        ...(colSpan > 1 ? { colSpan } : {}),
        ...(rowSpan > 1 ? { rowSpan } : {}),
    };
}

/**
 * A cell's binding (a header cell's, a body or summary row cell's): its part's props with its
 * table spans and, pinned, the engine's inset (sticky, it stays in view sideways): its `pinned`
 * layer, and the insets a consumer's style may not set (in a measured row too).
 */
export function cellBinding(
    element: Element,
    own: {
        readonly state: { readonly pinned: boolean };
        readonly props: PartProps;
    },
    columnSpan: number,
    measured: boolean,
    rowSpan?: number,
): PartBinding {
    const { pinned } = own.state;
    return {
        props: withTableSpans(element, own.props, columnSpan, rowSpan),
        layer: pinned ? "pinned" : null,
        drop: pinned || measured ? PINNED_KEYS : undefined,
    };
}
