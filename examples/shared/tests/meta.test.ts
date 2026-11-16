import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
    type ExampleEntry,
    existingApps,
    listExampleSlugs,
    listMetaSlugs,
    loadExamples,
    readMeta,
    validateMeta,
} from "../scripts/examples-lib.ts";
import type { ExampleMeta } from "../src/meta-types.ts";
import { CATEGORIES } from "../src/meta-types.ts";
import { fakeApp } from "./fake-app.ts";

// Every example's metadata lives once, in src/meta/<slug>.ts, and every framework's app finds its
// examples by its own folders and their metadata by slug: a folder without metadata, or metadata
// that no framework has a folder for, fails here.

let metas: { slug: string; meta: ExampleMeta }[] = [];

beforeAll(async () => {
    metas = await Promise.all(
        listMetaSlugs().map(async (slug) => ({
            slug,
            meta: await readMeta(slug),
        })),
    );
});

describe("the metadata", () => {
    it("is valid for every example", () => {
        expect(metas.length).toBeGreaterThan(0);
    });

    it("belongs to a category, and a meta with an unknown one is rejected", () => {
        for (const { slug, meta } of metas) {
            expect(CATEGORIES, slug).toContain(meta.category);
        }
        const meta = { title: "T", description: "D", order: 1, features: [] };
        expect(() =>
            validateMeta("x", { ...meta, category: "intermediate" }),
        ).toThrow(/category must be one of/);
        expect(() =>
            validateMeta("x", { ...meta, category: "virtualization" }),
        ).not.toThrow();
    });

    it("has unique titles, and unique orders within a category", () => {
        const titles = metas.map(({ meta }) => meta.title);
        expect(new Set(titles).size).toBe(titles.length);
        const orders = metas.map(
            ({ meta }) => `${meta.category}:${meta.order}`,
        );
        expect(new Set(orders).size).toBe(orders.length);
    });

    it("links its guide under /docs/ when it names one", () => {
        for (const { slug, meta } of metas) {
            if (meta.docs) expect(meta.docs, slug).toMatch(/^\/docs\//);
        }
    });
});

describe("the metadata and the framework apps", () => {
    const apps = existingApps();

    it("finds the React app", () => {
        expect(apps.map((app) => app.framework)).toContain("react");
    });

    it("has a file for every example folder of every app", () => {
        const known = new Set(listMetaSlugs());
        for (const app of apps) {
            for (const slug of listExampleSlugs(app)) {
                expect(known.has(slug), `${app.framework}: ${slug}`).toBe(true);
            }
        }
    });

    it("names only examples some app has a folder for", () => {
        const folders = new Set(apps.flatMap((app) => listExampleSlugs(app)));
        for (const slug of listMetaSlugs()) {
            expect(folders.has(slug), slug).toBe(true);
        }
    });

    it("orders each app's examples by category, then order", async () => {
        for (const app of apps) {
            const entries: ExampleEntry[] = await loadExamples(app);
            const keys = entries.map(
                (e) =>
                    CATEGORIES.indexOf(e.meta.category) * 1000 + e.meta.order,
            );
            expect(keys).toEqual([...keys].sort((a, b) => a - b));
        }
    });
});

describe("a framework app", () => {
    let remove = () => {};
    afterEach(() => remove());

    it("finds its examples by its own entry file, and skips `_` folders", () => {
        const fake = fakeApp("vue", {
            "hello-grid/index.vue": "<template />\n",
            "large-dataset/index.tsx": "export default 1;\n",
            "_kit/index.vue": "<template />\n",
        });
        remove = fake.remove;
        expect(listExampleSlugs(fake.app)).toEqual(["hello-grid"]);
    });

    it("fails on a folder that has no metadata", async () => {
        const fake = fakeApp("angular", {
            "no-such-example/index.ts": "export default class {}\n",
        });
        remove = fake.remove;
        await expect(loadExamples(fake.app)).rejects.toThrow(
            /examples\/shared\/src\/meta\/no-such-example\.ts is missing/,
        );
    });

    it("may ship a subset of the examples", async () => {
        const fake = fakeApp("vue", {
            "large-dataset/index.vue": "<template />\n",
            "hello-grid/index.vue": "<template />\n",
        });
        remove = fake.remove;
        const entries = await loadExamples(fake.app);
        // gallery order: getting-started comes before virtualization
        expect(entries.map((e) => e.slug)).toEqual([
            "hello-grid",
            "large-dataset",
        ]);
    });
});
