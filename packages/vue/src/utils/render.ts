// From Dockable (fragiola/dockable, packages/vue/src/utils/render.ts), same author and licence.
import type { PartStyle } from "@fragiola/data-grid";
import {
    type Component,
    camelize,
    type FunctionalComponent,
    h,
    mergeProps,
    normalizeStyle,
    type Slot,
    type VNode,
    type VNodeChild,
} from "vue";

/** The element behind a template ref: the element itself, or a component's root element. */
export function toElement(value: unknown): HTMLElement | null {
    if (value === null || typeof value !== "object") {
        return null;
    }
    if ((value as { nodeType?: unknown }).nodeType === 1) {
        return value as HTMLElement;
    }
    const root = (value as { $el?: unknown }).$el;
    return root !== null &&
        typeof root === "object" &&
        (root as { nodeType?: unknown }).nodeType === 1
        ? (root as HTMLElement)
        : null;
}

/** A function template ref, as a primitive puts it on its element. */
export type ElementRef = (value: unknown) => void;

/**
 * A function template ref that calls `attach` with the element once it is mounted, and the
 * cleanup it returns when the element goes away or is replaced. Vue calls a function ref on every
 * patch; only a change reaches `attach`.
 */
export function elementRef(
    attach: (element: HTMLElement) => (() => void) | undefined,
): ElementRef {
    let current: HTMLElement | null = null;
    let cleanup: (() => void) | undefined;
    return (value: unknown) => {
        const element = toElement(value);
        if (element === current) return;
        cleanup?.();
        cleanup = undefined;
        current = element;
        if (element) cleanup = attach(element) ?? undefined;
    };
}

/** The style keys whose numbers take no unit (the structural style's stacking and flex). */
const UNITLESS: ReadonlySet<string> = new Set([
    "zIndex",
    "flexShrink",
    "flexGrow",
    "order",
    "opacity",
]);

/**
 * A structural style (the core's, lengths in pixels as numbers) as Vue renders it: Vue, unlike
 * React, adds no unit to a number, so a length gets `px`.
 */
export function cssStyle(style: PartStyle | undefined): Record<string, string> {
    const css: Record<string, string> = {};
    if (!style) return css;
    for (const [key, value] of Object.entries(style)) {
        if (value === undefined) continue;
        css[key] =
            typeof value === "number" && !UNITLESS.has(key)
                ? `${value}px`
                : String(value);
    }
    return css;
}

/**
 * A consumer's `style` (an object, an array or a CSS string) as one object with camelCase keys
 * (custom properties kept), so the structural keys can win over it.
 */
export function styleObject(style: unknown): Record<string, unknown> {
    const normalized = normalizeStyle(style);
    const result: Record<string, unknown> = {};
    if (typeof normalized === "string") {
        for (const declaration of normalized.split(/;(?![^(]*\))/g)) {
            const index = declaration.indexOf(":");
            if (index > 0) {
                const name = declaration.slice(0, index).trim();
                result[name.startsWith("--") ? name : camelize(name)] =
                    declaration.slice(index + 1).trim();
            }
        }
    } else if (normalized) {
        for (const [name, value] of Object.entries(normalized)) {
            result[name.startsWith("--") ? name : camelize(name)] = value;
        }
    }
    return result;
}

/** A component (or a tag) a primitive renders instead of its own element: the `as` prop. */
export type AsProp = string | Component;

/** What a primitive's `render` scoped slot receives. */
export interface RenderSlotProps<State> {
    /**
     * what goes on your element (`v-bind="props"`): the primitive's ARIA, `data-*`, listeners, its
     * structural style merged over your `class`/`style`, and its template ref
     */
    props: Record<string, unknown>;
    /** the primitive's state */
    state: State;
    /**
     * the primitive's content, as a node of one stable component (`<component :is="children" />`,
     * or `h(children)`): its type never changes between renders, so the content never remounts
     */
    children: VNode;
}

/** Renders a primitive's content inside its `render` slot: one component type for every render. */
const PrimitiveChildren: FunctionalComponent<{
    content?: (() => VNodeChild) | undefined;
}> = (props) => props.content?.();
PrimitiveChildren.props = ["content"];

/** The slots every primitive accepts: `render` replaces its element. */
export interface RenderSlot<State> {
    /** replaces the rendered element (never `asChild`): bind `props` on your own element */
    render?: (scope: RenderSlotProps<State>) => VNode[];
}

interface RenderOptions<State> {
    /** the element rendered by default */
    tag: string;
    /** the consumer's `as` prop */
    as?: AsProp | undefined;
    /** the consumer's fallthrough attributes: `class`, `style`, listeners, ARIA, … */
    attrs: Record<string, unknown>;
    /** the consumer's `render` slot */
    render?: Slot | undefined;
    state: State;
    /**
     * the primitive's own props: ARIA, `data-*`, listeners, and its structural style (`style`,
     * the core's), which always wins over the consumer's
     */
    props: Record<string, unknown> & { style?: PartStyle | undefined };
    /** the primitive's template ref */
    ref?: ElementRef | undefined;
    /**
     * style keys left out of the consumer's style: the keys the engine writes itself (a layer's
     * `transform`, a pinned cell's `left`), or that would move the element from its place
     */
    drop?: readonly string[] | undefined;
    /**
     * listeners that run last, after the consumer's (the grid's keys and clicks, which a
     * `preventDefault` before them cancels)
     */
    after?: Record<string, unknown> | undefined;
    /** the primitive's content */
    children?: (() => VNodeChild) | undefined;
}

/**
 * Renders a primitive's element: merges the consumer's attributes over the primitive's
 * (listeners composed, internal first; classes joined; structural style keys win), puts the
 * primitive's template ref on it, and applies `as` or the `render` slot.
 */
export function renderElement<State>(
    options: RenderOptions<State>,
): VNodeChild {
    const { attrs, state, children } = options;
    const { style: structural, ...own } = options.props;
    const { style: consumerStyle, ...external } = attrs;
    let merged = mergeProps(own, external);
    const consumer = styleObject(consumerStyle);
    for (const key of options.drop ?? []) {
        delete consumer[key];
    }
    // structural keys win
    const style = { ...consumer, ...cssStyle(structural) };
    for (const [key, value] of Object.entries(style)) {
        if (value === undefined || value === null) delete style[key];
    }
    if (Object.keys(style).length > 0) {
        merged.style = style;
    }
    if (options.after) merged = mergeProps(merged, options.after);
    if (options.ref) merged.ref = options.ref;
    if (options.render) {
        return options.render({
            props: merged,
            state,
            children: h(PrimitiveChildren, { content: children }),
        } satisfies RenderSlotProps<State>);
    }
    const as = options.as ?? options.tag;
    if (typeof as === "string") {
        return h(as, merged, children ? [children()] : undefined);
    }
    return h(as, merged, children ? { default: children } : undefined);
}

/** Whether a primitive renders a table's cell (`as="td"`/`"th"`): it then takes the spans. */
export function tableCellTag(as: AsProp | undefined): boolean {
    return as === "td" || as === "th";
}

/** A cell's props with its table spans when it renders a `th` or a `td` (each only over 1). */
export function withTableSpans(
    props: Record<string, unknown> & { style?: PartStyle | undefined },
    as: AsProp | undefined,
    colSpan: number,
    rowSpan = 1,
): Record<string, unknown> & { style?: PartStyle | undefined } {
    if ((colSpan <= 1 && rowSpan <= 1) || !tableCellTag(as)) return props;
    return {
        ...props,
        ...(colSpan > 1 ? { colSpan } : {}),
        ...(rowSpan > 1 ? { rowSpan } : {}),
    };
}

/** A part's props (the core's) as a composable hands them out: the style ready for Vue. */
export function vueProps(
    props: Record<string, unknown> & { style?: PartStyle | undefined },
): Record<string, unknown> {
    return { ...props, style: cssStyle(props.style) };
}
