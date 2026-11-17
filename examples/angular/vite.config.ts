import { join } from "node:path";
import angular from "@analogjs/vite-plugin-angular";
import tailwindcss from "@tailwindcss/vite";
import { examplesApp } from "examples-shared/scripts/examples-lib";
import { buildManifest } from "examples-shared/scripts/manifest";
import { defineConfig, type Plugin } from "vite";
import { examplesResolve, prePaintTheme } from "./vite.shared.ts";

// The Angular embed app of the site export (contract v1.2, §5): `?id=<id>&theme=<name>` renders one
// example on the whole viewport, with no chrome. It is built for `<base>/embed/angular/`
// (`EMBED_BASE`, set by site/export.ts) into `EMBED_OUT_DIR` (default `dist`).

const base = process.env.EMBED_BASE ?? "/";
const outDir = process.env.EMBED_OUT_DIR;

/**
 * In dev, `<base>manifest.json` is served too, built per request (as examples/react does); a
 * metadata change (examples/shared/src/meta) needs a restart. The build's manifest is written by
 * site/export.ts.
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
                    JSON.stringify(await buildManifest(examplesApp("angular"))),
                );
            });
        },
    };
}

export default defineConfig(({ command }) => ({
    base,
    // the Angular compiler (TypeScript 6.0.3, this app's), zoneless: no zone.js anywhere
    plugins: [
        angular({ tsconfig: join(import.meta.dirname, "tsconfig.app.json") }),
        tailwindcss(),
        prePaintTheme(),
        devManifest(),
    ],
    resolve: examplesResolve(command),
    ...(outDir ? { build: { outDir, emptyOutDir: true } } : {}),
    // 5180 is examples/react's, 5181 examples/vue's
    server: { port: Number(process.env.PORT ?? 5182), strictPort: true },
}));
