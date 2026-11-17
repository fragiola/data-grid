import { join } from "node:path";
import angular from "@analogjs/vite-plugin-angular";
import { defineConfig } from "vitest/config";
import { examplesTestResolve } from "./vite.shared.ts";

export default defineConfig({
    // the kit's components compile as in the app (its render tests mount them); the tsconfig by
    // its path, so a run from the repository's root finds it too
    plugins: [
        angular({ tsconfig: join(import.meta.dirname, "tsconfig.spec.json") }),
    ],
    // the packages from their sources, not their dist, in either environment
    ...examplesTestResolve(),
    test: {
        name: "examples-angular",
        // the contract tests read files; the kit's render tests opt into jsdom per file
        environment: "node",
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
    },
});
