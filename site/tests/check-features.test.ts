import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    FEATURES,
    type FeatureMarkers,
    featureLeaks,
    localEntryOf,
    markersOf,
} from "../../scripts/check-features.ts";

// `pnpm build` runs scripts/check-features.ts over every package's built main entry (Epic #141):
// it fails when one ships a feature's code. These pin the check itself on planted builds.

const SORTING: FeatureMarkers = {
    subpath: "sorting",
    markers: ["sort-columns.set", "sort-columns.toggle", "sort-columns"],
};

/** A build of named files: a reader over them, as the guard reads a `dist`. */
function built(files: Record<string, string>) {
    return (name: string) => files[name];
}

const SORTING_JS =
    'const SORTING = { commands: { "sort-columns.toggle": toggle } };\nexport { SORTING };';

describe("the features' bundle guard", () => {
    it("passes a main entry and chunks without any feature's code", () => {
        const read = built({
            "index.js": 'import { a } from "./header-x.js";\nexport { a };',
            "header-x.js": 'export const a = "columns.set";',
            "sorting.js": SORTING_JS,
        });
        expect(featureLeaks("index.js", read, [SORTING])).toEqual([]);
    });

    it("fails when the main entry imports the feature's entry, directly or through a chunk", () => {
        const direct = built({
            "index.js":
                'import { SORTING } from "./sorting.js";\nexport { SORTING };',
            "sorting.js": SORTING_JS,
        });
        expect(featureLeaks("index.js", direct, [SORTING])).toEqual([
            'sorting.js: sorting\'s "sort-columns.toggle"',
        ]);
        const through = built({
            "index.js": 'import "./shared.js";',
            "shared.js": 'export { SORTING } from "./sorting.js";',
            "sorting.js": SORTING_JS,
        });
        expect(featureLeaks("index.js", through, [SORTING])).toHaveLength(1);
    });

    it("fails on an adapter's import of a feature's entry point, and on a marker inlined", () => {
        const adapter = built({
            "index.js":
                'import { sorting } from "@fragiola/data-grid/sorting";\nexport { sorting };',
        });
        expect(featureLeaks("index.js", adapter, [SORTING])).toEqual([
            "index.js: imports the sorting entry",
        ]);
        const deep = built({
            "index.js": 'import "@fragiola/data-grid-react/sorting/index.js";',
        });
        expect(featureLeaks("index.js", deep, [SORTING])).toHaveLength(1);
        const inlined = built({
            "fesm.mjs": "model.run('sort-columns.set', payload);",
        });
        expect(featureLeaks("fesm.mjs", inlined, [SORTING])).toEqual([
            'fesm.mjs: sorting\'s "sort-columns.set"',
        ]);
    });

    it("reads a feature's markers from what it contributes", () => {
        expect(
            markersOf({
                commands: { "sort-columns.set": 1, "sort-columns.toggle": 1 },
                queries: { "sort-columns": 1 },
                questions: { "column-sortable": 1 },
            }),
        ).toEqual([
            "sort-columns.set",
            "sort-columns.toggle",
            "sort-columns",
            "column-sortable",
        ]);
    });

    it("lists every feature, filtering, search and pagination included (Epic #153)", () => {
        expect(FEATURES.map((feature) => feature.subpath)).toEqual(
            expect.arrayContaining(["filtering", "search", "pagination"]),
        );
    });

    it("finds each package's /local entry, tsdown's or ng-packagr's, and fails on a feature in it", () => {
        const tsdown = mkdtempSync(join(tmpdir(), "guard-"));
        writeFileSync(join(tsdown, "local.js"), "");
        expect(localEntryOf(tsdown, "@fragiola/data-grid")).toBe("local.js");
        const ng = mkdtempSync(join(tmpdir(), "guard-"));
        mkdirSync(join(ng, "fesm2022"));
        writeFileSync(
            join(ng, "fesm2022", "fragiola-data-grid-angular-local.mjs"),
            "",
        );
        expect(localEntryOf(ng, "@fragiola/data-grid-angular")).toBe(
            "fesm2022/fragiola-data-grid-angular-local.mjs",
        );
        expect(localEntryOf(tsdown, "@fragiola/x-angular")).toBe("local.js");
        const FILTERING: FeatureMarkers = {
            subpath: "filtering",
            markers: ["column-filters.set"],
        };
        const local = built({
            "local.js": 'model.run("column-filters.set", { columnFilters });',
        });
        expect(featureLeaks("local.js", local, [FILTERING])).toEqual([
            'local.js: filtering\'s "column-filters.set"',
        ]);
    });
});
