// Fails when a package's built declarations (`packages/*/dist/**/*.d.ts`) use `any`: the public
// types are typed end to end. Run by `pnpm build`, after the packages built.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

/** Declaration text with comments and string literals blanked out, so only types are scanned. */
export function codeOnly(source: string): string {
    return source.replace(
        /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g,
        (match) => (match.startsWith("/") ? "" : '""'),
    );
}

/** The lines of a declaration file that use `any`. */
export function anyUses(source: string): string[] {
    return codeOnly(source)
        .split("\n")
        .filter((line) => /(?<![\w$])any(?![\w$])/.test(line))
        .map((line) => line.trim());
}

function main() {
    const problems: string[] = [];
    for (const pkg of readdirSync(join(root, "packages"))) {
        const dist = join(root, "packages", pkg, "dist");
        if (!existsSync(dist)) {
            problems.push(`packages/${pkg}: not built (no dist)`);
            continue;
        }
        for (const file of listFiles(dist).filter((f) => f.endsWith(".d.ts"))) {
            for (const line of anyUses(readFileSync(file, "utf8"))) {
                problems.push(`${file.slice(root.length + 1)}: ${line}`);
            }
        }
    }
    if (problems.length > 0) {
        console.error(
            `The public declarations use \`any\`:\n${problems.join("\n")}`,
        );
        process.exit(1);
    }
    console.log("check-dts: no `any` in the built declarations");
}

if (process.argv[1] === import.meta.filename) {
    main();
}
