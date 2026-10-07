// Vendors Fragiola UI registry items into this app, the way a consumer gets them.
//
//   node scripts/vendor-fragiola.ts [item…]
//
// Fragiola UI is a copy-paste library (shadcn registry format): there is no package to
// install. Each item is a JSON file listing its files (with their content and a target) and its
// registry dependencies. This script resolves the dependencies transitively, writes every file
// to its target under src/ (what `#/` points at), and prepends a header naming the source.
//
// - Targets use the shadcn aliases (`@ui/select.tsx`, `@lib/cn.ts`, `@components/atoms/…`), a
//   `~/` root, or a plain path (`styles/global.css`); all land under src/.
// - Dependencies are namespaced (`@fragiola/field`) or full URLs; a bare name is read from the
//   same registry, as older items wrote them.
// - The items import each other through `@/…`; examples import through `#/…` (the site export
//   contract reserves `@name` for packages), so the vendored files are rewritten to `#/…` too.
//
// The registry is read from FRAGIOLA_REGISTRY (a URL or a local `public/r` directory),
// defaulting to the deployed one. The vendored files are committed: the build never fetches.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

interface RegistryFile {
    path: string;
    target: string;
    content: string;
}

interface RegistryItem {
    name: string;
    dependencies?: string[];
    registryDependencies?: string[];
    files: RegistryFile[];
}

const REGISTRY = (
    process.env.FRAGIOLA_REGISTRY ?? "https://fragiola.com/r"
).replace(/\/$/, "");
const NAMESPACE = "@fragiola/";
const SRC = resolve(import.meta.dirname, "../src");

/** The items the examples use. Their registry dependencies come along. */
const DEFAULT_ITEMS = [
    "theme",
    "palette-surface",
    "palette-raised",
    "palette-blue",
    "palette-orange",
    "palette-green",
    "palette-danger",
    "palette-purple",
    "palette-rose",
    "avatar",
    "badge",
    "checkbox",
    "clickable",
    "context-menu",
    "field",
    "input",
    "select",
    "separator",
    "skeleton",
    "switch",
    "tooltip",
];

/** The shadcn target aliases, as the registry writes them, and where they land under src/. */
const TARGET_ALIASES: [prefix: string, dir: string][] = [
    ["@ui/", "components/ui/"],
    ["@components/", "components/"],
    ["@lib/", "lib/"],
    ["@hooks/", "hooks/"],
    ["~/", ""],
];

/** Where a dependency is read from: a full URL as is, anything else from the registry. */
function locate(dependency: string): string {
    if (/^https?:/.test(dependency)) return dependency;
    const name = dependency.startsWith(NAMESPACE)
        ? dependency.slice(NAMESPACE.length)
        : dependency;
    return `${REGISTRY}/${name}.json`;
}

async function fetchItem(location: string): Promise<RegistryItem> {
    const text = /^https?:/.test(location)
        ? await fetch(location).then(async (response) => {
              if (!response.ok) {
                  throw new Error(`${location}: HTTP ${response.status}`);
              }
              return response.text();
          })
        : await readFile(location, "utf-8");
    try {
        return JSON.parse(text) as RegistryItem;
    } catch {
        throw new Error(
            `${location}: not a registry item (set FRAGIOLA_REGISTRY to a registry that serves one)`,
        );
    }
}

function targetPath(target: string): string {
    for (const [prefix, dir] of TARGET_ALIASES) {
        if (target.startsWith(prefix)) {
            return `${dir}${target.slice(prefix.length)}`;
        }
    }
    return target;
}

function header(file: RegistryFile, source: string): string {
    const text = `Vendored from the Fragiola UI registry (${source}, source ${file.path}). Do not edit: re-run scripts/vendor-fragiola.ts.`;
    return file.target.endsWith(".css") ? `/* ${text} */\n` : `// ${text}\n`;
}

/** `@/x` → `#/x` in import specifiers (static, re-exports and dynamic). */
function toHashImports(content: string): string {
    return content.replace(/(["'])@\//g, "$1#/");
}

/** Keeps a leading "use client" directive first, as React requires. */
function withHeader(file: RegistryFile, source: string): string {
    const content = toHashImports(file.content);
    const directive = /^(["'])use client\1;?\n/.exec(content);
    if (directive) {
        return `${directive[0]}${header(file, source)}${content.slice(directive[0].length)}`;
    }
    return `${header(file, source)}${content}`;
}

async function main() {
    const requested = process.argv.slice(2);
    const queue = (requested.length > 0 ? requested : DEFAULT_ITEMS).map(
        locate,
    );
    const seen = new Set<string>();
    const names = new Set<string>();
    const npm = new Set<string>();
    while (queue.length > 0) {
        const location = queue.shift();
        if (location === undefined || seen.has(location)) continue;
        seen.add(location);
        const item = await fetchItem(location);
        names.add(item.name);
        for (const dep of item.dependencies ?? []) npm.add(dep);
        queue.push(...(item.registryDependencies ?? []).map(locate));
        for (const file of item.files) {
            const target = join(SRC, targetPath(file.target));
            if (!target.startsWith(SRC)) {
                throw new Error(`${location}: ${file.target} leaves src/`);
            }
            await mkdir(dirname(target), { recursive: true });
            await writeFile(target, withHeader(file, location));
        }
    }
    console.log(
        `vendored ${names.size} items: ${[...names].sort().join(", ")}`,
    );
    console.log(`npm dependencies: ${[...npm].sort().join(", ")}`);
}

await main();
