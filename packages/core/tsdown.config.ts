import { defineConfig } from "tsdown";

export default defineConfig({
    // the grid, and its opt-in extras, each its own file: the local pipeline
    // (`@fragiola/data-grid/local`) and the selection's helpers (`@fragiola/data-grid/selection`)
    entry: {
        index: "src/index.ts",
        local: "src/local/index.ts",
        selection: "src/selection/index.ts",
    },
    format: "esm",
    platform: "browser",
    dts: true,
    sourcemap: true,
    clean: true,
});
