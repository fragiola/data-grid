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

// The Angular side of the example contract (README of examples/react/src/examples, and `#/`
// imports per §6 of the site export contract): an example is standalone components (`index.ts`
// its entry, exporting the example by default) and `styles.ts`, importing only what a consumer can
// copy; the code panel lists exactly the files it is compiled from, and each example assembles the
// grid itself. The Angular app has every example of examples/react, under the same ids (a complete
// framework in e2e/available.ts: no shared spec skips for Angular), and wears the same classes.

const APP = examplesApp("angular");
const EXAMPLES_DIR = APP.examplesDir;

/** What an example file may import, besides relative files inside examples/. */
const ALLOWED = [
    /^@angular\/[a-z-]+$/,
    // the core's extras only: its main entry's types and helpers come through the Angular package,
    // and so do its features (each re-exported by the Angular package's own entry, Epic #144)
    /^@fragiola\/data-grid\/local$/,
    /^@fragiola\/data-grid-angular(\/(local|sorting|navigation|row-selection|range|clipboard|fill|editing|column-resize|column-reorder|column-pinning|column-group-collapse))?$/,
    /^@lucide\/angular$/,
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

/** A component's inline template: what its `template:` holds. */
const templateOf = (source: string) =>
    /\btemplate:\s*`([^`]*)`/.exec(source)?.[1] ?? "";

let examples: ExampleEntry[] = [];

beforeAll(async () => {
    examples = await loadExamples(APP);
});

describe("the Angular examples", () => {
    it("are all in the manifest, each with valid metadata", () => {
        expect(examples.map((e) => e.slug).sort()).toEqual(
            listExampleSlugs(APP),
        );
    });

    it("are the examples of examples/react, under the same ids: every one, no other", () => {
        // a React example without an Angular counterpart fails here, and its spec fails for Angular
        expect(listExampleSlugs(APP)).toEqual(
            listExampleSlugs(examplesApp("react")),
        );
    });

    it("look like React's: a class string both styles.ts export is the same", async () => {
        // a state function may differ (an Angular part has no `class={(state) => …}`: its looks
        // come from `data-*` or what a template hands), a string never does
        const reactDir = examplesApp("react").examplesDir;
        let compared = 0;
        for (const slug of listExampleSlugs(APP)) {
            const angular: Record<string, unknown> = await import(
                join(EXAMPLES_DIR, slug, "styles.ts")
            );
            const react: Record<string, unknown> = await import(
                join(reactDir, slug, "styles.ts")
            );
            for (const [name, value] of Object.entries(angular)) {
                const original = react[name];
                if (typeof value !== "string" || typeof original !== "string") {
                    continue;
                }
                expect(value, `${slug}/styles.ts: ${name}`).toBe(original);
                compared++;
            }
        }
        expect(compared).toBeGreaterThan(0);
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
            expect(files[0]).toBe(`${example.slug}/index.ts`);
            for (const file of files) {
                const source = readFileSync(join(EXAMPLES_DIR, file), "utf-8");
                for (const specifier of importsOf(source)) {
                    if (!specifier.startsWith(".")) continue;
                    const base = relative(
                        EXAMPLES_DIR,
                        join(EXAMPLES_DIR, file, "..", specifier),
                    );
                    expect(
                        [base, `${base}.ts`].some((candidate) =>
                            files.includes(candidate),
                        ),
                        `${file} → ${specifier}`,
                    ).toBe(true);
                }
            }
        }
    });

    it("assemble the grid themselves: index.ts renders [dataGridRoot] and exports the example", () => {
        for (const slug of listExampleSlugs(APP)) {
            const source = readFileSync(
                join(EXAMPLES_DIR, slug, "index.ts"),
                "utf-8",
            );
            expect(templateOf(source), `${slug}/index.ts`).toMatch(
                /\sdataGridRoot\b/,
            );
            expect(source, `${slug}/index.ts`).toMatch(
                /^export default class /m,
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
                if (!file.endsWith(".ts")) continue;
                const template = templateOf(readFileSync(file, "utf-8"));
                // looks go in styles.ts and are bound: `[class]="styles.part"`
                expect(
                    /\sclass="/.test(template),
                    relative(EXAMPLES_DIR, file),
                ).toBe(false);
                expect(
                    /\[class\]="[^"]*'/.test(template),
                    relative(EXAMPLES_DIR, file),
                ).toBe(false);
            }
        }
    });

    it("use the app's API only: never engine.adapter (an adapter's side)", () => {
        for (const file of walk(EXAMPLES_DIR)) {
            if (!file.endsWith(".ts")) continue;
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
            ).not.toContain("@fragiola/data-grid-angular");
        }
    });
});
