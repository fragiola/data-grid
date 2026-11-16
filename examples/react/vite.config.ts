import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { examplesApp } from "examples-shared/scripts/examples-lib";
import { buildManifest } from "examples-shared/scripts/manifest";
import { defineConfig, type Plugin } from "vite";
import { examplesResolve, prePaintTheme } from "./vite.shared.ts";

// The embed app of the site export (contract v1.2, §5): `?id=<id>&theme=<name>` renders one
// example on the whole viewport, with no chrome. It is built for `<base>/embed/react/`
// (`EMBED_BASE`, set by site/export.ts) into `EMBED_OUT_DIR` (default `dist`).

const base = process.env.EMBED_BASE ?? "/";
const outDir = process.env.EMBED_OUT_DIR;

/**
 * In dev, `<base>manifest.json` is served too, built per request (the site in dev reads it through
 * its proxy); the files are read fresh, a metadata change (examples/shared/src/meta) needs a
 * restart. The build's manifest is written by site/export.ts.
 */
function devManifest(): Plugin {
    return {
        name: "dev-manifest",
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url?.split("?")[0] !== `${base}manifest.json`) {
                    return next();
                }
                res.setHeader("Content-Type", "application/json");
                res.end(
                    JSON.stringify(await buildManifest(examplesApp("react"))),
                );
            });
        },
    };
}

export default defineConfig(({ command }) => ({
    base,
    plugins: [react(), tailwindcss(), prePaintTheme(), devManifest()],
    resolve: examplesResolve(command),
    ...(outDir ? { build: { outDir, emptyOutDir: true } } : {}),
    server: { port: Number(process.env.PORT ?? 5180), strictPort: true },
}));
