import { NgComponentOutlet } from "@angular/common";
import {
    afterNextRender,
    Component,
    DestroyRef,
    type ElementRef,
    ErrorHandler,
    Injector,
    inject,
    provideZonelessChangeDetection,
    signal,
    type Type,
    viewChild,
} from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import {
    followTheme,
    postReady,
    reportHeight,
} from "examples-shared/embed/messages";
import { LOADERS } from "./loaders.generated";
import "./styles.css";

// `?id=<id>` renders one example on the whole viewport, with no chrome: the site puts it in an
// iframe (contract v1.2, §5). The theme is already on `<body>` (vite.shared.ts, before the first
// paint); the site changes it with a message. Without an id, a plain list of links (local checks).
// The same protocol, markup and messages as examples/react's and examples/vue's embeds.

const READY_TIMEOUT_MS = 500;

const id = new URLSearchParams(location.search).get("id");
const loader = id ? LOADERS[id] : undefined;

/** The error an example threw while rendering, shown in place of it. */
const failure = signal<string | undefined>(undefined);

/** An error of the example (rendering, a listener): logged, and shown in place of the example. */
class EmbedErrorHandler implements ErrorHandler {
    handleError(error: unknown): void {
        console.error(error);
        failure.set(error instanceof Error ? error.message : String(error));
    }
}

@Component({
    selector: "[data-embed-stage]",
    imports: [NgComponentOutlet],
    template: `
        @if (!known) {
            @if (id) {
                <div role="alert" class="m-4 self-start">Unknown example "{{ id }}"</div>
            } @else {
                <ul class="m-4 flex flex-col gap-1 self-start">
                    @for (slug of slugs; track slug) {
                        <li><a class="underline" [href]="'?id=' + slug">{{ slug }}</a></li>
                    }
                </ul>
            }
        } @else if (failure()) {
            <div
                role="alert"
                class="palette-danger m-4 self-start rounded-md bg-palette-soft p-4 text-palette-accent"
            >This example failed: {{ failure() }}</div>
        } @else if (example(); as component) {
            <!-- the example's host element lays out as its content (*:contents): the example's
                 frame sits in this flex column as React's does, its h-full the stage's height -->
            <div #content data-testid="example-root" class="flex min-h-0 min-w-0 flex-col *:contents">
                <ng-container *ngComponentOutlet="component" />
            </div>
        }
    `,
})
class Embed {
    protected readonly id = id;
    protected readonly known = loader !== undefined;
    protected readonly slugs = Object.keys(LOADERS);
    protected readonly failure = failure;
    protected readonly example = signal<Type<unknown> | undefined>(undefined);
    private readonly content = viewChild<ElementRef<HTMLElement>>("content");
    private readonly injector = inject(Injector);
    private sent = false;

    constructor() {
        const destroyRef = inject(DestroyRef);
        if (!id) {
            return;
        }
        if (!loader) {
            this.ready();
            return;
        }
        loader
            .load()
            .then((module) => {
                this.example.set(module.default);
                // the engine measures the grid and renders its window after the example's first
                // render: wait two frames, so the site shows the frame with the rows already in
                // place. A frame the browser does not render gets no animation frames, so a
                // timeout sends it anyway
                afterNextRender(
                    () => {
                        let second = 0;
                        const first = requestAnimationFrame(() => {
                            second = requestAnimationFrame(() => this.ready());
                        });
                        const fallback = setTimeout(
                            () => this.ready(),
                            READY_TIMEOUT_MS,
                        );
                        destroyRef.onDestroy(() => {
                            cancelAnimationFrame(first);
                            cancelAnimationFrame(second);
                            clearTimeout(fallback);
                        });
                    },
                    { injector: this.injector },
                );
            })
            .catch((error: unknown) => {
                console.error(error);
                failure.set(
                    error instanceof Error ? error.message : String(error),
                );
                this.ready();
            });
    }

    /** Says `ready` once; a flow example also reports its height. */
    private ready() {
        if (this.sent || !id) return;
        this.sent = true;
        postReady(id);
        const content = this.content()?.nativeElement;
        if (loader?.layout === "flow" && content) reportHeight(id, content);
    }
}

const stage = document.getElementById("root");
if (stage) {
    if (loader?.layout === "flow") {
        // a flow example sizes the frame: the stage takes its content's height
        stage.style.height = "auto";
        stage.style.gridTemplate = "auto / minmax(0, 1fr)";
    }
    followTheme();
    bootstrapApplication(Embed, {
        providers: [
            provideZonelessChangeDetection(),
            { provide: ErrorHandler, useClass: EmbedErrorHandler },
        ],
    }).catch((error: unknown) => console.error(error));
}
