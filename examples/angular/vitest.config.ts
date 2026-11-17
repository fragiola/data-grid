import { defineConfig } from "vitest/config";
import { examplesTestResolve } from "./vite.shared.ts";

export default defineConfig({
    // the packages from their sources, not their dist, in either environment
    ...examplesTestResolve(),
    test: {
        name: "examples-angular",
        // the contract tests read files and import the examples' styles: nothing renders
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
