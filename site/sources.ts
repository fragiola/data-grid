// What the export is made of, read from this repo's sources: the pages (site/docs), the project
// (site/project.json), the gallery configuration and each framework's manifest. site/export.ts
// writes them out; the tests validate them in memory.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildManifest } from "../examples/react/scripts/manifest.ts";
import { THEMES } from "../examples/react/src/examples/_themes/themes.ts";
import {
    CATEGORIES,
    CATEGORY_TITLES,
} from "../examples/react/src/examples/meta-types.ts";
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
const THEMES_DIR = join(SITE_DIR, "../examples/react/src/examples/_themes");

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
 * _themes/themes.ts, with their CSS.
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

/** Each framework's manifest, by framework. */
export async function buildManifests(): Promise<Map<string, Manifest>> {
    return new Map([["react", await buildManifest()]]);
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
