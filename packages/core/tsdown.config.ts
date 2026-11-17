import { defineConfig } from "tsdown";

export default defineConfig({
    // the grid, and its opt-in extras, each its own file: the local pipeline
    // (`@fragiola/data-grid/local`), the selection's helpers (`@fragiola/data-grid/selection`),
    // the fill's (`@fragiola/data-grid/fill`) and the features (`@fragiola/data-grid/sorting`,
    // Epic #141)
    entry: {
        index: "src/index.ts",
        local: "src/local/index.ts",
        selection: "src/selection/index.ts",
        fill: "src/fill/index.ts",
        sorting: "src/sorting/index.ts",
    },
    format: "esm",
    platform: "browser",
    dts: true,
    sourcemap: true,
    clean: true,
});
