import { defineConfig } from "vitest/config";
import { examplesTestResolve } from "../../examples/react/vite.shared.ts";

export default defineConfig({
    // the packages from their sources, not their dist, in either environment
    ...examplesTestResolve(),
    test: {
        name: "playground",
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
