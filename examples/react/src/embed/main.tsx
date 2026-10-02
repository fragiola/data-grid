import {
    Component,
    type ComponentType,
    type ErrorInfo,
    lazy,
    type ReactNode,
    StrictMode,
    Suspense,
    useEffect,
    useRef,
} from "react";
import { createRoot } from "react-dom/client";
import { LOADERS } from "./loaders.generated";
import { followTheme, postReady, reportHeight } from "./messages";
import "./styles.css";

// `?id=<id>` renders one example on the whole viewport, with no chrome: the site puts it in an
// iframe (contract v1.2, §5). The theme is already on `<body>` (vite.shared.ts, before the first
// paint); the site changes it with a message. Without an id, a plain list of links (local checks).

const READY_TIMEOUT_MS = 500;

const COMPONENTS = new Map<string, ComponentType>(
    Object.entries(LOADERS).map(([id, { load }]) => [id, lazy(load)]),
);

class ExampleErrorBoundary extends Component<
    { onError: () => void; children: ReactNode },
    { error: Error | null }
> {
    state = { error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(error, info.componentStack);
        this.props.onError();
    }

    render() {
        if (this.state.error) {
            return (
                <div
                    role="alert"
                    className="palette-danger m-4 self-start rounded-md bg-palette-soft p-4 text-palette-accent"
                >
                    {`This example failed: ${this.state.error.message}`}
                </div>
            );
        }
        return this.props.children;
    }
}

/**
 * Rendered after the example inside the same Suspense boundary, so its effect runs once the lazy
 * example has committed. The engine measures the grid and renders its window after that commit,
 * so `ready` waits two frames: the site shows the frame with the rows already in place. A frame the browser does
 * not render (a host that hides it with `display: none`) gets no animation frames, so a timeout
 * sends it anyway.
 */
function Ready({ onReady }: { onReady: () => void }) {
    useEffect(() => {
        let second = 0;
        const first = requestAnimationFrame(() => {
            second = requestAnimationFrame(onReady);
        });
        const fallback = setTimeout(onReady, READY_TIMEOUT_MS);
        return () => {
            cancelAnimationFrame(first);
            cancelAnimationFrame(second);
            clearTimeout(fallback);
        };
    }, [onReady]);
    return null;
}

function Embed({ id }: { id: string }) {
    const Example = COMPONENTS.get(id);
    const flow = LOADERS[id]?.layout === "flow";
    const content = useRef<HTMLDivElement | null>(null);
    const sent = useRef(false);
    const ready = useRef(() => {
        if (sent.current) return;
        sent.current = true;
        postReady(id);
        if (flow && content.current) reportHeight(id, content.current);
    }).current;

    if (!Example) {
        return (
            <div role="alert" className="m-4 self-start">
                {`Unknown example "${id}"`}
                <Ready onReady={ready} />
            </div>
        );
    }
    return (
        <ExampleErrorBoundary onError={ready}>
            <Suspense fallback={null}>
                <div
                    ref={content}
                    data-testid="example-root"
                    className="flex min-h-0 min-w-0 flex-col"
                >
                    <Example />
                </div>
                <Ready onReady={ready} />
            </Suspense>
        </ExampleErrorBoundary>
    );
}

function Index() {
    return (
        <ul className="m-4 flex flex-col gap-1 self-start">
            {Object.keys(LOADERS).map((id) => (
                <li key={id}>
                    <a className="underline" href={`?id=${id}`}>
                        {id}
                    </a>
                </li>
            ))}
        </ul>
    );
}

const stage = document.getElementById("root");
if (stage) {
    const id = new URLSearchParams(location.search).get("id");
    if (id && LOADERS[id]?.layout === "flow") {
        // a flow example sizes the frame: the stage takes its content's height
        stage.style.height = "auto";
        stage.style.gridTemplate = "auto / minmax(0, 1fr)";
    }
    followTheme();
    createRoot(stage).render(
        <StrictMode>{id ? <Embed id={id} /> : <Index />}</StrictMode>,
    );
}
