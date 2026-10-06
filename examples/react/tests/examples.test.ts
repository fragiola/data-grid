import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
    collectFiles,
    EXAMPLES_DIR,
    type ExampleEntry,
    importsOf,
    listExampleSlugs,
    loadExamples,
    validateMeta,
} from "../scripts/examples-lib.ts";
import { CATEGORIES } from "../src/examples/meta-types.ts";

// The example contract (README, and `#/` imports per §6 of the site export contract): every
// example has a valid meta.ts, is in the manifest, imports only what a consumer can copy, the
// code panel lists exactly the files it is compiled from, and each example assembles the grid
// itself: `_kit/` is shared demo content and app logic only.

/** What an example file may import, besides relative files inside examples/. */
const ALLOWED = [
    /^react$/,
    /^react-dom$/,
    /^@fragiola\/data-grid(\/(local|selection|fill))?$/,
    /^@fragiola\/data-grid-react(\/(local|selection))?$/,
    /^lucide-react$/,
    /^#\/components\/(ui|atoms)\/[a-z-]+$/,
    /^#\/lib\/cn$/,
];

/** Site files under examples/ that are not example code. */
const SITE_FILES = [
    /^[a-z-]+\/meta\.ts$/,
    /^meta-types\.ts$/,
    /\.generated\.ts$/,
    /^_themes\/themes\.ts$/,
    /\.md$/,
    /\.css$/,
];

const KIT = join(EXAMPLES_DIR, "_kit");

/**
 * Where an example's `.tsx` styles itself instead of reading `styles.ts`: a class string on a
 * `className`, a string inside a `className={…}` expression, or a `cn()` call. Returns each
 * offending snippet.
 */
function inlineClasses(source: string): string[] {
    const found: string[] = [];
    for (const match of source.matchAll(/\bcn\(/g)) {
        found.push(source.slice(match.index, match.index + 40));
    }
    for (const match of source.matchAll(/\bclassName=/g)) {
        const start = match.index + match[0].length;
        const open = source[start];
        if (open === '"' || open === "'") {
            found.push(source.slice(match.index, match.index + 60));
            continue;
        }
        if (open !== "{") continue;
        // the expression up to its matching brace
        let depth = 0;
        let end = start;
        for (; end < source.length; end++) {
            if (source[end] === "{") depth++;
            else if (source[end] === "}" && --depth === 0) break;
        }
        const expression = source.slice(start + 1, end);
        if (/["'`]/.test(expression)) {
            found.push(`className={${expression.slice(0, 60)}}`);
        }
    }
    return found;
}

function walk(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

let examples: ExampleEntry[] = [];

beforeAll(async () => {
    examples = await loadExamples();
});

describe("the examples", () => {
    it("are all in the manifest, each with a valid meta", () => {
        expect(examples.map((e) => e.slug).sort()).toEqual(listExampleSlugs());
    });

    it("each belong to a category, and a meta with an unknown one is rejected", () => {
        for (const example of examples) {
            expect(CATEGORIES, example.slug).toContain(example.meta.category);
        }
        const meta = { title: "T", description: "D", order: 1, features: [] };
        expect(() =>
            validateMeta("x", { ...meta, category: "intermediate" }),
        ).toThrow(/category must be one of/);
        expect(() =>
            validateMeta("x", { ...meta, category: "virtualization" }),
        ).not.toThrow();
    });

    it("have unique titles and orders within a category", () => {
        const titles = examples.map((e) => e.meta.title);
        expect(new Set(titles).size).toBe(titles.length);
        const orders = examples.map(
            (e) => `${e.meta.category}:${e.meta.order}`,
        );
        expect(new Set(orders).size).toBe(orders.length);
    });

    it("link their guide under /docs/ when they name one", () => {
        for (const example of examples) {
            if (example.meta.docs) {
                expect(example.meta.docs, example.slug).toMatch(/^\/docs\//);
            }
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
            const { files } = collectFiles(example.slug);
            expect(example.files).toEqual(files);
            expect(files[0]).toBe(`${example.slug}/index.tsx`);
            // closure: every relative import of a listed file is listed too
            for (const file of files) {
                const source = readFileSync(join(EXAMPLES_DIR, file), "utf-8");
                const relativeImports = importsOf(source).filter((s) =>
                    s.startsWith("."),
                );
                for (const specifier of relativeImports) {
                    const resolved = files.some((listed) => {
                        const base = join(file, "..", specifier);
                        return [base, `${base}.ts`, `${base}.tsx`].some(
                            (candidate) =>
                                relative(
                                    EXAMPLES_DIR,
                                    join(EXAMPLES_DIR, candidate),
                                ) === listed,
                        );
                    });
                    expect(resolved, `${file} → ${specifier}`).toBe(true);
                }
            }
        }
    });

    it("assemble the grid themselves: index.tsx renders <DataGrid.Root>", () => {
        for (const slug of listExampleSlugs()) {
            const source = readFileSync(
                join(EXAMPLES_DIR, slug, "index.tsx"),
                "utf-8",
            );
            expect(source, `${slug}/index.tsx`).toMatch(/<DataGrid\.Root\b/);
        }
    });

    it("keep their classes in styles.ts: no class string or cn() in a .tsx", () => {
        for (const slug of listExampleSlugs()) {
            expect(
                statSync(join(EXAMPLES_DIR, slug, "styles.ts"), {
                    throwIfNoEntry: false,
                })?.isFile(),
                `${slug}/styles.ts`,
            ).toBe(true);
            for (const file of walk(join(EXAMPLES_DIR, slug))) {
                if (!file.endsWith(".tsx")) continue;
                const source = readFileSync(file, "utf-8");
                expect(
                    inlineClasses(source),
                    relative(EXAMPLES_DIR, file),
                ).toEqual([]);
            }
        }
    });

    it("finds inline classes the styles.ts rule forbids", () => {
        expect(inlineClasses('<div className="flex" />')).toHaveLength(1);
        expect(inlineClasses("<div className={cn(a, b)} />")).toHaveLength(1);
        expect(
            inlineClasses('<div className={on ? "a" : styles.b} />'),
        ).toHaveLength(1);
        expect(inlineClasses("<div className={`x`} />")).toHaveLength(1);
        expect(
            inlineClasses(
                "<div className={styles.cell} /><p className={styles.dot(tone)} />",
            ),
        ).toEqual([]);
    });

    it("use the app's API only: never engine.adapter (an adapter's side)", () => {
        for (const file of walk(EXAMPLES_DIR)) {
            if (!/\.(ts|tsx)$/.test(file)) continue;
            const source = readFileSync(file, "utf-8");
            expect(source, relative(EXAMPLES_DIR, file)).not.toMatch(
                /\.adapter\b/,
            );
        }
    });
});

describe("the kit", () => {
    it("renders no DataGrid primitive: the examples assemble the grid", () => {
        for (const file of walk(KIT)) {
            const source = readFileSync(file, "utf-8");
            expect(
                importsOf(source),
                relative(EXAMPLES_DIR, file),
            ).not.toContain("@fragiola/data-grid-react");
        }
    });

    it("holds no styles: classes live in each example's styles.ts", () => {
        for (const file of walk(KIT)) {
            if (!file.endsWith(".tsx")) continue;
            expect(
                inlineClasses(readFileSync(file, "utf-8")),
                relative(EXAMPLES_DIR, file),
            ).toEqual([]);
        }
    });
});
