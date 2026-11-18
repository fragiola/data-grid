// The E2E suites a change can affect (Epic #162): CI's `changes` job runs it and gives the E2E jobs
// its outputs. Only what is known to be safe skips a suite: the docs skip every suite, an
// adapter's package (or its examples app) runs only that adapter's suites, and any other path runs
// them all.
//
//   node scripts/e2e-suites.ts --diff <base>   the files changed between <base> and HEAD
//   node scripts/e2e-suites.ts --all           every suite (a manual run)
//   node scripts/e2e-suites.ts <file>…         the given files (to try the rules locally)
//
// It prints the selection and, in CI, writes `playground` (true | false) and `examples` (a JSON
// array of frameworks) to `$GITHUB_OUTPUT`.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

/** The suites to run: the playground's, and the examples apps' by framework. */
export interface E2eSuites {
    playground: boolean;
    examples: string[];
}

/** What one changed path asks for: nothing, some suites, or every suite. */
type Need = "none" | "all" | { playground: boolean; framework: string };

/** The docs: no suite reads them. */
function isDocs(path: string): boolean {
    return (
        path.startsWith("site/docs/") ||
        path.endsWith(".md") ||
        path === "AGENTS.md"
    );
}

/**
 * What one changed path needs. The playground is a React app: React's package and its examples
 * (which the playground renders in place) run it too. Vue's and Angular's run only their own
 * examples suite. Everything else (the core, examples/shared, the playground, the lockfile, the
 * root configs, .github, scripts, site) runs every suite.
 */
export function needOf(path: string, frameworks: readonly string[]): Need {
    if (isDocs(path)) {
        return "none";
    }
    const match = /^(packages|examples)\/([^/]+)\//.exec(path);
    const framework = match?.[2];
    if (framework !== undefined && frameworks.includes(framework)) {
        return { playground: framework === "react", framework };
    }
    return "all";
}

/** The suites a set of changed paths runs, the frameworks in the order given. */
export function e2eSuites(
    paths: readonly string[],
    frameworks: readonly string[],
): E2eSuites {
    let playground = false;
    const chosen = new Set<string>();
    for (const path of paths) {
        const need = needOf(path, frameworks);
        if (need === "all") {
            return { playground: true, examples: [...frameworks] };
        }
        if (need !== "none") {
            playground ||= need.playground;
            chosen.add(need.framework);
        }
    }
    return {
        playground,
        examples: frameworks.filter((framework) => chosen.has(framework)),
    };
}

/** The frameworks with an examples app: every examples/<framework> with a playwright.config.ts. */
export function examplesFrameworks(): string[] {
    return readdirSync(join(root, "examples"))
        .filter((name) =>
            existsSync(join(root, "examples", name, "playwright.config.ts")),
        )
        .sort();
}

function changedPaths(base: string): string[] {
    return execFileSync("git", ["diff", "--name-only", base, "HEAD"], {
        cwd: root,
        encoding: "utf8",
    })
        .split("\n")
        .filter((path) => path !== "");
}

function main(args: readonly string[]): void {
    const frameworks = examplesFrameworks();
    let suites: E2eSuites;
    if (args[0] === "--all") {
        suites = { playground: true, examples: frameworks };
    } else {
        const paths =
            args[0] === "--diff"
                ? changedPaths(args[1] ?? "HEAD^1")
                : [...args];
        console.log(
            `changed files (${paths.length}):\n  ${paths.join("\n  ")}`,
        );
        suites = e2eSuites(paths, frameworks);
    }
    const outputs = {
        playground: String(suites.playground),
        examples: JSON.stringify(suites.examples),
    };
    const lines = Object.entries(outputs).map(
        ([key, value]) => `${key}=${value}`,
    );
    console.log(lines.join("\n"));
    if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
    }
}

// only when run, not when a test imports it
if (import.meta.main) {
    main(process.argv.slice(2));
}
