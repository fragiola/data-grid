import {
    Component,
    createComponent,
    type EmbeddedViewRef,
    EnvironmentInjector,
    effect,
    Injectable,
    inject,
    type Signal,
    type TemplateRef,
    untracked,
    ViewContainerRef,
    viewChild,
} from "@angular/core";
import { type DataGridNode, isTemplateContent } from "./content";
import { onDestroy } from "./helpers";
import { type SignalContext, signalContext } from "./views";

/** The context of the text template: the text it shows. */
interface TextContext {
    $implicit: string;
}

/** Holds the one template that renders text, for every node outlet. */
@Component({
    selector: "data-grid-text",
    template: "<ng-template #text let-text>{{ text }}</ng-template>",
})
class DataGridText {
    readonly text = viewChild.required<TemplateRef<TextContext>>("text");
}

/** The text template, made once per application. */
@Injectable({ providedIn: "root" })
class TextTemplate {
    private template: TemplateRef<TextContext> | undefined;
    private readonly environment = inject(EnvironmentInjector);

    get(): TemplateRef<TextContext> {
        if (!this.template) {
            const holder = createComponent(DataGridText, {
                environmentInjector: this.environment,
            });
            holder.changeDetectorRef.detectChanges();
            this.template = holder.instance.text();
        }
        return this.template;
    }
}

/** The view a node renders as, and what it was rendered from. */
interface Rendered {
    readonly view: EmbeddedViewRef<SignalContext<object>>;
    readonly template: TemplateRef<object>;
}

/**
 * Renders a node (a column renderer's result, a value as text) in the view container of the
 * directive being created, and keeps it rendered as `node` changes: a template with its context
 * (another context for the same template updates that view: it renders again, nothing remounts),
 * text (a text node), or nothing.
 */
export function renderNode(node: Signal<DataGridNode>): void {
    const container = inject(ViewContainerRef);
    const texts = inject(TextTemplate);
    let rendered: Rendered | undefined;
    const clear = () => {
        rendered = undefined;
        container.clear();
    };
    const show = (template: TemplateRef<object>, context: object) => {
        if (rendered?.template === template) {
            rendered.view.context.update(context);
            return;
        }
        clear();
        rendered = {
            template,
            view: container.createEmbeddedView(
                template as TemplateRef<SignalContext<object>>,
                signalContext(context),
            ),
        };
    };
    effect(() => {
        const current = node();
        untracked(() => {
            if (isTemplateContent(current)) {
                const { context } = current;
                show(current.template as TemplateRef<object>, {
                    ...context,
                    $implicit: context,
                });
            } else if (
                (typeof current === "string" && current !== "") ||
                typeof current === "number"
            ) {
                show(texts.get() as TemplateRef<object>, {
                    $implicit: String(current),
                });
            } else {
                clear();
            }
        });
    });
    onDestroy(clear);
}
