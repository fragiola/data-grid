// Reports the packages' bundle sizes (Epic #62, Q2): every `packages/*/dist/*.js`, raw, gzip and,
// when the build's own minifier is reachable (rolldown, under tsdown), minified + gzip; and the
// chunks each file imports, so an entry point that pulls a shared chunk shows it. A report, never a
// gate: it prints a markdown table (to `$GITHUB_STEP_SUMMARY` too, in CI) and always exits 0. Run
// after `pnpm build`.
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const root = join(import.meta.dirname, "..");

type Minify = (filename: string, code: string) => string;

/** rolldown's minifier, through the tsdown a package builds with; `undefined` when not found. */
async function loadMinify(): Promise<Minify | undefined> {
    try {
        const fromPackage = createRequire(
            join(root, "packages", "core", "package.json"),
        );
        const fromTsdown = createRequire(fromPackage.resolve("tsdown"));
        const { minifySync } = (await import(
            fromTsdown.resolve("rolldown/experimental")
        )) as {
            minifySync: (filename: string, code: string) => { code: string };
        };
        return (filename, code) => minifySync(filename, code).code;
    } catch {
        return undefined;
    }
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

/** The chunks a built file imports (`./name.js`), by file name. */
function chunksOf(source: string): string[] {
    return [...source.matchAll(/from\s*["']\.\/([^"']+\.js)["']/g)].map(
        ([, name]) => name ?? "",
    );
}

async function main() {
    const minify = await loadMinify();
    const lines = [
        "| file | raw | gzip | min + gzip | imports |",
        "| --- | --- | --- | --- | --- |",
    ];
    for (const pkg of readdirSync(join(root, "packages"))) {
        const dist = join(root, "packages", pkg, "dist");
        if (!existsSync(dist)) {
            lines.push(`| packages/${pkg} | not built | | | |`);
            continue;
        }
        for (const name of readdirSync(dist)
            .filter((file) => file.endsWith(".js"))
            .sort()) {
            const source = readFileSync(join(dist, name), "utf8");
            const minified = minify ? minify(name, source) : undefined;
            lines.push(
                `| ${pkg}/${name} | ${kb(Buffer.byteLength(source))} | ${kb(gzipSync(source).length)} | ${minified === undefined ? "n/a" : kb(gzipSync(minified).length)} | ${chunksOf(source).join(", ")} |`,
            );
        }
    }
    const report = [
        "### Bundle sizes",
        "",
        ...lines,
        "",
        minify
            ? "min + gzip: rolldown's minifier, then gzip (a consumer's bundler gets close to it)."
            : "min + gzip: n/a (rolldown's minifier was not found).",
        "",
    ].join("\n");
    process.stdout.write(report);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) appendFileSync(summary, report);
}

await main();
