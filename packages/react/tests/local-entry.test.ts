import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// `useLocalRows` is opt-in (Epic #47, L2): nothing the primitives' entry imports, however deep,
// reaches `src/local` or the core's `/local`, so an app that never imports `/local` never ships it.
// The features are opt-in the same way: `/sorting` (Epic #141), `/navigation`, `/row-selection`,
// `/range`, `/clipboard` and `/fill` (Epic #144), each its own entry re-exporting the core's.

const src = join(import.meta.dirname, "../src");

/** The files a module imports through relative imports, and every package it names. */
function reachable(entry: string): {
    files: Set<string>;
    packages: Set<string>;
} {
    const files = new Set<string>();
    const packages = new Set<string>();
    const visit = (file: string) => {
        if (files.has(file)) return;
        files.add(file);
        const source = readFileSync(file, "utf8");
        for (const [, specifier = ""] of source.matchAll(
            /(?:from|import)\s*\(?\s*["']([^"']+)["']/g,
        )) {
            if (!specifier.startsWith(".")) {
                packages.add(specifier);
                continue;
            }
            const base = resolve(dirname(file), specifier);
            const target = [
                `${base}.ts`,
                `${base}.tsx`,
                join(base, "index.ts"),
            ].find(existsSync);
            if (target) visit(target);
        }
    };
    visit(entry);
    return { files, packages };
}

/** The opt-in entries: rows in memory and the features. */
const EXTRAS = [
    "local",
    "sorting",
    "navigation",
    "row-selection",
    "range",
    "clipboard",
    "fill",
    "editing",
    "column-resize",
    "column-reorder",
    "column-pinning",
    "column-group-collapse",
    "row-expansion",
    "row-grouping",
    "row-reorder",
    "spans",
    "summary-rows",
    "filtering",
    "search",
    "pagination",
];

describe("the primitives' entry", () => {
    it("never reaches the opt-in extras: rows in memory, the features", () => {
        const { files, packages } = reachable(join(src, "index.ts"));
        const names = [...files].map((file) => relative(src, file));
        expect(names.length).toBeGreaterThan(5);
        for (const extra of EXTRAS) {
            expect(names.filter((file) => file.startsWith(extra))).toEqual([]);
            expect(
                [...packages].filter((name) => name.endsWith(`/${extra}`)),
            ).toEqual([]);
        }
    });
});

describe("the opt-in entries", () => {
    const manifest = JSON.parse(
        readFileSync(join(import.meta.dirname, "../package.json"), "utf8"),
    ) as {
        exports: Record<string, Record<string, string>>;
        publishConfig: { exports: Record<string, Record<string, string>> };
    };

    it("are each a subpath, its source first, and published from dist", () => {
        for (const extra of EXTRAS) {
            const entry = manifest.exports[`./${extra}`];
            expect(Object.keys(entry ?? {})[0]).toBe("@fragiola/source");
            expect(entry?.["@fragiola/source"]).toBe(`./src/${extra}/index.ts`);
            expect(existsSync(join(src, extra, "index.ts"))).toBe(true);
            expect(manifest.publishConfig.exports[`./${extra}`]).toEqual({
                types: `./dist/${extra}.d.ts`,
                import: `./dist/${extra}.js`,
                default: `./dist/${extra}.js`,
            });
        }
        // `/selection` is `/row-selection` since Epic #144, with no alias
        expect(manifest.exports["./selection"]).toBeUndefined();
    });

    it("re-export the core's feature entry of the same name", () => {
        for (const extra of EXTRAS.filter((name) => name !== "local")) {
            expect(reachable(join(src, extra, "index.ts")).packages).toContain(
                `@fragiola/data-grid/${extra}`,
            );
        }
    });
});

describe("the local entry", () => {
    it("never reaches a feature's entry: it hands their state to the root (Epic #153)", () => {
        const { packages } = reachable(join(src, "local", "index.ts"));
        const features = EXTRAS.filter((name) => name !== "local");
        expect(
            [...packages].filter((name) =>
                features.some((feature) => name.endsWith(`/${feature}`)),
            ),
        ).toEqual([]);
    });
});
