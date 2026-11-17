import {
    type EmbeddedViewRef,
    effect,
    inject,
    type Signal,
    signal,
    TemplateRef,
    untracked,
    ViewContainerRef,
} from "@angular/core";
import { onDestroy } from "./helpers";
import { elementOf, type SignalContext, signalContext } from "./views";

/**
 * The view of a structural part (one that renders only sometimes: `*dataGridHeader`,
 * `*dataGridRowDetail`, …), from the template of the directive being created: rendered while
 * `context()` gives a context (updated in place as it changes), none while it gives `null`.
 * Returns the view's element (the part's element: its first root element), `null` while none.
 */
export function structuralView<C extends object>(
    context: () => C | null,
    around?: {
        /** places the view once made (its nodes are in the container) */
        readonly place: (view: EmbeddedViewRef<C>) => void;
        /** after the view is gone */
        readonly clear: () => void;
    },
): Signal<HTMLElement | null> {
    const container = inject(ViewContainerRef);
    const template = inject<TemplateRef<SignalContext<C> & C>>(TemplateRef);
    const element = signal<HTMLElement | null>(null);
    let view: EmbeddedViewRef<SignalContext<C> & C> | undefined;
    const clear = () => {
        view = undefined;
        container.clear();
        element.set(null);
        around?.clear();
    };
    effect(() => {
        const next = context();
        untracked(() => {
            if (!next) {
                if (view) clear();
                return;
            }
            if (view) {
                view.context.update(next);
                return;
            }
            view = container.createEmbeddedView(template, signalContext(next));
            around?.place(view);
            element.set(elementOf(view));
        });
    });
    onDestroy(clear);
    return element.asReadonly();
}
