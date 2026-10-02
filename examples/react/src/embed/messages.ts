// The messages between the embed and the site (contract v1, §5.2). Same origin: every message
// is posted to, and only accepted from, `location.origin`.

import {
    isThemeName,
    THEMES,
    type ThemeName,
} from "../examples/_themes/themes";

export const READY = "fragiola:example:ready";
export const RESIZE = "fragiola:example:resize";
export const THEME = "fragiola:example:theme";

const embedded = window.parent !== window;

function post(message: Record<string, unknown>) {
    if (embedded) window.parent.postMessage(message, location.origin);
}

/** Once, after the example's first render. */
export function postReady(id: string) {
    post({ type: READY, id });
}

/** Posts the content height whenever it changes (a `flow` example only). Returns a cleanup. */
export function reportHeight(id: string, content: HTMLElement): () => void {
    let last = -1;
    const observer = new ResizeObserver(() => {
        const height = Math.ceil(content.getBoundingClientRect().height);
        if (height === last) return;
        last = height;
        post({ type: RESIZE, id, height });
    });
    observer.observe(content);
    return () => observer.disconnect();
}

/**
 * Applies an example theme: its scheme on `<html>`, its name on `<body>`, where the example and
 * the popups portalled into `<body>` both find it.
 */
export function applyTheme(theme: ThemeName) {
    const scheme =
        THEMES.find((entry) => entry.name === theme)?.scheme ?? "light";
    const html = document.documentElement;
    html.dataset.theme = scheme;
    html.classList.toggle("dark", scheme === "dark");
    document.body.dataset.exampleTheme = theme;
}

/** Follows the site's theme messages; an unknown theme is ignored. Returns a cleanup. */
export function followTheme(): () => void {
    const onMessage = (event: MessageEvent) => {
        if (event.origin !== location.origin || event.source !== window.parent)
            return;
        const data = event.data as { type?: unknown; theme?: unknown } | null;
        if (data?.type === THEME && isThemeName(data.theme)) {
            applyTheme(data.theme);
        }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
}
