import { describe, expect, it } from "vitest";
import {
    isLayoutName,
    isLooseSourceFile,
    layoutProblems,
} from "../../scripts/check-layout.ts";

// `pnpm check` runs scripts/check-layout.ts over `git ls-files`.
describe("the source layout check", () => {
    it("takes kebab-case names, with their suffixes", () => {
        for (const name of [
            "layout-engine.ts",
            "tab-list.tsx",
            "layout-node.vue",
            "drag-drop-manager.test.ts",
            "tabset.directive.ts",
            "index.d.ts",
            "vitest.config.ts",
            "test-two-tabs.json",
            "e2e",
            "v1",
        ]) {
            expect(isLayoutName(name), name).toBe(true);
        }
    });

    it("refuses any other case", () => {
        for (const name of [
            "LayoutEngine.ts",
            "dropZones.ts",
            "LayoutNode.vue",
            "test_two_tabs.json",
            "KeyMap.test.ts",
            "Tab-list.tsx",
            "tab--list.ts",
            "-tab.ts",
        ]) {
            expect(isLayoutName(name), name).toBe(false);
        }
    });

    it("keeps the fixed names, a tool's dot names, and checks what follows an underscore", () => {
        expect(isLayoutName("README.md")).toBe(true);
        expect(isLayoutName("LICENSE")).toBe(true);
        expect(isLayoutName(".github")).toBe(true);
        expect(isLayoutName("_kit")).toBe(true);
        expect(isLayoutName("_Kit")).toBe(false);
    });

    it("finds a non-entry file at the root of a package's src/", () => {
        expect(isLooseSourceFile("packages/react/src/foo.ts")).toBe(true);
        expect(isLooseSourceFile("packages/core/src/paths.ts")).toBe(true);
        expect(isLooseSourceFile("packages/react/src/index.ts")).toBe(false);
        expect(isLooseSourceFile("packages/vue/src/typed.ts")).toBe(false);
        expect(isLooseSourceFile("packages/angular/src/public-api.ts")).toBe(
            false,
        );
        expect(isLooseSourceFile("packages/core/src/engine/verbs.ts")).toBe(
            false,
        );
        expect(isLooseSourceFile("apps/playground/src/main.tsx")).toBe(false);
    });

    it("reports each bad name once, with the folder it belongs to", () => {
        expect(
            layoutProblems([
                "packages/core/src/engine/LayoutEngine.ts",
                "examples/vue/src/examples/_kit/Card.vue",
                "examples/vue/src/examples/Bad_Dir/a.ts",
                "examples/vue/src/examples/Bad_Dir/b.ts",
                ".github/workflows/CI.yml",
                "packages/react/src/foo.ts",
                "packages/react/src/components/tab-list.tsx",
            ]),
        ).toEqual([
            "packages/core/src/engine/LayoutEngine.ts: not kebab-case",
            "examples/vue/src/examples/_kit/Card.vue: not kebab-case",
            "examples/vue/src/examples/Bad_Dir: not kebab-case",
            expect.stringMatching(
                /^packages\/react\/src\/foo\.ts: a package's src\/ root/,
            ),
        ]);
    });
});
