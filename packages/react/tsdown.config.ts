import { defineConfig } from "tsdown";

export default defineConfig({
    // the primitives, and the opt-in extras, each its own file: the local pipeline's hook
    // (`@fragiola/data-grid-react/local`) and the selection's (`@fragiola/data-grid-react/selection`)
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
