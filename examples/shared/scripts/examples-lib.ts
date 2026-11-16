// Shared by scripts/generate.ts, scripts/manifest.ts, the tests and the e2e helpers: finds a
// framework app's examples, reads their metadata (src/meta/<slug>.ts, one file per example, shared
// by every framework), and computes the files each one is made of by following its relative
// imports. What the code panel shows is exactly this list.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
    ENTRY_FILES,
    FRAMEWORKS,
    type Framework,
    ICON_PACKAGES,
} from "../src/framework.ts";
import { CATEGORIES, type ExampleMeta, LAYOUTS } from "../src/meta-types.ts";

/** examples/shared */
export const SHARED_ROOT = resolve(import.meta.dirname, "..");
/** examples/: one app per framework, and this package */
export const EXAMPLES_ROOT = resolve(SHARED_ROOT, "..");
/** Every example's metadata, `<slug>.ts`, whatever the framework. */
export const META_DIR = join(SHARED_ROOT, "src", "meta");

/** A framework's examples app, `examples/<framework>`, and where its examples live. */
export interface ExamplesApp {
    framework: Framework;
    /** the app's directory */
    root: string;
    /** what `#/` points at: the examples, and the UI files vendored next to them */
    src: string;
    /** `src/examples`: one folder per example, plus the `_` ones (the kit) */
    examplesDir: string;
    /** the file an example's folder is found by (`index.tsx`, `index.vue`, `index.ts`) */
    entry: string;
}

export function examplesApp(
    framework: Framework,
    root: string = join(EXAMPLES_ROOT, framework),
): ExamplesApp {
    const src = join(root, "src");
    return {
        framework,
        root,
        src,
        examplesDir: join(src, "examples"),
        entry: ENTRY_FILES[framework],
    };
}

/** The framework apps this repository has (`examples/<framework>/package.json`). */
export function existingApps(): ExamplesApp[] {
    return FRAMEWORKS.filter((framework) =>
        existsSync(join(EXAMPLES_ROOT, framework, "package.json")),
    ).map((framework) => examplesApp(framework));
}

export interface ExampleEntry {
    slug: string;
    meta: ExampleMeta;
    /** the example's source files, relative to examples/, entry first */
    files: string[];
    /** the Fragiola UI registry items it imports (install them with the registry CLI) */
    registry: string[];
    /** other npm packages it imports directly */
    packages: string[];
}

/** Every folder of the app's examples with its entry file, except the `_` ones (the kit). */
export function listExampleSlugs(app: ExamplesApp): string[] {
    if (!existsSync(app.examplesDir)) return [];
    return readdirSync(app.examplesDir)
        .filter((name) => !name.startsWith("_"))
        .filter((name) => statSync(join(app.examplesDir, name)).isDirectory())
        .filter((name) => existsSync(join(app.examplesDir, name, app.entry)))
        .sort();
}

/** Every example that has metadata (src/meta/<slug>.ts), in any framework. */
export function listMetaSlugs(): string[] {
    return readdirSync(META_DIR)
        .filter((name) => name.endsWith(".ts"))
        .map((name) => name.slice(0, -".ts".length))
        .sort();
}

/** Throws with a readable message when a meta.ts is not an ExampleMeta. */
export function validateMeta(slug: string, value: unknown): ExampleMeta {
    const fail = (why: string): never => {
        throw new Error(`examples/shared/src/meta/${slug}.ts: ${why}`);
    };
    if (!value || typeof value !== "object") fail("no default export object");
    const meta = value as Record<string, unknown>;
    if (typeof meta.title !== "string" || !meta.title)
        fail("title is required");
    if (typeof meta.description !== "string" || !meta.description) {
        fail("description is required");
    }
    if (!CATEGORIES.includes(meta.category as never)) {
        fail(`category must be one of ${CATEGORIES.join(", ")}`);
    }
    if (typeof meta.order !== "number") fail("order must be a number");
    if (
        !Array.isArray(meta.features) ||
        !meta.features.every((f) => typeof f === "string")
    ) {
        fail("features must be a string array");
    }
    if (meta.docs !== undefined && typeof meta.docs !== "string") {
        fail("docs must be a string");
    }
    if (meta.layout !== undefined && !LAYOUTS.includes(meta.layout as never)) {
        fail(`layout must be one of ${LAYOUTS.join(", ")}`);
    }
    if (
        meta.height !== undefined &&
        (typeof meta.height !== "number" || meta.height <= 0)
    ) {
        fail("height must be a positive number");
    }
    return meta as unknown as ExampleMeta;
}

export async function readMeta(slug: string): Promise<ExampleMeta> {
    const file = join(META_DIR, `${slug}.ts`);
    if (!existsSync(file)) {
        throw new Error(
            `${slug}: examples/shared/src/meta/${slug}.ts is missing`,
        );
    }
    const module = (await import(pathToFileURL(file).href)) as {
        default?: unknown;
    };
    return validateMeta(slug, module.default);
}

// Statements start a line (so an import written inside a string, e.g. a demo file's
// contents, is not taken for one); dynamic imports can appear anywhere.
const SPECIFIER =
    /^\s*(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gm;

/** The module specifiers a source file imports (static, re-exports and dynamic). */
export function importsOf(source: string): string[] {
    const specifiers: string[] = [];
    for (const match of source.matchAll(SPECIFIER)) {
        const specifier = match[1] ?? match[2];
        if (specifier) specifiers.push(specifier);
    }
    return specifiers;
}

function resolveRelative(from: string, specifier: string): string | undefined {
    const base = resolve(dirname(from), specifier);
    const candidates = [
        base,
        `${base}.tsx`,
        `${base}.ts`,
        `${base}.vue`,
        join(base, "index.tsx"),
        join(base, "index.ts"),
    ];
    return candidates.find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    );
}

/**
 * The Fragiola UI registry item a vendored import comes from (`#/components/ui/select` →
 * `select`, `#/components/atoms/fields` → `input`). Read from the header that
 * scripts/vendor-fragiola.ts writes on every vendored file, so it is exact.
 */
export function registryItemOf(
    app: ExamplesApp,
    specifier: string,
): string | undefined {
    if (!specifier.startsWith("#/")) return undefined;
    const base = join(app.src, specifier.slice(2));
    const file = [
        `${base}.tsx`,
        `${base}.ts`,
        join(base, "index.tsx"),
        join(base, "index.ts"),
    ].find((candidate) => existsSync(candidate));
    if (!file) return undefined;
    const header = readFileSync(file, "utf-8").slice(0, 400);
    return /registry \([^)]*\/r\/([a-z0-9-]+)\.json/.exec(header)?.[1];
}

/**
 * The example's files: its entry file and everything reachable through relative imports, all
 * inside the app's examples/. Returned relative to examples/, the entry first, the rest sorted.
 * `packages` are the npm packages it imports that the consumer installs themselves (the icons:
 * not the framework, not the data grid, not a registry item's own dependency).
 */
export function collectFiles(
    app: ExamplesApp,
    slug: string,
): {
    files: string[];
    registry: string[];
    packages: string[];
} {
    const ownPackages = new Set([ICON_PACKAGES[app.framework]]);
    const entry = join(app.examplesDir, slug, app.entry);
    const seen = new Set<string>();
    const registry = new Set<string>();
    const packages = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
        const file = queue.shift();
        if (file === undefined || seen.has(file)) continue;
        seen.add(file);
        for (const specifier of importsOf(readFileSync(file, "utf-8"))) {
            if (specifier.startsWith(".")) {
                const target = resolveRelative(file, specifier);
                if (!target) {
                    throw new Error(
                        `${relative(app.root, file)}: cannot resolve "${specifier}"`,
                    );
                }
                if (!target.startsWith(app.examplesDir)) {
                    throw new Error(
                        `${relative(app.root, file)}: "${specifier}" leaves examples/`,
                    );
                }
                queue.push(target);
            } else if (ownPackages.has(specifier)) {
                packages.add(specifier);
            } else {
                const item = registryItemOf(app, specifier);
                if (item) registry.add(item);
            }
        }
    }
    const [first, ...rest] = [...seen].map((file) =>
        relative(app.examplesDir, file),
    );
    return {
        files: first === undefined ? [] : [first, ...rest.sort()],
        registry: [...registry].sort(),
        packages: [...packages].sort(),
    };
}

/** The app's examples with their metadata, in gallery order (category, order, slug). */
export async function loadExamples(app: ExamplesApp): Promise<ExampleEntry[]> {
    const entries: ExampleEntry[] = [];
    for (const slug of listExampleSlugs(app)) {
        const meta = await readMeta(slug);
        entries.push({ slug, meta, ...collectFiles(app, slug) });
    }
    return entries.sort(
        (a, b) =>
            CATEGORIES.indexOf(a.meta.category) -
                CATEGORIES.indexOf(b.meta.category) ||
            a.meta.order - b.meta.order ||
            a.slug.localeCompare(b.slug),
    );
}
