import { defineProject } from "vitest/config";

export default defineProject({
    test: {
        name: "core",
        // Node by default: the model and the axis math must load and run without a DOM. Files
        // that need one opt in with a `// @vitest-environment jsdom` docblock.
        environment: "node",
        include: ["tests/**/*.test.ts"],
        benchmark: { include: ["tests/**/*.bench.ts"] },
    },
});
