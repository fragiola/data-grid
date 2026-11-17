import { defineConfig } from "tsdown";

export default defineConfig({
    // the primitives, and the opt-in extras, each its own file: the local pipeline's composable
    // (`@fragiola/data-grid-vue/local`) and the features, the core's re-exported with their
    // composables (`/sorting`, Epic #141; `/navigation`, `/row-selection` with `useSelectAll`,
    // `/range`, `/clipboard`, `/fill` with `useFillHandle`, Epic #144; `/editing` with `useCellEdit`,
    // Epic #146; `/column-resize` with `useColumnResizer`, `/column-reorder`, `/column-pinning`,
    // `/column-group-collapse`, Epic #148)
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
    // the declarations are built from src only: tsconfig.json also takes in the tests and the
    // configs, which import the repo's scripts/, and their declarations would be written there
    tsconfig: "tsconfig.build.json",
});
