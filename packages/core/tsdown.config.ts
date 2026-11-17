import { defineConfig } from "tsdown";

export default defineConfig({
    // the grid, and its opt-in extras, each its own file: the local pipeline
    // (`@fragiola/data-grid/local`) and the features (Epic #141, #144: `/sorting`,
    // `/navigation`, `/row-selection`, `/range`, `/clipboard`, `/fill`)
    entry: {
        index: "src/index.ts",
        local: "src/local/index.ts",
        sorting: "src/sorting/index.ts",
        navigation: "src/navigation/index.ts",
        "row-selection": "src/row-selection/index.ts",
        range: "src/range/index.ts",
        clipboard: "src/clipboard/index.ts",
        fill: "src/fill/index.ts",
    },
    format: "esm",
    platform: "browser",
    dts: true,
    sourcemap: true,
    clean: true,
});
