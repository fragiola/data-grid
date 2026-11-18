// The features' bundle guard (Epic #141): a feature not imported is not in the app's bundle. Fails
// when the main entry of a package (`packages/*/dist/index.js`, or ng-packagr's
// `dist/fesm2022/<package>.mjs`), or a chunk it imports, holds a feature's code: one of the
// markers a feature names (its command, `get` and `is` keys, read from the built feature itself)
// or an import of a feature's entry point (`@fragiola/data-grid…/sorting`). Run by `pnpm build`,
// after the packages built.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chunksOf } from "./built-files.ts";

const root = join(import.meta.dirname, "..");

/**
 * The features: each one's entry point (its subpath, in every package that has it) and its
 * factory, exported by the core's built entry of that name.
 */
export const FEATURES = [
    { subpath: "sorting", factory: "sorting" },
    { subpath: "navigation", factory: "navigation" },
    { subpath: "row-selection", factory: "rowSelection" },
    { subpath: "range", factory: "cellRange" },
    { subpath: "clipboard", factory: "clipboard" },
    { subpath: "fill", factory: "fillHandle" },
    { subpath: "editing", factory: "editing" },
    { subpath: "column-resize", factory: "columnResize" },
    { subpath: "column-reorder", factory: "columnReorder" },
    { subpath: "column-pinning", factory: "columnPinning" },
    { subpath: "column-group-collapse", factory: "columnGroupCollapse" },
    { subpath: "row-expansion", factory: "rowExpansion" },
    { subpath: "row-grouping", factory: "rowGrouping" },
    { subpath: "row-reorder", factory: "rowReorder" },
    { subpath: "spans", factory: "cellSpans" },
    { subpath: "summary-rows", factory: "summaryRows" },
] as const;

/** A feature as the guard reads it: its subpath and the markers its code holds. */
export interface FeatureMarkers {
    readonly subpath: string;
    readonly markers: readonly string[];
}

/** What a built feature names: its commands, its `get` and `is` keys. */
export function markersOf(feature: {
    readonly commands?: object;
    readonly queries?: object;
    readonly questions?: object;
}): string[] {
    return [
        ...Object.keys(feature.commands ?? {}),
        ...Object.keys(feature.queries ?? {}),
        ...Object.keys(feature.questions ?? {}),
    ];
}

/** Each feature's markers, from the core's build (`packages/core/dist/<subpath>.js`). */
async function builtMarkers(): Promise<FeatureMarkers[]> {
    return Promise.all(
        FEATURES.map(async ({ subpath, factory }) => {
            const entry = join(
                root,
                "packages",
                "core",
                "dist",
                `${subpath}.js`,
            );
            const module = (await import(pathToFileURL(entry).href)) as Record<
                string,
                () => object
            >;
            const make = module[factory];
            if (typeof make !== "function") {
                throw new Error(`${entry} exports no ${factory}()`);
            }
            return { subpath, markers: markersOf(make()) };
        }),
    );
}

/** An import of a feature's entry point, from any package: `@fragiola/<package>/<subpath>`. */
function importsSubpath(source: string, subpath: string): boolean {
    return new RegExp(
        `(?:from|import)\\s*\\(?\\s*["']@fragiola/[\\w-]+/${subpath}(?:/[^"']*)?["']`,
    ).test(source);
}

/**
 * The feature code a main entry holds, through the chunks it imports: one line per marker or
 * feature import found, with the file it is in. `read` gives a built file's source by its name,
 * relative to the entry's folder (`undefined` for none).
 */
export function featureLeaks(
    main: string,
    read: (name: string) => string | undefined,
    features: readonly FeatureMarkers[],
): string[] {
    const leaks: string[] = [];
    const seen = new Set<string>();
    const visit = (name: string) => {
        if (seen.has(name)) return;
        seen.add(name);
        const source = read(name);
        if (source === undefined) return;
        for (const { subpath, markers } of features) {
            if (importsSubpath(source, subpath)) {
                leaks.push(`${name}: imports the ${subpath} entry`);
            }
            for (const marker of markers) {
                if (
                    source.includes(`"${marker}"`) ||
                    source.includes(`'${marker}'`)
                ) {
                    leaks.push(`${name}: ${subpath}'s "${marker}"`);
                }
            }
        }
        for (const chunk of chunksOf(source)) visit(chunk);
    };
    visit(main);
    return leaks;
}

/** A package's main entry, relative to its `dist`: tsdown's or ng-packagr's. */
export function mainEntryOf(
    dist: string,
    packageName: string,
): string | undefined {
    if (existsSync(join(dist, "index.js"))) return "index.js";
    const fesm = `fesm2022/${packageName.replace(/^@/, "").replace("/", "-")}.mjs`;
    return existsSync(join(dist, fesm)) ? fesm : undefined;
}

async function main() {
    const features = await builtMarkers();
    const problems: string[] = [];
    for (const pkg of readdirSync(join(root, "packages"))) {
        const dir = join(root, "packages", pkg);
        const dist = join(dir, "dist");
        const name = (
            JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
                name: string;
            }
        ).name;
        const main = existsSync(dist) ? mainEntryOf(dist, name) : undefined;
        if (!main) {
            problems.push(`packages/${pkg}: no built main entry`);
            continue;
        }
        const folder = join(dist, main.includes("/") ? "fesm2022" : "");
        const read = (file: string) => {
            const path = join(folder, file.replace(/^fesm2022\//, ""));
            return existsSync(path) ? readFileSync(path, "utf8") : undefined;
        };
        for (const leak of featureLeaks(main, read, features)) {
            problems.push(`packages/${pkg}/dist/${leak}`);
        }
    }
    if (problems.length > 0) {
        console.error(
            `A main entry ships a feature's code (a feature must stay in its own entry):\n${problems.join("\n")}`,
        );
        process.exit(1);
    }
    console.log(
        `check-features: no package's main entry ships ${features.map((feature) => feature.subpath).join(", ")}`,
    );
}

if (process.argv[1] === import.meta.filename) {
    await main();
}
