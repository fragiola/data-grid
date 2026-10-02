import { defineProject } from "vitest/config";

export default defineProject({
    test: {
        name: "react",
        environment: "jsdom",
        include: ["tests/**/*.test.{ts,tsx}"],
        setupFiles: ["tests/setup.ts"],
    },
});
