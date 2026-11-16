import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "@fragiola/data-grid";
import { describe, expect, it } from "vitest";
import { exportedNames } from "../../../scripts/exported-names.ts";
import * as vue from "../src/index";

// The Vue package's surface (Epic #123): the whole core re-exported, every runtime and type name
// of the React package (but the framework-only ones, documented on the Vue API page), and nothing
// imported but vue and the core.

const read = (path: string) =>
    readFileSync(join(import.meta.dirname, "..", path), "utf-8");

/** What only the Vue package exports, and why (the Vue API page). */
const VUE_ONLY = [
    // a Vue template cannot pass a type argument (`<DataGrid.Root<Person>>` in React)
    "typedDataGrid",
];

/** React's names with no Vue counterpart: its element-prop helpers (Vue binds a slot's `props`). */
const REACT_ONLY_TYPES = [
    "DivPrimitiveProps",
    "PrimitiveProps",
    "RenderedProps",
    "RenderProp",
];

// the React package's sources, loaded at run time (a variable path: the Vue typecheck does not
// follow it into React's TSX)
const reactEntry = join(import.meta.dirname, "../../react/src/index.ts");
const react = (await import(reactEntry)) as Record<string, unknown> & {
    DataGrid: Record<string, unknown>;
};

/** Every source file of the package. */
function sources(): string[] {
    const files: string[] = [];
    const walk = (folder: string) => {
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
            const full = join(folder, entry.name);
            if (entry.isDirectory()) walk(full);
            else files.push(full);
        }
    };
    walk(join(import.meta.dirname, "..", "src"));
    return files;
}

describe("@fragiola/data-grid-vue", () => {
    it("re-exports the whole core", () => {
        expect(read("src/index.ts")).toMatch(
            /^export \* from "@fragiola\/data-grid";$/m,
        );
        const exported = new Map(Object.entries(vue));
        for (const [name, value] of Object.entries(core)) {
            expect(exported.get(name), name).toBe(value);
        }
    });

    it("declares no name of its own that the core exports", () => {
        // a local export silently wins over `export *`: it would hide the core's
        const coreNames = new Set([
            ...exportedNames(read("../core/src/index.ts")),
            ...Object.keys(core),
        ]);
        const own = exportedNames(read("src/index.ts"));
        expect(own).toContain("DataGrid");
        expect(own.filter((name) => coreNames.has(name))).toEqual([]);
    });

    it("exports every runtime name of the React package, and only the framework-only ones more", () => {
        const vueNames = new Set(Object.keys(vue));
        expect(
            Object.keys(react).filter((name) => !vueNames.has(name)),
        ).toEqual([]);
        const own = Object.keys(vue).filter(
            (name) => !(name in core) && !(name in react),
        );
        expect(own.sort()).toEqual([...VUE_ONLY].sort());
    });

    it("has the React package's primitives in its DataGrid namespace", () => {
        expect(Object.keys(vue.DataGrid).sort()).toEqual(
            Object.keys(react.DataGrid).sort(),
        );
    });

    it("exports the React package's type names (states, props, infos)", () => {
        const reactTypes = exportedNames(read("../react/src/index.ts")).filter(
            (name) => !REACT_ONLY_TYPES.includes(name),
        );
        const vueTypes = new Set([
            ...exportedNames(read("src/index.ts")),
            ...exportedNames(read("../core/src/index.ts")),
        ]);
        expect(reactTypes.filter((name) => !vueTypes.has(name))).toEqual([]);
    });

    it("never imports React, and imports nothing at runtime but vue and the core", () => {
        const pkg = JSON.parse(read("package.json")) as {
            dependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };
        expect(Object.keys(pkg.dependencies ?? {})).toEqual([
            "@fragiola/data-grid",
        ]);
        expect(Object.keys(pkg.peerDependencies ?? {})).toEqual(["vue"]);
        const IMPORT = /(?:from\s+|import\s*\(\s*)["']([^"'.][^"']*)["']/g;
        for (const file of sources()) {
            for (const [, specifier] of readFileSync(file, "utf8").matchAll(
                IMPORT,
            )) {
                expect(
                    [
                        "vue",
                        "@fragiola/data-grid",
                        "@fragiola/data-grid/local",
                        "@fragiola/data-grid/selection",
                    ],
                    file,
                ).toContain(specifier);
            }
        }
    });
});
