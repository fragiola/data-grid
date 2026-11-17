// From Dockable (fragiola/dockable, packages/angular/src/lib/utils/views.ts), same author and
// licence: the signal contexts and the keyed views of the template directives.
import {
    type EmbeddedViewRef,
    signal,
    type TemplateRef,
    untracked,
    type ViewContainerRef,
    type ViewRef,
    type WritableSignal,
} from "@angular/core";

/**
 * A template context whose fields are signals behind getters: a view reads them while it renders,
 * so setting a field renders that view again, and nothing else.
 */
export class SignalContext<V extends object> {
    private readonly fields = new Map<keyof V, WritableSignal<unknown>>();

    constructor(initial: V) {
        for (const key of Object.keys(initial) as (keyof V)[]) {
            this.field(key, initial[key]);
        }
    }

    /** Sets the fields that changed (a field it did not have is added). */
    update(next: V): void {
        for (const key of Object.keys(next) as (keyof V)[]) {
            const field = this.fields.get(key);
            if (!field) this.field(key, next[key]);
            else if (!Object.is(untracked(field), next[key])) {
                field.set(next[key]);
            }
        }
    }

    private field(key: keyof V, value: unknown): void {
        const field = signal(value);
        this.fields.set(key, field);
        Object.defineProperty(this, key, {
            enumerable: true,
            get: () => field(),
        });
    }
}

/** A {@link SignalContext}, seen as the context type its template declares. */
export function signalContext<V extends object>(
    initial: V,
): SignalContext<V> & V {
    return new SignalContext(initial) as SignalContext<V> & V;
}

/** An entry of {@link KeyedViews.sync}: a key, how to create its view at an index, how to update it. */
export interface KeyedItem<R extends ViewRef = ViewRef> {
    key: string;
    create: (index: number) => R;
    update?: (view: R) => void;
}

/**
 * The views of a container, one per key, in the order of the last `sync`: a key that stays keeps
 * its view (moved when its place changed), a new key creates one, a key that goes destroys its
 * view. As a keyed `@for`, but for the parts that insert views of different templates.
 */
export class KeyedViews<R extends ViewRef = ViewRef> {
    private readonly views = new Map<string, R>();

    /** `null`: the views are in no container (their nodes are placed by the caller) */
    constructor(private readonly container: ViewContainerRef | null) {}

    sync(items: readonly KeyedItem<R>[]): void {
        untracked(() => {
            const keep = new Set(items.map((item) => item.key));
            for (const [key, view] of this.views) {
                if (!keep.has(key)) {
                    view.destroy();
                    this.views.delete(key);
                }
            }
            items.forEach((item, index) => {
                let view = this.views.get(item.key);
                if (!view) {
                    view = item.create(index);
                    this.views.set(item.key, view);
                } else if (
                    this.container &&
                    this.container.indexOf(view) !== index
                ) {
                    this.container.move(view, index);
                }
                item.update?.(view);
            });
        });
    }

    get(key: string): R | undefined {
        return this.views.get(key);
    }

    clear(): void {
        for (const view of this.views.values()) {
            view.destroy();
        }
        this.views.clear();
    }
}

/** The first element among a view's root nodes: a structural part's element. */
export function elementOf(view: EmbeddedViewRef<unknown>): HTMLElement | null {
    for (const node of view.rootNodes as Node[]) {
        if (node.nodeType === 1) return node as HTMLElement;
    }
    return null;
}

/**
 * The views of a template directive, keyed: one per item of the last `sync`, each rendered with a
 * signal context that `context(item)` makes, so an item whose key stays updates its view's
 * context in place (that view renders again, nothing else).
 */
export function keyedTemplateViews<Item, C extends object>(
    container: ViewContainerRef,
    template: TemplateRef<C>,
    context: (item: Item) => C,
): {
    sync(items: readonly Item[], keyOf: (item: Item) => string): void;
} {
    const views = new KeyedViews<EmbeddedViewRef<SignalContext<C> & C>>(
        container,
    );
    return {
        sync(items, keyOf) {
            views.sync(
                items.map((item) => ({
                    key: keyOf(item),
                    create: (index) =>
                        container.createEmbeddedView(
                            template as TemplateRef<SignalContext<C> & C>,
                            signalContext(context(item)),
                            index,
                        ),
                    update: (view) => view.context.update(context(item)),
                })),
            );
        },
    };
}
