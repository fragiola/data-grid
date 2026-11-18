import { describe, expect, it } from "vitest";
import {
    e2eSuites,
    examplesFrameworks,
    needOf,
} from "../../scripts/e2e-suites.ts";

const FRAMEWORKS = ["angular", "react", "vue"];
const ALL = { playground: true, examples: FRAMEWORKS };

// CI's `changes` job runs scripts/e2e-suites.ts against the pull request's base.
describe("the E2E suites a change runs", () => {
    it("runs none for the docs", () => {
        expect(
            e2eSuites(
                [
                    "site/docs/guides/features.mdx",
                    "AGENTS.md",
                    "packages/core/README.md",
                    "examples/vue/README.md",
                ],
                FRAMEWORKS,
            ),
        ).toEqual({ playground: false, examples: [] });
    });

    it("runs the playground and React's examples for React", () => {
        expect(
            e2eSuites(
                [
                    "packages/react/src/components/cell.tsx",
                    "examples/react/src/examples/sorting/index.tsx",
                ],
                FRAMEWORKS,
            ),
        ).toEqual({ playground: true, examples: ["react"] });
    });

    it("runs only an adapter's examples for Vue or Angular", () => {
        expect(
            e2eSuites(["packages/vue/src/components/root.ts"], FRAMEWORKS),
        ).toEqual({ playground: false, examples: ["vue"] });
        expect(
            e2eSuites(
                [
                    "packages/angular/src/lib/data-grid.ts",
                    "examples/angular/src/examples/sorting/index.ts",
                    "site/docs/index.mdx",
                ],
                FRAMEWORKS,
            ),
        ).toEqual({ playground: false, examples: ["angular"] });
        expect(
            e2eSuites(
                [
                    "packages/vue/src/index.ts",
                    "packages/angular/src/public-api.ts",
                ],
                FRAMEWORKS,
            ),
        ).toEqual({ playground: false, examples: ["angular", "vue"] });
    });

    it("runs every suite for anything else", () => {
        for (const path of [
            "packages/core/src/engine/engine.ts",
            "examples/shared/e2e/sorting.spec.ts",
            "apps/playground/src/app.tsx",
            "pnpm-lock.yaml",
            "package.json",
            "biome.json",
            ".github/workflows/ci.yml",
            "scripts/e2e-suites.ts",
            "site/export.ts",
            "packages/solid/src/index.ts",
        ]) {
            expect(needOf(path, FRAMEWORKS), path).toBe("all");
            expect(
                e2eSuites(["packages/vue/src/index.ts", path], FRAMEWORKS),
                path,
            ).toEqual(ALL);
        }
    });

    it("runs none for no change", () => {
        expect(e2eSuites([], FRAMEWORKS)).toEqual({
            playground: false,
            examples: [],
        });
    });

    it("finds the examples apps the repository has", () => {
        expect(examplesFrameworks()).toEqual(FRAMEWORKS);
    });
});
