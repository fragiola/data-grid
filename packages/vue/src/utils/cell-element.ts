import { type PartProps, PINNED_KEYS } from "@fragiola/data-grid";
import type { Slot, VNodeChild } from "vue";
import {
    type AsProp,
    type ElementRef,
    renderElement,
    withTableSpans,
} from "./render";

/**
 * A cell's element (a header cell's, a body or summary row cell's): its part's props with its
 * table spans, its content, and, pinned, the engine's inset (sticky, it stays in view sideways):
 * its `pinned` layer ref, and the insets a consumer's style may not set (in a measured row too).
 */
export function renderCellElement<
    State extends { readonly pinned: boolean },
>(options: {
    readonly as: AsProp | undefined;
    readonly attrs: Record<string, unknown>;
    readonly render: Slot | undefined;
    readonly own: { readonly state: State; readonly props: PartProps };
    readonly pinnedRef: ElementRef;
    readonly content: () => VNodeChild;
    readonly columnSpan: number;
    /** in a measured row (Epic #86): placed by the grid, its insets dropped as a pinned cell's */
    readonly measured: boolean;
    readonly rowSpan?: number | undefined;
}): VNodeChild {
    const { own, as } = options;
    const { pinned } = own.state;
    return renderElement({
        tag: "div",
        as,
        attrs: options.attrs,
        render: options.render,
        state: own.state,
        props: withTableSpans(
            own.props,
            as,
            options.columnSpan,
            options.rowSpan,
        ),
        ref: pinned ? options.pinnedRef : undefined,
        drop: pinned || options.measured ? PINNED_KEYS : undefined,
        children: options.content,
    });
}
