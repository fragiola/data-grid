// Fails when the repository leaves the Fragiola source layout: a tracked file or folder whose name
// is not kebab-case, or a source file at the root of a package's `src/` that is not one of its
// entries. Run by `pnpm check` (`check:layout`), over `git ls-files`.
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

/** Names a tool or a convention fixes: they are never renamed. */
export const FIXED_NAMES: ReadonlySet<string> = new Set([
    "README.md",
    "AGENTS.md",
    "CHANGELOG.md",
    "CLAUDE.md",
    "LICENSE",
    "index.html",
    "package.json",
]);

/** The files a package's `src/` may hold at its root: its entries. */
export const SRC_ENTRIES: ReadonlySet<string> = new Set([
    "index.ts",
    "parts.ts",
    "typed.ts",
    "context.ts",
    "public-api.ts",
]);

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Whether one path segment follows the naming rule: kebab-case once its suffixes are removed
 * (`.test.ts`, `.d.ts`, `.directive.ts`, any extension). A leading `.` (`.github`) is a tool's
 * folder or file and is not checked; a leading `_` (`_kit`) marks a folder that is not an example,
 * and the rest of the name is checked.
 */
export function isLayoutName(segment: string): boolean {
    if (FIXED_NAMES.has(segment) || segment.startsWith(".")) {
        return true;
    }
    const name = segment.startsWith("_") ? segment.slice(1) : segment;
    const stem = name.split(".")[0] ?? "";
    return KEBAB.test(stem);
}

/** Whether a tracked path is a non-entry file at the root of a package's `src/`. */
export function isLooseSourceFile(path: string): boolean {
    const match = /^packages\/[^/]+\/src\/([^/]+)$/.exec(path);
    return match?.[1] !== undefined && !SRC_ENTRIES.has(match[1]);
}

/** Every rule a tracked path breaks, as a message naming it. */
export function layoutProblems(paths: readonly string[]): string[] {
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const path of paths) {
        const segments = path.split("/");
        segments.forEach((segment, index) => {
            const prefix = segments.slice(0, index + 1).join("/");
            if (seen.has(prefix)) {
                return;
            }
            seen.add(prefix);
            // a tool's folder (`.github/`) holds names the tool fixes
            if (segments.slice(0, index).some((part) => part.startsWith("."))) {
                return;
            }
            if (!isLayoutName(segment)) {
                problems.push(`${prefix}: not kebab-case`);
            }
        });
        if (isLooseSourceFile(path)) {
            problems.push(
                `${path}: a package's src/ root holds only its entries (${[...SRC_ENTRIES].join(", ")}); move it into a folder named after its responsibility`,
            );
        }
    }
    return problems;
}

function main(): void {
    const paths = execFileSync("git", ["ls-files"], {
        cwd: root,
        encoding: "utf8",
    })
        .split("\n")
        .filter((path) => path !== "");
    const problems = layoutProblems(paths);
    if (problems.length > 0) {
        console.error(
            `The repository leaves the source layout (guidelines: repository.md#source-layout):\n${problems.join("\n")}`,
        );
        process.exit(1);
    }
    console.log(
        `check-layout: ${paths.length} tracked files follow the source layout`,
    );
}

// only when run, not when a test imports it (`import.meta.main` holds through a symlinked path)
if (import.meta.main) {
    main();
}
