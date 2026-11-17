import { defineConfig } from "tsdown";

export default defineConfig({
    // the primitives, and the opt-in extras, each its own file: the local pipeline's hook
    // (`@fragiola/data-grid-react/local`), the selection's (`@fragiola/data-grid-react/selection`)
    // and the features, the core's re-exported (`@fragiola/data-grid-react/sorting`, Epic #141)
    entry: {
        index: "src/index.ts",
        local: "src/local/index.ts",
        selection: "src/selection/index.ts",
        sorting: "src/sorting/index.ts",
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
