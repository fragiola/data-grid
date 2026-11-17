// After `ng-packagr` built `dist`: the package is packed from its own folder (`files: ["dist"]`,
// the published exports in `publishConfig.exports`, as every package of the repo), so the
// manifests ng-packagr writes into `dist` (the entry's, its secondary entries' and its
// `.npmignore`) are not the published ones. They go, and the bundles are checked:
// they import nothing at run time but Angular, the core and the package itself (ng-packagr would
// list `tslib`, which the partial compilation output never imports: ES2022 classes, no
// decorators).
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const dist = join(import.meta.dirname, "..", "dist");

/** The bare specifiers a bundle imports. */
export function importsOf(source: string): string[] {
    return [
        ...source.matchAll(/(?:from\s*|import\s*\(\s*)["']([^"'.][^"']*)["']/g),
    ].map(([, specifier]) => specifier ?? "");
}

/** The opt-in entries: ng-packagr's secondary entries, and the core's they re-export. */
const ENTRIES = [
    "local",
    "navigation",
    "row-selection",
    "range",
    "clipboard",
    "fill",
    "sorting",
];

const ALLOWED = new RegExp(
    `^(@angular/core|@fragiola/data-grid(/(${ENTRIES.join("|")}))?|@fragiola/data-grid-angular)$`,
);

function main() {
    for (const file of [
        "package.json",
        ".npmignore",
        ...ENTRIES.map((entry) => `${entry}/package.json`),
    ]) {
        rmSync(join(dist, file), { force: true });
    }
    for (const folder of ENTRIES) {
        rmSync(join(dist, folder), { recursive: true, force: true });
    }
    const folder = join(dist, "fesm2022");
    for (const name of readdirSync(folder).filter((file) =>
        file.endsWith(".mjs"),
    )) {
        for (const specifier of importsOf(
            readFileSync(join(folder, name), "utf8"),
        )) {
            if (!ALLOWED.test(specifier)) {
                throw new Error(`dist/fesm2022/${name} imports ${specifier}`);
            }
        }
    }
    console.log(
        "check-dist: the manifests of dist removed, the bundles' imports checked",
    );
}

if (import.meta.main) {
    main();
}
