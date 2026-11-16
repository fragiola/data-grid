import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "examples-shared",
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
