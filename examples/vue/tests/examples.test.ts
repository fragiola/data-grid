import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
    collectFiles,
    type ExampleEntry,
    examplesApp,
    importsOf,
    listExampleSlugs,
    loadExamples,
} from "examples-shared/scripts/examples-lib";
import { beforeAll, describe, expect, it } from "vitest";

// The Vue side of the example contract (README of examples/react/src/examples, and `#/` imports
// per §6 of the site export contract): an example is single-file components (`index.vue` its
// entry) and `styles.ts`, importing only what a consumer can copy; the code panel lists exactly the
// files it is compiled from, and each example assembles the grid itself. The Vue app ships a subset
// of examples/react's examples while it is written (e2e/available.ts): never one React lacks.

const APP = examplesApp("vue");
const EXAMPLES_DIR = APP.examplesDir;

/** What an example file may import, besides relative files inside examples/. */
const ALLOWED = [
    /^vue$/,
    // the core's extras only: its main entry's types and helpers come through the Vue package
    /^@fragiola\/data-grid\/(local|selection|fill)$/,
    /^@fragiola\/data-grid-vue(\/(local|selection))?$/,
    /^@lucide\/vue$/,
    /^#\/components\/(ui|atoms)\/[a-z-]+$/,
    /^#\/lib\/cn$/,
];

/** Site files under examples/ that are not example code. */
const SITE_FILES = [/\.generated\.ts$/, /\.md$/, /\.css$/];

function walk(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

/** A `.vue` file's template: what follows its `<template>` tag. */
const templateOf = (source: string) =>
    source.slice(Math.max(0, source.indexOf("<template>")));

let examples: ExampleEntry[] = [];

beforeAll(async () => {
    examples = await loadExamples(APP);
});

describe("the Vue examples", () => {
    it("are all in the manifest, each with valid metadata", () => {
        expect(examples.map((e) => e.slug).sort()).toEqual(
            listExampleSlugs(APP),
        );
    });

    it("are examples of examples/react, under the same ids", () => {
        const react = listExampleSlugs(examplesApp("react"));
        for (const slug of listExampleSlugs(APP)) {
            expect(react, slug).toContain(slug);
        }
    });

    it("import only what a consumer can copy", () => {
        const files = walk(EXAMPLES_DIR)
            .map((file) => relative(EXAMPLES_DIR, file))
            .filter(
                (file) => !SITE_FILES.some((pattern) => pattern.test(file)),
            );
        for (const file of files) {
            const source = readFileSync(join(EXAMPLES_DIR, file), "utf-8");
            for (const specifier of importsOf(source)) {
                if (specifier.startsWith(".")) continue;
                expect(
                    ALLOWED.some((pattern) => pattern.test(specifier)),
                    `${file} imports "${specifier}"`,
                ).toBe(true);
            }
        }
    });

    it("show in the code panel exactly the files they are compiled from", () => {
        for (const example of examples) {
            const { files } = collectFiles(APP, example.slug);
            expect(example.files).toEqual(files);
            expect(files[0]).toBe(`${example.slug}/index.vue`);
            for (const file of files) {
                const source = readFileSync(join(EXAMPLES_DIR, file), "utf-8");
                for (const specifier of importsOf(source)) {
                    if (!specifier.startsWith(".")) continue;
                    const base = relative(
                        EXAMPLES_DIR,
                        join(EXAMPLES_DIR, file, "..", specifier),
                    );
                    expect(
                        [base, `${base}.ts`, `${base}.vue`].some((candidate) =>
                            files.includes(candidate),
                        ),
                        `${file} → ${specifier}`,
                    ).toBe(true);
                }
            }
        }
    });

    it("assemble the grid themselves: index.vue renders <DataGrid.Root>", () => {
        for (const slug of listExampleSlugs(APP)) {
            const source = readFileSync(
                join(EXAMPLES_DIR, slug, "index.vue"),
                "utf-8",
            );
            expect(templateOf(source), `${slug}/index.vue`).toMatch(
                /<DataGrid\.Root\b/,
            );
        }
    });

    it("keep their classes in styles.ts: no class string in a template", () => {
        for (const slug of listExampleSlugs(APP)) {
            expect(
                statSync(join(EXAMPLES_DIR, slug, "styles.ts"), {
                    throwIfNoEntry: false,
                })?.isFile(),
                `${slug}/styles.ts`,
            ).toBe(true);
            for (const file of walk(join(EXAMPLES_DIR, slug))) {
                if (!file.endsWith(".vue")) continue;
                const template = templateOf(readFileSync(file, "utf-8"));
                // looks go in styles.ts and are bound: `:class="styles.part"`
                expect(
                    /\sclass="/.test(template),
                    relative(EXAMPLES_DIR, file),
                ).toBe(false);
                expect(
                    /:class="[^"]*['`]/.test(template),
                    relative(EXAMPLES_DIR, file),
                ).toBe(false);
            }
        }
    });

    it("use the app's API only: never engine.adapter (an adapter's side)", () => {
        for (const file of walk(EXAMPLES_DIR)) {
            if (!/\.(ts|vue)$/.test(file)) continue;
            expect(
                readFileSync(file, "utf-8"),
                relative(EXAMPLES_DIR, file),
            ).not.toMatch(/\.adapter\b/);
        }
    });
});

describe("the kit", () => {
    it("renders no DataGrid primitive: the examples assemble the grid", () => {
        for (const file of walk(join(EXAMPLES_DIR, "_kit"))) {
            expect(
                importsOf(readFileSync(file, "utf-8")),
                relative(EXAMPLES_DIR, file),
            ).not.toContain("@fragiola/data-grid-vue");
        }
    });
});
