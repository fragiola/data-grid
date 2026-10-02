import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
    listExampleSlugs,
    loadExamples,
} from "../../../examples/react/scripts/examples-lib.ts";
import { CATEGORIES } from "../../../examples/react/src/examples/meta-types.ts";
import {
    entries,
    exampleSlug,
    findEntry,
    fixtures,
    repositoryPath,
    sections,
} from "../src/catalog.ts";

// The catalog reads examples/react where it lives: every example it lists is one the site shows,
// none is missing, and there is no second list to keep in step.

const examples = await loadExamples();

describe("the catalog", () => {
    it("lists every example of examples/react once, and no `_` folder", () => {
        const listed = entries.map((e) => e.id).sort();
        expect(listed).toEqual(listExampleSlugs());
        expect(listed.some((id) => id.startsWith("_"))).toBe(false);
    });

    it("groups the examples by category, in CATEGORIES order", () => {
        const section = sections.find((s) => s.kind === "example");
        const categories = section?.groups.map((g) => g.key) ?? [];
        expect(categories).toEqual(
            CATEGORIES.filter((c) => categories.includes(c)),
        );
    });

    it("orders examples within a category by `order`", () => {
        const section = sections.find((s) => s.kind === "example");
        for (const group of section?.groups ?? []) {
            const orders = group.entries.map(
                (e) => examples.find((x) => x.slug === e.id)?.meta.order ?? 0,
            );
            expect(orders).toEqual([...orders].sort((a, b) => a - b));
        }
    });

    it("carries each example's meta: title, category, features and layout", () => {
        for (const example of examples) {
            const entry = findEntry({ kind: "example", id: example.slug });
            expect(entry?.title).toBe(example.meta.title);
            expect(entry?.group).toBe(example.meta.category);
            expect(entry?.features).toEqual(example.meta.features);
            expect(entry?.layout).toBe(example.meta.layout ?? "fill");
        }
    });

    it("shows each example's own files, entry first, without meta.ts", async () => {
        for (const entry of entries) {
            const [first, ...rest] = entry.files;
            expect(first?.path, entry.id).toBe(
                `examples/react/src/examples/${entry.id}/index.tsx`,
            );
            expect(await first?.load(), entry.id).toContain("export default");
            for (const file of rest) {
                expect(file.path).toMatch(
                    new RegExp(`^examples/react/src/examples/${entry.id}/`),
                );
                expect(file.path).not.toMatch(/\/meta\.ts$/);
            }
        }
    });

    it("finds nothing for an unknown entry", () => {
        expect(findEntry({ kind: "example", id: "nope" })).toBeUndefined();
        expect(findEntry(null)).toBeUndefined();
    });
});

describe("the fixtures", () => {
    it("links every fixture page, titled by its <title>", () => {
        const dir = resolve(import.meta.dirname, "../fixtures");
        const dirs = existsSync(dir) ? readdirSync(dir) : [];
        expect(fixtures.map((f) => f.name).sort()).toEqual(dirs.sort());
        for (const fixture of fixtures) {
            expect(fixture.href).toBe(`/fixtures/${fixture.name}/`);
        }
    });
});

describe("paths", () => {
    it("reads the example of a file, skipping `_` folders and loose files", () => {
        const base = "../../../examples/react/src/examples";
        expect(exampleSlug(`${base}/hello-grid/index.tsx`)).toBe("hello-grid");
        expect(exampleSlug(`${base}/_kit/data.ts`)).toBeUndefined();
        expect(exampleSlug(`${base}/meta-types.ts`)).toBeUndefined();
    });

    it("writes glob keys from the repository root", () => {
        expect(repositoryPath("../../../examples/react/src/x.ts")).toBe(
            "examples/react/src/x.ts",
        );
    });
});
