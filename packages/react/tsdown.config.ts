import { defineConfig } from "tsdown";

export default defineConfig({
    // the primitives, and the opt-in extras, each its own file: the local pipeline's hook
    // (`@fragiola/data-grid-react/local`) and the features, the core's re-exported with their
    // hooks (`/sorting`, Epic #141; `/navigation`, `/row-selection` with `useSelectAll`, `/range`,
    // `/clipboard`, `/fill` with `useFillHandle`, Epic #144)
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
