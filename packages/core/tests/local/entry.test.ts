import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The local pipeline is opt-in (Epic #47, L2): nothing the grid's own entry imports, however
// deep, reaches `src/local`, so an app that never imports `/local` never ships it.

const src = join(import.meta.dirname, "../../src");

/** The files a module imports, followed through relative imports. */
function reachable(entry: string): Set<string> {
    const seen = new Set<string>();
    const visit = (file: string) => {
        if (seen.has(file)) return;
        seen.add(file);
        const source = readFileSync(file, "utf8");
        for (const [, specifier] of source.matchAll(
            /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g,
        )) {
            const base = resolve(dirname(file), specifier ?? "");
            const target = [
                `${base}.ts`,
                `${base}.tsx`,
                join(base, "index.ts"),
            ].find(existsSync);
            if (target) visit(target);
        }
    };
    visit(entry);
    return seen;
}

describe("the grid's own entry", () => {
    it("never reaches the local pipeline", () => {
        const files = [...reachable(join(src, "index.ts"))].map((file) =>
            relative(src, file),
        );
        expect(files.length).toBeGreaterThan(5);
        expect(files.filter((file) => file.startsWith("local"))).toEqual([]);
    });
});
