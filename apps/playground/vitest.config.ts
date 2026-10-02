import { defineConfig } from "vitest/config";
import { examplesResolve } from "../../examples/react/vite.shared.ts";

export default defineConfig({
    resolve: examplesResolve("serve"),
    test: {
        name: "playground",
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
