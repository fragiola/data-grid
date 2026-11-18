import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// The E2E jobs run in Playwright's image instead of installing the browsers (Epic #162): its
// browsers are the ones of its version, so the tag follows @playwright/test.
describe("the CI workflow", () => {
    it("runs the E2E jobs in the image of the Playwright the suites use", () => {
        const versions = new Set(
            [
                "apps/playground",
                "examples/shared",
                "examples/react",
                "examples/vue",
                "examples/angular",
            ].map(
                (dir) =>
                    JSON.parse(read(`${dir}/package.json`)).devDependencies[
                        "@playwright/test"
                    ],
            ),
        );
        expect(versions.size).toBe(1);
        const images = [
            ...read(".github/workflows/ci.yml").matchAll(
                /mcr\.microsoft\.com\/playwright:v([\d.]+)-noble/g,
            ),
        ].map((match) => match[1]);
        expect(images.length).toBeGreaterThan(0);
        expect(new Set(images)).toEqual(versions);
    });

    it("installs no browser", () => {
        expect(read(".github/workflows/ci.yml")).not.toContain(
            "playwright install",
        );
    });
});
