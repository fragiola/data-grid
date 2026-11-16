import {
    followTheme,
    postReady,
    reportHeight,
} from "examples-shared/embed/messages";
import {
    type Component,
    createApp,
    defineAsyncComponent,
    defineComponent,
    h,
    onErrorCaptured,
    onMounted,
    onUnmounted,
    type PropType,
    ref,
} from "vue";
import { LOADERS } from "./loaders.generated";
import "./styles.css";

// `?id=<id>` renders one example on the whole viewport, with no chrome: the site puts it in an
// iframe (contract v1.2, §5). The theme is already on `<body>` (vite.shared.ts, before the first
// paint); the site changes it with a message. Without an id, a plain list of links (local checks).
// The same protocol, markup and messages as examples/react's embed.

const READY_TIMEOUT_MS = 500;

/**
 * Says `ready` once the example has mounted. The engine measures the grid and renders its window
 * after that mount, so `ready` waits two frames: the site shows the frame with the rows already
 * in place. A frame the browser does not render (a host that hides it with `display: none`) gets
 * no animation frames, so a timeout sends it anyway.
 */
const Ready = defineComponent({
    name: "EmbedReady",
    props: {
        onReady: { type: Function as PropType<() => void>, required: true },
    },
    setup(props) {
        let first = 0;
        let second = 0;
        let fallback: ReturnType<typeof setTimeout> | undefined;
        onMounted(() => {
            first = requestAnimationFrame(() => {
                second = requestAnimationFrame(() => props.onReady());
            });
            fallback = setTimeout(() => props.onReady(), READY_TIMEOUT_MS);
        });
        onUnmounted(() => {
            cancelAnimationFrame(first);
            cancelAnimationFrame(second);
            clearTimeout(fallback);
        });
        return () => null;
    },
});

const Embed = defineComponent({
    name: "EmbedExample",
    props: { id: { type: String, required: true } },
    setup(props) {
        const loader = LOADERS[props.id];
        const flow = loader?.layout === "flow";
        const content = ref<HTMLElement | null>(null);
        const error = ref<Error | null>(null);
        let sent = false;
        const ready = () => {
            if (sent) return;
            sent = true;
            postReady(props.id);
            if (flow && content.value) reportHeight(props.id, content.value);
        };
        // `Ready` mounts once the example's module has loaded (an async component, no Suspense),
        // so it never says ready over an empty frame
        const loaded = ref(false);
        const Example: Component | undefined = loader
            ? defineAsyncComponent(() =>
                  loader.load().then((module) => {
                      loaded.value = true;
                      return module;
                  }),
              )
            : undefined;
        onErrorCaptured((caught) => {
            console.error(caught);
            error.value =
                caught instanceof Error ? caught : new Error(String(caught));
            ready();
            return false;
        });
        return () => {
            if (!Example) {
                return h("div", { role: "alert", class: "m-4 self-start" }, [
                    `Unknown example "${props.id}"`,
                    h(Ready, { onReady: ready }),
                ]);
            }
            if (error.value) {
                return h(
                    "div",
                    {
                        role: "alert",
                        class: "palette-danger m-4 self-start rounded-md bg-palette-soft p-4 text-palette-accent",
                    },
                    `This example failed: ${error.value.message}`,
                );
            }
            return [
                h(
                    "div",
                    {
                        ref: content,
                        "data-testid": "example-root",
                        class: "flex min-h-0 min-w-0 flex-col",
                    },
                    [h(Example)],
                ),
                loaded.value ? h(Ready, { onReady: ready }) : null,
            ];
        };
    },
});

const Index = defineComponent({
    name: "EmbedIndex",
    setup() {
        return () =>
            h(
                "ul",
                { class: "m-4 flex flex-col gap-1 self-start" },
                Object.keys(LOADERS).map((id) =>
                    h("li", { key: id }, [
                        h("a", { class: "underline", href: `?id=${id}` }, id),
                    ]),
                ),
            );
    },
});

const stage = document.getElementById("root");
if (stage) {
    const id = new URLSearchParams(location.search).get("id");
    if (id && LOADERS[id]?.layout === "flow") {
        // a flow example sizes the frame: the stage takes its content's height
        stage.style.height = "auto";
        stage.style.gridTemplate = "auto / minmax(0, 1fr)";
    }
    followTheme();
    (id ? createApp(Embed, { id }) : createApp(Index)).mount(stage);
}
