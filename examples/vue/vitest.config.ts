import { defineConfig } from "vitest/config";
import { examplesTestResolve } from "./vite.shared.ts";

export default defineConfig({
    // the packages from their sources, not their dist, in either environment
    ...examplesTestResolve(),
    test: {
        name: "examples-vue",
        // the contract tests read files: no component is mounted
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
