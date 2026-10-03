import { defineConfig } from "tsdown";

export default defineConfig({
    // the primitives, and the opt-in local pipeline's hook (`@fragiola/data-grid-react/local`)
    entry: { index: "src/index.ts", local: "src/local/index.ts" },
    format: "esm",
    platform: "browser",
    dts: true,
    sourcemap: true,
    clean: true,
});
