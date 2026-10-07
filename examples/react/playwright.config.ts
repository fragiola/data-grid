import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);
const PORT = Number(process.env.EXAMPLES_E2E_PORT ?? 4320);
/** The base the site mounts the embed under (site:export --base /data-grid). */
const BASE = "/data-grid/embed/react/";

// The suite runs against a production build of the embed app, under the base it is deployed
// at, served with a host page that embeds it in an iframe (e2e/serve.ts). The build uses the
// packages' `dist`: build them first (`pnpm build` at the root does).
export default defineConfig({
    testDir: "e2e",
    fullyParallel: true,
    forbidOnly: CI,
    retries: CI ? 2 : 0,
    // in CI this suite has its own job, in parallel with the playground's
    workers: CI ? 2 : 4,
    reporter: CI ? [["line"], ["html", { open: "never" }]] : "line",
    use: {
        baseURL: `http://localhost:${PORT}${BASE}`,
        trace: "on-first-retry",
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
    ],
    webServer: {
        command: `node scripts/generate.ts && vite build --outDir .e2e/dist --emptyOutDir && node e2e/serve.ts ${PORT}`,
        env: { EMBED_BASE: BASE },
        url: `http://localhost:${PORT}${BASE}index.html`,
        reuseExistingServer: !CI,
        timeout: 180_000,
    },
});
