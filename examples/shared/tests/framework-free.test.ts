import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { importsOf, SHARED_ROOT } from "../scripts/examples-lib.ts";

// This package is what every framework's examples share: it must import no framework, no adapter
// and nothing a framework app brings (its UI, its icons). The generated loaders name the
// framework only as text.

const FRAMEWORK_IMPORT =
    /^(react|react-dom|vue|@vue\/|@angular\/|@fragiola\/data-grid|lucide-react|@lucide\/|@base-ui|reka-ui|#\/)/;

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        if (name === "node_modules" || name.startsWith(".")) return [];
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

describe("examples-shared", () => {
    it("imports no framework", () => {
        const files = walk(SHARED_ROOT).filter((file) => /\.tsx?$/.test(file));
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            const framework = importsOf(readFileSync(file, "utf-8")).filter(
                (specifier) => FRAMEWORK_IMPORT.test(specifier),
            );
            expect(framework, relative(SHARED_ROOT, file)).toEqual([]);
        }
    });

    it("is private and depends on no framework", () => {
        const manifest = JSON.parse(
            readFileSync(join(SHARED_ROOT, "package.json"), "utf-8"),
        ) as {
            private?: boolean;
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };
        expect(manifest.private).toBe(true);
        const names = Object.keys({
            ...manifest.dependencies,
            ...manifest.devDependencies,
        });
        expect(names.filter((name) => FRAMEWORK_IMPORT.test(name))).toEqual([]);
    });

    it("finds a framework import, written any way", () => {
        const source = [
            'import { ref } from "vue";',
            'import type { ComponentType } from "react";',
            'export { DataGrid } from "@fragiola/data-grid-react";',
        ].join("\n");
        expect(
            importsOf(source).filter((s) => FRAMEWORK_IMPORT.test(s)),
        ).toHaveLength(3);
    });
});
