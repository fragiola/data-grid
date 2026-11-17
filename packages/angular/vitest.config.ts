import angular from "@analogjs/vite-plugin-angular";
import { defaultClientConditions } from "vite";
import { defineProject } from "vitest/config";
import { withSourceCondition } from "../../scripts/source-condition.ts";

export default defineProject({
    // the directives compiled by the Angular compiler (TypeScript 6.0.3, this package's)
    plugins: [angular({ tsconfig: "tsconfig.spec.json" })],
    // the core from its sources (the source export condition), not its dist
    resolve: { conditions: withSourceCondition(defaultClientConditions) },
    test: {
        name: "angular",
        environment: "jsdom",
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
    },
});
