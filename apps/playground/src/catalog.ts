import type { ComponentType } from "react";
import {
    CATEGORIES,
    CATEGORY_TITLES,
    type ExampleLayout,
    type ExampleMeta,
} from "#/examples/meta-types";
import type { ItemRef, Kind } from "./view";

// Everything the playground can show, read where it lives. Components and sources are loaded
// only when shown.
//
//   examples   examples/react/src/examples/<slug>/ (index.tsx + meta.ts), the site's gallery:
//              public, contract-bound; there is no second list here
//   fixtures   fixtures/<name>/index.html, the unstyled pages Playwright drives: links out

export type SourceFile = {
    /** Where the file lives, from the repository root. */
    path: string;
    /** The file, verbatim. */
    load: () => Promise<string>;
};

export type Entry = {
    kind: Kind;
    id: string;
    title: string;
    /** Group key and title in the sidebar. */
    group: string;
    groupTitle: string;
    /** One line under the title. */
    description?: string;
    features: string[];
    /** `fill` stretches to the stage; `flow` takes its content's height. */
    layout: ExampleLayout;
    load: () => Promise<{ default: ComponentType }>;
    /** What the source panel shows, entry file first. */
    files: SourceFile[];
};

export type Section = {
    kind: Kind;
    title: string;
    groups: { key: string; title: string; entries: Entry[] }[];
};

export type Fixture = { name: string; title: string; href: string };

// Glob keys are relative to this file, which is apps/playground/src.
export function repositoryPath(key: string): string {
    return new URL(key, "file:///apps/playground/src/").pathname.slice(1);
}

// ─── Examples ───────────────────────────────────────────────────────────────

const EXAMPLES = "../../../examples/react/src/examples";

const exampleModules = import.meta.glob<{ default: ComponentType }>(
    "../../../examples/react/src/examples/*/index.tsx",
);
const exampleMetas = import.meta.glob<{ default: ExampleMeta }>(
    "../../../examples/react/src/examples/*/meta.ts",
    { eager: true },
);
const exampleSources = import.meta.glob<string>(
    [
        "../../../examples/react/src/examples/*/*.{ts,tsx,css}",
        "!../../../examples/react/src/examples/_*/**",
        "!../../../examples/react/src/examples/*/meta.ts",
    ],
    { query: "?raw", import: "default" },
);

/** `…/examples/<slug>/<file>` → `<slug>`, or nothing for a `_` folder or a loose file. */
export function exampleSlug(key: string): string | undefined {
    const match = /\/examples\/([^/_][^/]*)\/[^/]+$/.exec(key);
    return match?.[1];
}

function exampleFiles(slug: string): SourceFile[] {
    const entry = `${EXAMPLES}/${slug}/index.tsx`;
    return Object.entries(exampleSources)
        .filter(([key]) => exampleSlug(key) === slug)
        .sort(([a], [b]) => {
            if (a === entry) return -1;
            if (b === entry) return 1;
            return a.localeCompare(b);
        })
        .map(([key, load]) => ({ path: repositoryPath(key), load }));
}

const exampleEntries: Entry[] = Object.entries(exampleModules)
    .flatMap(([key, load]) => {
        const slug = exampleSlug(key);
        const meta = exampleMetas[`${EXAMPLES}/${slug}/meta.ts`]?.default;
        if (!slug || !meta) return [];
        return [
            {
                entry: {
                    kind: "example" as const,
                    id: slug,
                    title: meta.title,
                    group: meta.category,
                    groupTitle: CATEGORY_TITLES[meta.category],
                    description: meta.description,
                    features: meta.features,
                    layout: meta.layout ?? "fill",
                    load,
                    files: exampleFiles(slug),
                },
                order: meta.order,
            },
        ];
    })
    .sort((a, b) => a.order - b.order || a.entry.id.localeCompare(b.entry.id))
    .map(({ entry }) => entry);

// ─── Sections ───────────────────────────────────────────────────────────────

function section(
    kind: Kind,
    title: string,
    groups: readonly { key: string; title: string }[],
    entries: Entry[],
): Section {
    return {
        kind,
        title,
        groups: groups
            .map((group) => ({
                ...group,
                entries: entries.filter((entry) => entry.group === group.key),
            }))
            .filter((group) => group.entries.length > 0),
    };
}

export const sections: Section[] = [
    section(
        "example",
        "Examples",
        CATEGORIES.map((category) => ({
            key: category,
            title: CATEGORY_TITLES[category],
        })),
        exampleEntries,
    ),
].filter((s) => s.groups.length > 0);

export const entries: Entry[] = sections.flatMap((s) =>
    s.groups.flatMap((g) => g.entries),
);

export function findEntry(ref: ItemRef | null): Entry | undefined {
    if (!ref) return undefined;
    return entries.find((e) => e.kind === ref.kind && e.id === ref.id);
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const fixturePages = import.meta.glob<string>("../fixtures/*/index.html", {
    query: "?raw",
    import: "default",
    eager: true,
});

/** Each fixture page, titled by its `<title>`; each opens with its own default layout. */
export const fixtures: Fixture[] = Object.entries(fixturePages)
    .flatMap(([key, html]) => {
        const name = /^\.\.\/fixtures\/([^/]+)\/index\.html$/.exec(key)?.[1];
        if (!name) return [];
        const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? name;
        return [{ name, title, href: `/fixtures/${name}/` }];
    })
    .sort((a, b) => a.title.localeCompare(b.title));
