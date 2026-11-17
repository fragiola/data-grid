// A package's built files and the chunks each imports: what the size report lists and the
// features' bundle guard walks (scripts/size-report.ts, scripts/check-features.ts).
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** The chunks a built file imports (`./name.js`, `./name.mjs`), by file name. */
export function chunksOf(source: string): string[] {
    return [
        ...source.matchAll(
            /(?:from|import)\s*\(?\s*["']\.\/([^"']+\.m?js)["']/g,
        ),
    ].map(([, name]) => name ?? "");
}

/** A package's built files, relative to its `dist`: tsdown's `*.js`, ng-packagr's `fesm2022/*.mjs`. */
export function builtFiles(dist: string): string[] {
    const fesm = join(dist, "fesm2022");
    return [
        ...readdirSync(dist).filter((file) => file.endsWith(".js")),
        ...(existsSync(fesm)
            ? readdirSync(fesm)
                  .filter((file) => file.endsWith(".mjs"))
                  .map((file) => `fesm2022/${file}`)
            : []),
    ].sort();
}
