import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The Fragiola UI theme (the base stylesheet, the palettes) and `cn` are vendored into
// examples/react by its scripts/vendor-fragiola.ts; this app copies them, so its examples wear the
// React ones' classes. A copy is the original with its first line (the vendoring header) replaced.
// The kit's demo data is framework-free: copied whole (only what these examples use, until Epic
// #132 brings the others).

const here = join(import.meta.dirname, "..");
const react = join(here, "..", "react");

function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

const COPIES = [
    ...listFiles(join(here, "src/styles")),
    join(here, "src/lib/cn.ts"),
].map((file) => relative(here, file));

/** The original of a copy: the same path. */
const originalOf = (file: string) => file;

/** The kit files copied as they are: this app's modules of examples/react's `_kit`. */
const KIT = readdirSync(join(here, "src/examples/_kit")).map(
    (name) => `src/examples/_kit/${name}`,
);

const body = (source: string) => source.slice(source.indexOf("\n") + 1);
const read = (root: string, file: string) =>
    readFileSync(join(root, file), "utf8");

describe("the files copied from examples/react", () => {
    it.each(COPIES)("%s", (file) => {
        const copy = read(here, file);
        expect(copy.split("\n")[0]).toContain(
            `Copied from examples/react/${originalOf(file)}`,
        );
        expect(body(copy)).toBe(body(read(react, originalOf(file))));
    });

    it.each(KIT)("%s", (file) => {
        expect(read(here, file)).toBe(read(react, file));
    });

    it("cover every palette examples/react vendors", () => {
        const names = (dir: string) => readdirSync(dir).sort();
        expect(names(join(here, "src/styles/palettes"))).toEqual(
            names(join(react, "src/styles/palettes")),
        );
    });
});
