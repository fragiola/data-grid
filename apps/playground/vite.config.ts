import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import {
    examplesResolve,
    prePaintTheme,
} from "../../examples/react/vite.shared.ts";

const root = import.meta.dirname;
// 5173 is Playwright's (playwright.config.ts); PLAYGROUND_PORT moves both, e.g. when another
// Vite app already holds 5173
const port = Number(process.env.PLAYGROUND_PORT ?? 5173);

// Every fixture is its own page: `fixtures/<name>/index.html`.
function pages(dir: string): Record<string, string> {
    const base = resolve(root, dir);
    if (!existsSync(base)) return {};
    return Object.fromEntries(
        readdirSync(base)
            .filter((name) => existsSync(resolve(base, name, "index.html")))
            .map((name) => [
                `${dir}/${name}`,
                resolve(base, name, "index.html"),
            ]),
    );
}

// The shell (index.html) renders the examples of examples/react in place, with that app's
// wiring: the `#/` alias, one React, the `development` condition in dev (the core and React
// sources hot-reload; the build uses `dist`) and the pre-paint theme. It is never deployed;
// `build` exists so CI catches a playground that no longer compiles.
export default defineConfig(({ command }) => ({
    // Tailwind is an app concern only (the shell and the examples); no package depends on it.
    // The stage is rendered by React: the pre-paint script sets only the scheme on <html>.
    plugins: [react(), tailwindcss(), prePaintTheme()],
    resolve: examplesResolve(command),
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    build: {
        rollupOptions: {
            input: {
                index: resolve(root, "index.html"),
                ...pages("fixtures"),
            },
        },
    },
}));
