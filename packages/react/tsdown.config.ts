import { defineConfig } from "tsdown";

export default defineConfig({
    // the primitives, and the opt-in extras, each its own file: the local pipeline's hook
    // (`@fragiola/data-grid-react/local`) and the features, the core's re-exported with their
    // hooks (`/sorting`, Epic #141; `/navigation`, `/row-selection` with `useSelectAll`, `/range`,
    // `/clipboard`, `/fill` with `useFillHandle`, Epic #144; `/editing` with `useCellEdit`, Epic
    // #146; `/column-resize` with `useColumnResizer`, `/column-reorder`, `/column-pinning`,
    // `/column-group-collapse`, Epic #148; `/row-expansion`, `/row-grouping`,
    // `/row-reorder`, `/spans`, `/summary-rows`, Epic #151; `/filtering`, `/search`,
    // `/pagination`, Epic #153)
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
    // the declarations are built from src only: tsconfig.json also takes in the tests and the
    // configs, which import the repo's scripts/, and their declarations would be written there
    tsconfig: "tsconfig.build.json",
});
