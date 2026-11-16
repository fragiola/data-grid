// A framework embed's manifest.json (site export contract v1, §5.3): what the site's gallery lists and
// its code panel shows. Every file is stored once under `files`; an example lists the paths it
// is made of, entry first (examples-lib.ts follows its relative imports, so the code panel shows
// exactly what the example is compiled from). A file used by more than one example is `shared`.

import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { ADAPTER_PACKAGES, CORE_PACKAGE } from "../src/framework.ts";
import { DEFAULT_HEIGHT } from "../src/meta-types.ts";
import { type ExamplesApp, loadExamples } from "./examples-lib.ts";

export interface ManifestFile {
    lang: string;
    content: string;
    shared?: true;
}

export interface ManifestExample {
    id: string;
    title: string;
    description: string;
    /** the example's category id (the contract calls a category a level) */
    level: string;
    order: number;
    features: string[];
    docs?: string;
    layout: "fill" | "flow";
    height: number;
    files: string[];
    registry: string[];
    packages: string[];
}

export interface Manifest {
    files: Record<string, ManifestFile>;
    examples: ManifestExample[];
}

/**
 * The manifest of one framework's app. Every example lists, besides the npm packages it imports
 * itself, the core and its framework's adapter package.
 */
export async function buildManifest(app: ExamplesApp): Promise<Manifest> {
    const entries = await loadExamples(app);
    const uses = new Map<string, number>();
    for (const entry of entries) {
        for (const file of entry.files) {
            uses.set(file, (uses.get(file) ?? 0) + 1);
        }
    }
    const files: Record<string, ManifestFile> = {};
    for (const [path, count] of [...uses].sort(([a], [b]) =>
        a.localeCompare(b),
    )) {
        files[path] = {
            lang: extname(path).slice(1),
            content: readFileSync(join(app.examplesDir, path), "utf-8"),
            ...(count > 1 ? { shared: true as const } : {}),
        };
    }
    const examples = entries.map(
        ({ slug, meta, files, registry, packages }): ManifestExample => ({
            id: slug,
            title: meta.title,
            description: meta.description,
            level: meta.category,
            order: meta.order,
            features: meta.features,
            ...(meta.docs ? { docs: meta.docs } : {}),
            layout: meta.layout ?? "fill",
            height: meta.height ?? DEFAULT_HEIGHT[meta.category],
            files,
            registry,
            packages: [
                CORE_PACKAGE,
                ADAPTER_PACKAGES[app.framework],
                ...packages,
            ],
        }),
    );
    return { files, examples };
}
