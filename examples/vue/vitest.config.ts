import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";
import { examplesTestResolve } from "./vite.shared.ts";

export default defineConfig({
    // single-file components compile as in the app (the kit's render tests mount them)
    plugins: [vue()],
    // the packages from their sources, not their dist, in either environment
    ...examplesTestResolve(),
    test: {
        name: "examples-vue",
        // the contract tests read files; the kit's render tests opt into jsdom per file
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
