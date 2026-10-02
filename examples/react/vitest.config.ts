import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "examples-react",
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
