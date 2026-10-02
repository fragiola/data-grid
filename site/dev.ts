// `pnpm site:dev --base /<slug> --port <n>`: serves the embed apps with hot reload under
// `<base>/embed/<framework>/`, so fragiola.com in dev (`www`) can proxy `/<slug>/embed/**` here.
// The manifest is served too (`<base>/embed/<framework>/manifest.json`), rebuilt per request.
// One framework today; a second one would need its own port or a proxy in front.

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { readProject } from "./sources.ts";

const { values } = parseArgs({
    options: {
        base: { type: "string" },
        port: { type: "string", default: "5180" },
    },
});
if (values.base === undefined) {
    console.error("usage: pnpm site:dev --base /<slug> [--port <n>]");
    process.exit(1);
}
const base = `/${values.base}`.replace(/\/+/g, "/").replace(/\/$/, "");
const [framework] = readProject().frameworks;

const child = spawn("pnpm", ["--filter", `examples-${framework}`, "dev"], {
    cwd: resolve(import.meta.dirname, ".."),
    stdio: "inherit",
    env: {
        ...process.env,
        EMBED_BASE: `${base}/embed/${framework}/`,
        PORT: values.port,
    },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => child.kill(signal));
}
