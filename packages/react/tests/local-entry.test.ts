import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// `useLocalRows` is opt-in (Epic #47, L2): nothing the primitives' entry imports, however deep,
// reaches `src/local` or the core's `/local`, so an app that never imports `/local` never ships it.

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

describe("the primitives' entry", () => {
    it("never reaches the opt-in extras: rows in memory, the selection's", () => {
        const { files, packages } = reachable(join(src, "index.ts"));
        const names = [...files].map((file) => relative(src, file));
        expect(names.length).toBeGreaterThan(5);
        for (const extra of ["local", "selection"]) {
            expect(names.filter((file) => file.startsWith(extra))).toEqual([]);
            expect(
                [...packages].filter((name) => name.endsWith(`/${extra}`)),
            ).toEqual([]);
        }
    });
});
