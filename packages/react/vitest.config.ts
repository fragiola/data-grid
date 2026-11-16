import { defaultClientConditions, defaultServerConditions } from "vite";
import { defineProject } from "vitest/config";
import { withSourceCondition } from "../../scripts/source-condition.ts";

export default defineProject({
    // The core from its sources (the source export condition), not its dist, in either
    // environment: client (jsdom, these tests) and server (a test that opts into node).
    resolve: { conditions: withSourceCondition(defaultClientConditions) },
    ssr: {
        resolve: { conditions: withSourceCondition(defaultServerConditions) },
    },
    test: {
        name: "react",
        environment: "jsdom",
        include: ["tests/**/*.test.{ts,tsx}"],
        setupFiles: ["tests/setup.ts"],
    },
});
