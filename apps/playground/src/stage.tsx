import {
    type ComponentType,
    type LazyExoticComponent,
    lazy,
    Suspense,
} from "react";
import type { Entry } from "./catalog";
import { ErrorBoundary } from "./error-boundary";

// `lazy` must return the same component across renders or the entry remounts: one per entry,
// made on first show.
const components = new Map<string, LazyExoticComponent<ComponentType>>();

// Entries whose module failed to load. The browser keeps a failed module import for good (a new
// `lazy` would fetch the same URL and fail again), so recovering from one is a page reload.
const failedLoads = new Set<string>();

function key(entry: Entry) {
    return `${entry.kind}:${entry.id}`;
}

function component(entry: Entry) {
    let Component = components.get(key(entry));
    if (!Component) {
        Component = lazy(() =>
            entry.load().catch((error: unknown) => {
                failedLoads.add(key(entry));
                throw error;
            }),
        );
        components.set(key(entry), Component);
    }
    return Component;
}

function recover(entry: Entry) {
    if (failedLoads.has(key(entry))) window.location.reload();
}

/**
 * The embed's stage (examples/react/index.html and src/embed/main.tsx), so an example renders as
 * the site shows it (the example theme is on <body>, `applyTheme` in view.ts): a `fill` example
 * stretched to it, a `flow` one as tall as its content. The App keys the stage by entry, so
 * switching remounts.
 */
export function Stage({ entry }: { entry: Entry }) {
    const Example = component(entry);
    const flow = entry.layout === "flow";
    return (
        <div
            data-testid="stage"
            className={
                flow
                    ? "palette-surface grid min-h-full bg-palette-base text-palette-contrast [grid-template:auto/minmax(0,1fr)]"
                    : "palette-surface grid h-full bg-palette-base text-palette-contrast [grid-template:minmax(0,1fr)/minmax(0,1fr)]"
            }
        >
            <ErrorBoundary name={entry.title} onReset={() => recover(entry)}>
                <Suspense fallback={null}>
                    <div
                        data-testid="example-root"
                        className="flex min-h-0 min-w-0 flex-col"
                    >
                        <Example />
                    </div>
                </Suspense>
            </ErrorBoundary>
        </div>
    );
}
