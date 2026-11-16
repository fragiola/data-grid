import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { SOURCE_CONDITION } from "../../scripts/source-condition.ts";

// In the workspace every package resolves to its sources through the `@fragiola/source` export
// condition (the first key of each entry); what is published is `publishConfig.exports`, which
// pnpm puts in place of `exports` when it packs: the same subpaths, pointing at `dist` only.

const PACKAGES = join(import.meta.dirname, "../../packages");

type Entry = string | Record<string, string>;

interface Manifest {
    name: string;
    exports: Record<string, Entry>;
    publishConfig?: { exports?: Record<string, Entry> };
}

const packages = readdirSync(PACKAGES).map((dir) => ({
    dir: join(PACKAGES, dir),
    manifest: JSON.parse(
        readFileSync(join(PACKAGES, dir, "package.json"), "utf-8"),
    ) as Manifest,
}));

/** The paths an entry points at, `./package.json` aside. */
const targets = (entry: Entry): string[] =>
    typeof entry === "string" ? [] : Object.values(entry);

const temp = mkdtempSync(join(tmpdir(), "data-grid-pack-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

/** The package.json inside the tarball `pnpm pack` makes of a package. */
function packedManifest(dir: string, name: string): Manifest {
    const destination = mkdtempSync(join(temp, `${name.replace("/", "-")}-`));
    execFileSync("pnpm", ["pack", "--pack-destination", destination], {
        cwd: dir,
        stdio: "ignore",
    });
    const [tarball] = readdirSync(destination);
    if (!tarball) throw new Error(`${name}: pnpm pack made no tarball`);
    return JSON.parse(
        execFileSync("tar", [
            "-xzOf",
            join(destination, tarball),
            "package/package.json",
        ]).toString("utf-8"),
    ) as Manifest;
}

describe.each(packages)("$manifest.name", ({ dir, manifest }) => {
    it("resolves to its sources in the workspace, through the source condition first", () => {
        for (const [subpath, entry] of Object.entries(manifest.exports)) {
            if (typeof entry === "string") continue;
            expect(Object.keys(entry)[0], subpath).toBe(SOURCE_CONDITION);
            expect(entry[SOURCE_CONDITION], subpath).toMatch(/^\.\/src\//);
            expect(Object.keys(entry), subpath).not.toContain("development");
        }
    });

    it("publishes the same subpaths, pointing at dist only", () => {
        const published = manifest.publishConfig?.exports ?? {};
        expect(Object.keys(published)).toEqual(Object.keys(manifest.exports));
        for (const [subpath, entry] of Object.entries(published)) {
            if (typeof entry === "string") {
                expect(entry, subpath).toBe("./package.json");
                continue;
            }
            expect(Object.keys(entry), subpath).toEqual([
                "types",
                "import",
                "default",
            ]);
            for (const target of targets(entry)) {
                expect(target, subpath).toMatch(/^\.\/dist\//);
            }
        }
    });

    it("is packed with the published exports in place of the workspace's", () => {
        const packed = packedManifest(dir, manifest.name);
        expect(packed.exports).toEqual(manifest.publishConfig?.exports);
        expect(JSON.stringify(packed)).not.toContain(SOURCE_CONDITION);
        expect(JSON.stringify(packed)).not.toContain("./src/");
    });
});
