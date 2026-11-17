import { join } from "node:path";
import angular from "@analogjs/vite-plugin-angular";
import { defaultClientConditions } from "vite";
import { defineProject } from "vitest/config";
import { withSourceCondition } from "../../scripts/source-condition.ts";

export default defineProject({
    // the directives compiled by the Angular compiler (TypeScript 6.0.3, this package's); the
    // tsconfig by its path, so a run from the repository's root finds it too
    plugins: [
        angular({ tsconfig: join(import.meta.dirname, "tsconfig.spec.json") }),
    ],
    // the core from its sources (the source export condition), not its dist
    resolve: { conditions: withSourceCondition(defaultClientConditions) },
    test: {
        name: "angular",
        environment: "jsdom",
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
    },
});
