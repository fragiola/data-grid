import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "@fragiola/data-grid";
import { describe, expect, it } from "vitest";
import { exportedNames } from "../../../scripts/exported-names.ts";
import * as angular from "../src/public-api";

// The Angular package's surface (Epic #129): the whole core re-exported, every runtime name and
// primitive of the React package mapped to its Angular name (the mapping below, documented on the
// Angular API page), the framework-only names listed, and nothing imported but Angular and the
// core.

const read = (path: string) =>
    readFileSync(join(import.meta.dirname, "..", path), "utf-8");

/** A React primitive (a component of `DataGrid.*`) is a directive named `DataGrid<Name>`. */
const directiveOf = (name: string) => `DataGrid${name}`;

/** A React hook `use<Name>` is the injection function `inject<Name>`, but these. */
const HOOKS: Readonly<Record<string, string>> = {
    // a field of a component, or a module's constant: one function in Angular
    useDataGridRef: "createDataGridRef",
};
const hookOf = (name: string) => HOOKS[name] ?? name.replace(/^use/, "inject");

/** React's other runtime names, by their Angular names. */
const RENAMED: Readonly<Record<string, string>> = {
    // the namespace of primitives: the directives array a component imports
    DataGrid: "DATA_GRID",
};

/** The Angular name of a React runtime name. */
function angularNameOf(name: string, primitives: ReadonlySet<string>): string {
    if (RENAMED[name]) return RENAMED[name];
    if (primitives.has(name)) return directiveOf(name);
    if (/^use[A-Z]/.test(name)) return hookOf(name);
    return name;
}

/**
 * What only the Angular package exports, and why (the Angular API page): the parts React gives as
 * hooks on the app's element are directives on it, a cell's default content is a directive, and
 * a column renderer's template comes with its context.
 */
const ANGULAR_ONLY = [
    // a cell's default content (React renders it without children)
    "DataGridCellContent",
    // the parts React gives through a hook's props (Angular cannot spread props)
    "DataGridColumnResizer",
    "DataGridRowDragHandle",
    "DataGridFillHandle",
    "DataGridGroupToggle",
    "DataGridGroupLabel",
    "DataGridCellEdit",
    // an injection function's props on an element of the app's
    "DataGridBind",
    // a column renderer's template, typed, and its context
    "DataGridTemplate",
    "templateContent",
    "contextOf",
];

/** React's type names with no Angular counterpart: its element props (a directive's inputs). */
const REACT_ONLY_TYPES = [
    "DivPrimitiveProps",
    "PrimitiveProps",
    "RenderedProps",
    "RenderProp",
];

// the React package's sources, loaded at run time (a variable path: the Angular typecheck does
// not follow it into React's TSX)
const reactEntry = join(import.meta.dirname, "../../react/src/index.ts");
const react = (await import(/* @vite-ignore */ reactEntry)) as Record<
    string,
    unknown
> & { DataGrid: Record<string, unknown> };

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

describe("@fragiola/data-grid-angular", () => {
    it("re-exports the whole core", () => {
        expect(read("src/public-api.ts")).toMatch(
            /^export \* from "@fragiola\/data-grid";$/m,
        );
        const exported = new Map(Object.entries(angular));
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
        const own = exportedNames(read("src/public-api.ts"));
        expect(own).toContain("DATA_GRID");
        expect(own.filter((name) => coreNames.has(name))).toEqual([]);
    });

    it("has every React primitive as a directive, in DATA_GRID", () => {
        const primitives = Object.keys(react.DataGrid);
        const directives = new Set<unknown>(angular.DATA_GRID);
        for (const name of primitives) {
            const directive = (angular as Record<string, unknown>)[
                directiveOf(name)
            ];
            expect(directive, directiveOf(name)).toBeTypeOf("function");
            expect(directives.has(directive), directiveOf(name)).toBe(true);
        }
    });

    it("maps every runtime name of the React package, and has only the Angular-only ones more", () => {
        const primitives = new Set(Object.keys(react.DataGrid));
        const names = new Set(Object.keys(angular));
        // React's primitives are its namespace's; Angular's directives are its own exports
        const mapped = new Set([...primitives].map(directiveOf));
        for (const name of Object.keys(react)) {
            const angularName = angularNameOf(name, primitives);
            mapped.add(angularName);
            expect(names.has(angularName), `${name} → ${angularName}`).toBe(
                true,
            );
        }
        const own = Object.keys(angular).filter(
            (name) => !(name in core) && !mapped.has(name),
        );
        expect(own.sort()).toEqual([...ANGULAR_ONLY].sort());
    });

    it("exports the React package's type names (states, infos), but its element props", () => {
        const reactTypes = exportedNames(read("../react/src/index.ts")).filter(
            (name) =>
                !REACT_ONLY_TYPES.includes(name) &&
                !(
                    name.endsWith("Props") &&
                    name.slice(0, -5) in react.DataGrid
                ),
        );
        const primitives = new Set(Object.keys(react.DataGrid));
        const angularTypes = new Set([
            ...exportedNames(read("src/public-api.ts")),
            ...exportedNames(read("../core/src/index.ts")),
        ]);
        expect(
            reactTypes
                .map((name) => angularNameOf(name, primitives))
                .filter((name) => !angularTypes.has(name)),
        ).toEqual([]);
    });

    it("maps the opt-in entries: /local, /selection and /sorting", async () => {
        const reactLocal = await import(
            /* @vite-ignore */ join(
                import.meta.dirname,
                "../../react/src/local/index.ts",
            )
        );
        const reactSelection = await import(
            /* @vite-ignore */ join(
                import.meta.dirname,
                "../../react/src/selection/index.ts",
            )
        );
        const reactSorting = await import(
            /* @vite-ignore */ join(
                import.meta.dirname,
                "../../react/src/sorting/index.ts",
            )
        );
        const local = await import("../src/local/index");
        const selection = await import("../src/selection/index");
        const sorting = await import("../src/sorting/index");
        const map = (names: string[]) => names.map((name) => hookOf(name));
        expect(Object.keys(local).sort()).toEqual(
            [...map(Object.keys(reactLocal)), "DataGridLocalRows"].sort(),
        );
        expect(Object.keys(selection).sort()).toEqual(
            map(Object.keys(reactSelection)).sort(),
        );
        // the root's sort inputs: React's `Root` props, typed by `sorting()`
        expect(Object.keys(sorting).sort()).toEqual(
            [...map(Object.keys(reactSorting)), "DataGridSorting"].sort(),
        );
        // the same functions as the core's
        for (const name of Object.keys(reactSorting)) {
            expect((sorting as Record<string, unknown>)[name], name).toBe(
                reactSorting[name],
            );
        }
        // and its types (`SortColumn`, `SortingProps`, …)
        const sortingTypes = new Set(
            exportedNames(read("src/sorting/index.ts")),
        );
        expect(
            exportedNames(read("../react/src/sorting/index.ts")).filter(
                (name) => !sortingTypes.has(name),
            ),
        ).toEqual([]);
    });

    it("never imports another framework, and imports nothing at runtime but Angular and the core", () => {
        const pkg = JSON.parse(read("package.json")) as {
            dependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };
        expect(Object.keys(pkg.dependencies ?? {})).toEqual([
            "@fragiola/data-grid",
        ]);
        expect(Object.keys(pkg.peerDependencies ?? {})).toEqual([
            "@angular/core",
        ]);
        const IMPORT = /(?:from\s+|import\s*\(\s*)["']([^"'.][^"']*)["']/g;
        for (const file of sources()) {
            for (const [, specifier] of readFileSync(file, "utf8").matchAll(
                IMPORT,
            )) {
                expect(
                    [
                        "@angular/core",
                        "@fragiola/data-grid",
                        "@fragiola/data-grid/local",
                        "@fragiola/data-grid/selection",
                        "@fragiola/data-grid/sorting",
                        // the opt-in entries import the main one by its name
                        "@fragiola/data-grid-angular",
                    ],
                    file,
                ).toContain(specifier);
            }
        }
    });

    it("keeps the main entry free of the opt-in ones", () => {
        for (const file of sources().filter(
            (path) => !/[/\\](local|selection|sorting)[/\\]/.test(path),
        )) {
            expect(readFileSync(file, "utf8"), file).not.toMatch(
                /from "@fragiola\/data-grid(\/local|\/selection|\/sorting|-angular)"/,
            );
        }
    });
});
