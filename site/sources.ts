// What the export is made of, read from this repo's sources: the pages (site/docs), the project
// (site/project.json), the gallery configuration and each framework's manifest. site/export.ts
// writes them out; the tests validate them in memory.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    type ExamplesApp,
    examplesApp,
} from "../examples/shared/scripts/examples-lib.ts";
import { buildManifest } from "../examples/shared/scripts/manifest.ts";
import {
    FRAMEWORKS,
    type Framework,
    isFramework,
} from "../examples/shared/src/framework.ts";
import {
    CATEGORIES,
    CATEGORY_TITLES,
} from "../examples/shared/src/meta-types.ts";
import { THEMES } from "../examples/shared/src/themes/themes.ts";
import {
    type DocsConfig,
    type ExamplesConfig,
    type Manifest,
    type ProjectInfo,
    readPages,
    type Site,
} from "./contract.ts";

export const SITE_DIR = import.meta.dirname;
export const DOCS_DIR = join(SITE_DIR, "docs");
const THEMES_DIR = join(SITE_DIR, "../examples/shared/src/themes");

const readJson = <T>(file: string): T =>
    JSON.parse(readFileSync(file, "utf-8")) as T;

export function readProject(): ProjectInfo {
    return readJson<ProjectInfo>(join(SITE_DIR, "project.json"));
}

export function readConfig(): DocsConfig {
    return readJson<DocsConfig>(join(DOCS_DIR, "config.json"));
}

/**
 * examples.json: the categories of meta-types.ts (the contract's `levels`) and the themes of
 * themes/themes.ts (both in examples/shared), with their CSS (still published as `_themes/<name>.css`).
 */
export function buildExamplesConfig(): ExamplesConfig {
    return {
        levels: CATEGORIES.map((id) => ({ id, title: CATEGORY_TITLES[id] })),
        themes: THEMES.map((theme) => ({
            name: theme.name,
            title: theme.title,
            description: theme.description,
            scheme: theme.scheme,
            swatch: [...theme.swatch],
            file: {
                path: `_themes/${theme.name}.css`,
                lang: "css",
                content: readFileSync(
                    join(THEMES_DIR, `${theme.name}.css`),
                    "utf-8",
                ),
            },
        })),
    };
}

/**
 * The frameworks project.json ships, each one an app `examples/<framework>` (package
 * `examples-<framework>`). A name that is not a known framework throws.
 */
export function frameworksOf(
    project: Pick<ProjectInfo, "frameworks">,
): Framework[] {
    return project.frameworks.map((framework) => {
        if (!isFramework(framework)) {
            throw new Error(
                `project.json: framework "${framework}" is none of ${FRAMEWORKS.join(", ")}`,
            );
        }
        return framework;
    });
}

/** What site:export builds for one framework: its app, under its own base and directory. */
export interface EmbedBuild {
    framework: Framework;
    /** the workspace package of its app, whose `build` script builds the embed */
    package: string;
    /** `EMBED_BASE`: where the site serves it (`<base>/embed/<framework>/`) */
    base: string;
    /** `EMBED_OUT_DIR`: `<out>/embed/<framework>`, next to its manifest.json */
    dir: string;
}

/** One embed per framework, under `<base>/embed/<framework>/` and `<out>/embed/<framework>`. */
export function embedBuilds(
    frameworks: readonly Framework[],
    base: string,
    out: string,
): EmbedBuild[] {
    return frameworks.map((framework) => ({
        framework,
        package: `examples-${framework}`,
        base: `${base}/embed/${framework}/`,
        dir: join(out, "embed", framework),
    }));
}

/**
 * Each framework's manifest, by framework: one per framework of project.json, built from that
 * framework's app (`appOf`, `examples/<framework>` by default).
 */
export async function buildManifests(
    frameworks: readonly Framework[] = frameworksOf(readProject()),
    appOf: (framework: Framework) => ExamplesApp = examplesApp,
): Promise<Map<string, Manifest>> {
    const manifests = new Map<string, Manifest>();
    for (const framework of frameworks) {
        manifests.set(framework, await buildManifest(appOf(framework)));
    }
    return manifests;
}

/** The whole export, in memory. */
export async function readSite(): Promise<Site> {
    return {
        project: readProject(),
        config: readConfig(),
        pages: readPages(DOCS_DIR),
        examples: buildExamplesConfig(),
        manifests: await buildManifests(),
    };
}
