// Partly from Dockable (fragiola/dockable, packages/angular/src/lib/utils/helpers.ts), same author
// and licence: the structural style kept applied, the host, the teardown, boolean inputs.
import {
    computed,
    DestroyRef,
    ElementRef,
    effect,
    inject,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import type {
    DataGridEngine,
    EngineEventKey,
    EngineLayer,
    EngineQueryKey,
    EngineQueryMap,
    PartProps,
    PartStyle,
} from "@fragiola/data-grid";
import type { DataGridNode } from "./content";

/** The host element of the directive being created. */
export function injectHost(): HTMLElement {
    return inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}

/** Runs `teardown` when the directive being created is destroyed. */
export function onDestroy(teardown: () => void): void {
    inject(DestroyRef).onDestroy(teardown);
}

/** `true` for a bare attribute (`<div dataGridRoot ownTabStop>`), else the value as a boolean. */
export function booleanInput(value: unknown): boolean {
    return value === "" || (value !== "false" && Boolean(value));
}

/** Like {@link booleanInput}, keeping `undefined` (the core's default). */
export function optionalBoolean(value: unknown): boolean | undefined {
    return value === undefined || value === null
        ? undefined
        : booleanInput(value);
}

/** The style keys whose numbers take no unit (the structural style's stacking and flex). */
const UNITLESS: ReadonlySet<string> = new Set([
    "zIndex",
    "flexShrink",
    "flexGrow",
    "order",
    "opacity",
]);

const kebab = (key: string) =>
    key.startsWith("--")
        ? key
        : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * A structural style (the core's, lengths in pixels as numbers) as CSS declarations: kebab-case
 * names, a length with its `px` (the DOM adds no unit).
 */
export function cssDeclarations(
    style: PartStyle | undefined,
): Map<string, string> {
    const css = new Map<string, string>();
    if (!style) return css;
    for (const [key, value] of Object.entries(style)) {
        if (value === undefined) continue;
        css.set(
            kebab(key),
            typeof value === "number" && !UNITLESS.has(key)
                ? `${value}px`
                : String(value),
        );
    }
    return css;
}

/** The attribute a part prop is written as (`tabIndex` → `tabindex`, `colSpan` → `colspan`). */
const ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
    tabIndex: "tabindex",
    colSpan: "colspan",
    rowSpan: "rowspan",
};

/** A part prop's attribute value: `null` (absent) for `undefined`/`null`, else its text. */
function attributeValue(value: unknown): string | null {
    return value === undefined || value === null ? null : String(value);
}

/** What a part puts on its element, as one read of its state. */
export interface PartBinding {
    /** its attributes (ARIA, `data-*`, `tabIndex`, …) and its structural style */
    readonly props: PartProps;
    /** the engine layer its element registers as (`null`: none) */
    readonly layer?: EngineLayer | null | undefined;
    /**
     * style keys the consumer's own style may not set (a layer's `transform`, a pinned cell's
     * insets): removed from the element's style when the part first binds it
     */
    readonly drop?: readonly string[] | undefined;
}

/**
 * Keeps a part's props on its element: its attributes (a key it stops setting is removed; an
 * attribute the element had before, the consumer's own, is never touched), its structural style
 * (its keys win over the consumer's `style`; a key it stops setting gets the consumer's value
 * back), and its engine layer (registered after the style is written, released before it is:
 * the engine's inset, written on registration, is never overwritten by a stale structural one).
 * `element` reads the element (a structural part's root node), `null` while there is none.
 */
export function bindPart(
    engine: () => DataGridEngine<unknown, DataGridNode>,
    element: HTMLElement | (() => HTMLElement | null),
    read: () => PartBinding | null,
): void {
    const elementOf = typeof element === "function" ? element : () => element;
    let bound: HTMLElement | null = null;
    /** the attributes the consumer gave the element: theirs */
    let consumer = new Set<string>();
    /** the attributes written now */
    const attributes = new Map<string, string>();
    /** the style keys written now, with the consumer's value they replaced */
    const owned = new Map<string, string>();
    let layer: EngineLayer | null = null;
    let release: (() => void) | undefined;
    const unregister = () => {
        release?.();
        release = undefined;
        layer = null;
    };
    const unbind = () => {
        unregister();
        attributes.clear();
        owned.clear();
        bound = null;
    };
    effect(() => {
        const host = elementOf();
        const binding = host ? read() : null;
        untracked(() => {
            if (host !== bound) {
                unbind();
                bound = host;
                if (host) {
                    consumer = new Set(host.getAttributeNames());
                    for (const key of binding?.drop ?? []) {
                        host.style.removeProperty(kebab(key));
                    }
                }
            }
            if (!host || !binding) return;
            const nextLayer = binding.layer ?? null;
            // a layer left first: the engine lets go of what it wrote before the style is written
            if (nextLayer !== layer) unregister();
            const { style, ...props } = binding.props;
            const next = new Map<string, string>();
            for (const [key, value] of Object.entries(props)) {
                const name = ATTRIBUTE_NAMES[key] ?? key;
                const text = attributeValue(value);
                if (text !== null && !consumer.has(name)) next.set(name, text);
            }
            for (const name of attributes.keys()) {
                if (!next.has(name)) host.removeAttribute(name);
            }
            for (const [name, text] of next) {
                if (attributes.get(name) !== text)
                    host.setAttribute(name, text);
            }
            attributes.clear();
            for (const [name, text] of next) attributes.set(name, text);
            const css = cssDeclarations(style);
            for (const [name, previous] of owned) {
                if (!css.has(name)) {
                    if (previous === "") host.style.removeProperty(name);
                    else host.style.setProperty(name, previous);
                    owned.delete(name);
                }
            }
            for (const [name, value] of css) {
                if (!owned.has(name)) {
                    owned.set(name, host.style.getPropertyValue(name));
                }
                if (host.style.getPropertyValue(name) !== value) {
                    host.style.setProperty(name, value);
                }
            }
            if (nextLayer !== layer && nextLayer) {
                layer = nextLayer;
                release = engine().adapter.registerLayer(nextLayer, host);
            }
        });
    });
    onDestroy(unbind);
}

/**
 * An engine's value it reports with an event of the same key (a window, the edit's draft), as a
 * signal: read again when the event comes; `fallback` without an engine. Follows the engine
 * `engine` reads (a `gridRef`'s, as roots take it).
 */
export function engineValue<K extends EngineEventKey & EngineQueryKey>(
    engine: () => DataGridEngine<unknown, DataGridNode> | null | undefined,
    key: K,
    fallback: EngineQueryMap[K],
): Signal<EngineQueryMap[K]> {
    const tick = signal(0);
    effect((onCleanup) => {
        const current = engine();
        if (!current) return;
        onCleanup(current.subscribe(key, () => tick.update((n) => n + 1)));
        // a change between the first read and the subscription is read again
        untracked(() => tick.update((n) => n + 1));
    });
    return computed(() => {
        tick();
        const current = engine();
        return current ? current.get(key) : fallback;
    });
}

/**
 * What `read` returns, or `fallback` while a required input it reads is not set yet (NG0950):
 * the read still tracks the input, so the computed calling it runs again once it is set.
 */
export function beforeInputs<V>(fallback: V, read: () => V): V {
    try {
        return read();
    } catch (error) {
        if ((error as { code?: unknown } | null)?.code === -950) {
            return fallback;
        }
        throw error;
    }
}
