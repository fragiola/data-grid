// From Dockable (fragiola/dockable, packages/react/src/utils), same author and licence.
import * as React from "react";
import { mergeProps, mergeRefs } from "./mergeProps";

/**
 * Props a `render` function receives: spread them onto the element it returns. `ref` is a callback
 * ref, so it fits any element's `ref` (`render={(props) => <section {...props} />}` needs no cast).
 */
export type RenderedProps<E extends Element = HTMLElement> =
    React.HTMLAttributes<E> & {
        ref: React.RefCallback<E>;
        [dataAttribute: `data-${string}`]: string | undefined;
    };

/**
 * Replaces the element a primitive renders, Base UI style: either an element whose props are
 * merged with the primitive's (`render={<section />}`), or a function receiving the props and
 * the primitive's state (`render={(props, state) => <section {...props} />}`).
 */
export type RenderProp<State, E extends Element = HTMLElement> =
    | React.ReactElement
    | ((props: RenderedProps<E>, state: State) => React.ReactElement);

/** The props every primitive accepts on top of the element's own. */
export interface PrimitiveProps<State> {
    /** replaces the rendered element (never `asChild`) */
    render?: RenderProp<State> | undefined;
    /** a class name, or a function of the primitive's state returning one */
    className?: string | ((state: State) => string | undefined) | undefined;
    /**
     * a style, or a function of the primitive's state returning one. Structural keys the
     * primitive sets (position, geometry, display, flex sizing) always win.
     */
    style?:
        | React.CSSProperties
        | ((state: State) => React.CSSProperties | undefined)
        | undefined;
    ref?: React.Ref<HTMLElement> | undefined;
}

type DivProps = Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "className" | "style" | "children"
>;

/** The props of a primitive that renders a `div` by default. */
export type DivPrimitiveProps<State> = PrimitiveProps<State> & DivProps;

/** `data-*` attributes from a record: `true` → present (empty), `false`/`undefined` → absent. */
export function dataAttributes(
    record: Record<string, string | number | boolean | undefined>,
) {
    const attributes: Record<string, string> = {};
    for (const key in record) {
        const value = record[key];
        if (value === true) {
            attributes[`data-${key}`] = "";
        } else if (value !== false && value !== undefined) {
            attributes[`data-${key}`] = String(value);
        }
    }
    return attributes;
}

type AnyProps = Record<string, unknown>;

interface RenderOptions<State> {
    state: State;
    /**
     * the primitive's own props: ARIA, data-*, handlers, and its structural style (`style`), which
     * always wins over the consumer's. A part hook's result (`{ state, props }`) fits as it is.
     */
    props: Record<string, unknown>;
    /** what the element holds */
    children?: React.ReactNode;
    /** the primitive's ref, merged with the consumer's */
    ref?: React.Ref<HTMLElement> | undefined;
    /**
     * style keys left out of the consumer's style and its `render` element's: the keys the engine
     * writes itself (a layer's `transform`, a pinned cell's `left`), or that would move the
     * element from its place
     */
    drop?: readonly (keyof React.CSSProperties)[] | undefined;
    /**
     * handlers that run last, after the consumer's and the `render` element's own (the grid's
     * keys and clicks, which `preventDefault` before them cancels)
     */
    after?: AnyProps | undefined;
}

/** A style without the `drop` keys: the same object when it has none of them. */
function without(
    style: React.CSSProperties | undefined,
    drop: RenderOptions<unknown>["drop"],
): React.CSSProperties | undefined {
    if (!style || !drop?.some((key) => key in style)) return style;
    const rest: React.CSSProperties = { ...style };
    for (const key of drop) delete rest[key];
    return rest;
}

/**
 * Renders a primitive's element: resolves `className`/`style` functions against the state,
 * merges the consumer's props over the primitive's (handlers composed, internal first; structural
 * style keys win), merges refs, and applies `render`.
 */
export function useRenderElement<State>(
    tag: keyof React.JSX.IntrinsicElements,
    componentProps: PrimitiveProps<State>,
    options: RenderOptions<State>,
): React.JSX.Element {
    const {
        render,
        className,
        style,
        ref: externalRef,
        ...external
    } = componentProps as PrimitiveProps<State> & AnyProps;
    const { drop, after } = options;
    const internalRef = options.ref;
    // the render element's own ref joins the merge; memoized so React does not detach and
    // re-attach the refs (and the primitive's registrations) on every render
    const renderElement =
        render && typeof render !== "function"
            ? (render as React.ReactElement<AnyProps>)
            : undefined;
    const elementRef = renderElement?.props.ref as
        | React.Ref<HTMLElement>
        | undefined;
    // consumer refs are read when the element attaches, not memoized on their identity: an inline
    // callback ref (a new function each render) must not make React detach and re-attach the
    // primitive's own ref (and its registrations) on every render
    const consumerRefs = React.useRef<(React.Ref<HTMLElement> | undefined)[]>(
        [],
    );
    consumerRefs.current = [externalRef, elementRef];
    // (a consumer ref that appears later re-attaches once, so it is called)
    const hasConsumerRef = externalRef != null || elementRef != null;
    const ref = React.useMemo<React.RefCallback<HTMLElement>>(
        () => (element: HTMLElement | null) =>
            mergeRefs(
                internalRef,
                ...(hasConsumerRef ? consumerRefs.current : []),
            )(element),
        [internalRef, hasConsumerRef],
    );

    const resolvedClassName =
        typeof className === "function" ? className(options.state) : className;
    const resolvedStyle = without(
        typeof style === "function" ? style(options.state) : style,
        drop,
    );
    const structural = options.props.style as React.CSSProperties | undefined;
    const mergedStyle =
        resolvedStyle || structural
            ? { ...resolvedStyle, ...structural }
            : undefined;

    let props = mergeProps(options.props, external);
    // a part's children are its own (the option); without it, its props' stay
    if (options.children !== undefined) props.children = options.children;
    if (resolvedClassName !== undefined) {
        props.className = resolvedClassName;
    }
    if (mergedStyle !== undefined) {
        props.style = mergedStyle;
    }
    props.ref = ref;

    if (typeof render === "function") {
        if (after) props = mergeProps(props, after);
        return render(props as unknown as RenderedProps, options.state);
    }
    if (renderElement) {
        const elementProps = renderElement.props;
        let merged = mergeProps(props, elementProps);
        // the element's own style sits under the structural keys too
        if (elementProps.style || props.style) {
            merged.style = {
                ...without(elementProps.style as React.CSSProperties, drop),
                ...resolvedStyle,
                ...structural,
            };
        }
        merged.ref = ref;
        if (after) merged = mergeProps(merged, after);
        return React.cloneElement(renderElement, merged);
    }
    if (after) props = mergeProps(props, after);
    return React.createElement(tag, props);
}
