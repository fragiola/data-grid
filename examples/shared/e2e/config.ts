import { join } from "node:path";
import {
    defineConfig,
    devices,
    type PlaywrightTestConfig,
} from "@playwright/test";
import { FRAMEWORKS, type Framework } from "../src/framework.ts";
import { embedBase } from "./available.ts";

const CI = Boolean(process.env.CI);

/**
 * The Playwright config of a framework's examples app (`examples/<framework>/playwright.config.ts`
 * is `export default examplesE2eConfig("<framework>")`): the shared specs of this directory, run
 * against a production build of that app's embed, under the base it is deployed at, served with a
 * host page that embeds it in an iframe (serve.ts).
 *
 * The app's `build` script builds the embed for `EMBED_BASE` into `EMBED_OUT_DIR`, against the
 * packages' `dist`: build them first (`pnpm build` at the root does). `EXAMPLES_E2E_PORT` moves
 * the server (by default 4320, 4321, … in `FRAMEWORKS` order).
 */
export function examplesE2eConfig(framework: Framework): PlaywrightTestConfig {
    // read by the specs (helpers.ts) in the runner and in every worker, which load this config too
    process.env.EXAMPLES_FRAMEWORK = framework;
    const port = Number(
        process.env.EXAMPLES_E2E_PORT ?? 4320 + FRAMEWORKS.indexOf(framework),
    );
    const base = embedBase(framework);
    const serve = join(import.meta.dirname, "serve.ts");
    return defineConfig({
        testDir: import.meta.dirname,
        fullyParallel: true,
        forbidOnly: CI,
        retries: CI ? 2 : 0,
        // in CI each framework's suite has its own job, in parallel with the playground's
        workers: CI ? 2 : 4,
        reporter: CI ? [["line"], ["html", { open: "never" }]] : "line",
        use: {
            baseURL: `http://localhost:${port}${base}`,
            trace: "on-first-retry",
        },
        // every framework in the three engines, as the playground's fixtures (Epic #89)
        projects: [
            { name: "chromium", use: { ...devices["Desktop Chrome"] } },
            { name: "firefox", use: { ...devices["Desktop Firefox"] } },
            { name: "webkit", use: { ...devices["Desktop Safari"] } },
        ],
        webServer: {
            // run in the app's directory (the config's)
            command: `pnpm run build && node "${serve}" ${port} .e2e/dist ${base}`,
            env: { EMBED_BASE: base, EMBED_OUT_DIR: ".e2e/dist" },
            url: `http://localhost:${port}${base}index.html`,
            reuseExistingServer: !CI,
            timeout: 180_000,
        },
    });
}
