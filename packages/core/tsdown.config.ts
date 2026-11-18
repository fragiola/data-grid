import { defineConfig } from "tsdown";

export default defineConfig({
    // the grid, and its opt-in extras, each its own file: the local pipeline
    // (`@fragiola/data-grid/local`) and the features (Epic #141, #144: `/sorting`,
    // `/navigation`, `/row-selection`, `/range`, `/clipboard`, `/fill`; Epic #146: `/editing`;
    // Epic #148: `/column-resize`, `/column-reorder`, `/column-pinning`, `/column-group-collapse`;
    // Epic #151: the row features; Epic #153: `/filtering`, `/search`, `/pagination`)
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
        "row-expansion": "src/row-expansion/index.ts",
        "row-grouping": "src/row-grouping/index.ts",
        "row-reorder": "src/row-reorder/index.ts",
        spans: "src/spans/index.ts",
        "summary-rows": "src/summary-rows/index.ts",
        filtering: "src/filtering/index.ts",
        search: "src/search/index.ts",
        pagination: "src/pagination/index.ts",
    },
    format: "esm",
    platform: "browser",
    dts: true,
    sourcemap: true,
    clean: true,
});
