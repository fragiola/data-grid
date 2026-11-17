import { defineConfig } from "tsdown";

export default defineConfig({
    // the grid, and its opt-in extras, each its own file: the local pipeline
    // (`@fragiola/data-grid/local`) and the features (Epic #141, #144: `/sorting`,
    // `/navigation`, `/row-selection`, `/range`, `/clipboard`, `/fill`; Epic #146: `/editing`;
    // Epic #148: `/column-resize`, `/column-reorder`, `/column-pinning`, `/column-group-collapse`)
    entry: {
        index: "src/index.ts",
        local: "src/local/index.ts",
        sorting: "src/sorting/index.ts",
        navigation: "src/navigation/index.ts",
        "row-selection": "src/row-selection/index.ts",
        range: "src/range/index.ts",
        clipboard: "src/clipboard/index.ts",
        fill: "src/fill/index.ts",
        editing: "src/editing/index.ts",
        "column-resize": "src/column-resize/index.ts",
        "column-reorder": "src/column-reorder/index.ts",
        "column-pinning": "src/column-pinning/index.ts",
        "column-group-collapse": "src/column-group-collapse/index.ts",
    },
    format: "esm",
    platform: "browser",
    dts: true,
    sourcemap: true,
    clean: true,
});
