import {
    mkdirSync,
    mkdtempSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    ADAPTERS,
    corePinProblem,
    exportProblems,
    findTarballs,
    publishedExportsProblems,
    relativeTo,
    servedImports,
    tarballsOption,
    unlistedPackages,
    withoutSource,
} from "../../scripts/check-package.ts";
import { SOURCE_CONDITION } from "../../scripts/source-condition.ts";

// From Dockable (fragiola/dockable, site/tests/check-package.test.ts), same author and licence.
// `pnpm check:package` runs scripts/check-package.ts over the packed packages.
describe("the packed package check", () => {
    const published = {
        ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js",
            default: "./dist/index.js",
        },
        "./package.json": "./package.json",
    };
    const repo = {
        ".": { [SOURCE_CONDITION]: "./src/index.ts", ...published["."] },
        "./package.json": "./package.json",
    };

    it("accepts dist-only exports with the types, import and default conditions", () => {
        expect(exportProblems(published)).toEqual([]);
    });

    it("rejects any other condition, and a target outside dist", () => {
        expect(
            exportProblems({
                ".": {
                    "@fragiola/source": "./src/index.ts",
                    development: "./dist/index.js",
                    "@acme/anything": "./dist/index.js",
                    import: "./dist/index.js",
                },
            }),
        ).toEqual([
            'exports["."]: the "@fragiola/source" condition is published',
            'exports["."]["@fragiola/source"]: "./src/index.ts" is not in dist',
            'exports["."]: the "development" condition is published',
            'exports["."]: the "@acme/anything" condition is published',
        ]);
        expect(exportProblems(undefined)).toHaveLength(1);
    });

    it("takes the published exports for the repo's, without the source condition", () => {
        expect(withoutSource(repo)).toEqual(published);
        expect(publishedExportsProblems(repo, published)).toEqual([]);
    });

    it("finds published exports that drifted from the repo's", () => {
        const { default: _, ...noDefault } = published["."];
        expect(
            publishedExportsProblems(repo, { ...published, ".": noDefault }),
        ).toHaveLength(1);
        expect(
            publishedExportsProblems(repo, {
                ...published,
                "./extra": "./dist/extra.js",
            }),
        ).toHaveLength(1);
        expect(
            publishedExportsProblems(repo, {
                ".": { ...published["."], import: "./dist/other.js" },
                "./package.json": "./package.json",
            }),
        ).toHaveLength(1);
    });

    it("takes a package packed from its build output as publishing that directory's files", () => {
        // ng-packagr's output: packed from dist (publishConfig.directory), targets relative to it
        const angularRepo = {
            ".": {
                [SOURCE_CONDITION]: "./src/public-api.ts",
                types: "./dist/types/x.d.ts",
                default: "./dist/fesm2022/x.mjs",
            },
            "./package.json": "./package.json",
        };
        const packed = {
            ".": { types: "./types/x.d.ts", default: "./fesm2022/x.mjs" },
            "./package.json": "./package.json",
        };
        expect(
            publishedExportsProblems(relativeTo(angularRepo, "dist"), packed),
        ).toEqual([]);
        const files = new Set(["./types/x.d.ts", "./fesm2022/x.mjs"]);
        expect(
            exportProblems(packed, "exports", (target) => files.has(target)),
        ).toEqual([]);
        expect(
            exportProblems(
                { ".": { default: "./src/public-api.ts" } },
                "exports",
                (target) => files.has(target),
            ),
        ).toHaveLength(1);
        // a package packed from its folder keeps its dist targets
        expect(relativeTo(published, "out")).toEqual(published);
    });

    it("lists the absolute imports of a module the dev server served", () => {
        expect(
            servedImports(
                'import "/@vite/client";\nimport { DataGrid } from "/node_modules/.vite/deps/x.js?v=1";\nimport React from "react";',
            ),
        ).toEqual(["/@vite/client", "/node_modules/.vite/deps/x.js?v=1"]);
    });

    it("reads the tarballs directory of --tarballs, and nothing else", () => {
        expect(tarballsOption([])).toBeUndefined();
        expect(tarballsOption(["--tarballs", "out"])).toBe("out");
        expect(tarballsOption(["--tarballs=out"])).toBe("out");
        expect(() => tarballsOption(["--tarballs"])).toThrow();
        expect(() => tarballsOption(["--tarballs", "--other"])).toThrow();
        expect(() => tarballsOption(["--tarballs="])).toThrow();
        expect(() => tarballsOption(["out"])).toThrow();
    });

    it("finds the tarballs at any depth of a directory, as changeset pack writes them", () => {
        const dir = mkdtempSync(join(tmpdir(), "data-grid-tarballs-"));
        try {
            mkdirSync(join(dir, "packages"));
            writeFileSync(join(dir, "publish-plan.json"), "{}");
            writeFileSync(join(dir, "packages", "b-0.1.0.tgz"), "");
            writeFileSync(join(dir, "packages", "a-0.1.0.tgz"), "");
            writeFileSync(join(dir, "packages", "notes.txt"), "");
            expect(findTarballs(dir)).toEqual([
                join(dir, "packages", "a-0.1.0.tgz"),
                join(dir, "packages", "b-0.1.0.tgz"),
            ]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

// Every package under packages/ but the core is an adapter, and each adapter is checked the same
// way: its exact core pin and its own smoke app.
describe("the adapters the package check covers", () => {
    it("are every package of packages/ but the core, React first", () => {
        const dirs = readdirSync(join(import.meta.dirname, "../../packages"));
        expect(unlistedPackages(dirs)).toEqual([]);
        expect(ADAPTERS.map((adapter) => adapter.dir).sort()).toEqual(
            dirs.filter((dir) => dir !== "core").sort(),
        );
        expect(ADAPTERS[0]?.dir).toBe("react");
    });

    it("smoke-test each adapter with its own framework's app", () => {
        expect(ADAPTERS.map(({ dir, framework }) => [dir, framework])).toEqual([
            ["react", "react"],
            ["vue", "vue"],
            ["angular", "angular"],
        ]);
    });

    it("finds a package that is neither the core nor a listed adapter", () => {
        const dirs = ["core", "react", "solid"];
        expect(unlistedPackages(dirs)).toEqual(["solid"]);
        expect(
            unlistedPackages(dirs, [
                ...ADAPTERS,
                { dir: "solid", framework: "react", smoke: async () => {} },
            ]),
        ).toEqual([]);
    });

    it("require each adapter to pin the core at its exact version", () => {
        const adapter = (pin?: string) => ({
            name: "@fragiola/data-grid-vue",
            ...(pin ? { dependencies: { "@fragiola/data-grid": pin } } : {}),
        });
        expect(corePinProblem(adapter("1.2.3"), "1.2.3")).toBeUndefined();
        expect(corePinProblem(adapter("^1.2.3"), "1.2.3")).toBe(
            '@fragiola/data-grid-vue depends on the core at "^1.2.3", not at 1.2.3',
        );
        expect(corePinProblem(adapter(), "1.2.3")).toMatch(/"undefined"/);
    });
});
