import { defineConfig } from "tsdown";

export default defineConfig({
    // the grid, and the opt-in local pipeline (`@fragiola/data-grid/local`): its own file
    entry: { index: "src/index.ts", local: "src/local/index.ts" },
    format: "esm",
    platform: "browser",
    dts: true,
    sourcemap: true,
    clean: true,
});
