// The site export contract, v1.2 (fragiola/www CONTRACT.md): its types, and the checks this repo
// runs on what it exports. `www` runs the same checks on every build; running them here first
// means an export that `www` would reject never leaves this repo.
//
// - `validateExport(dir)` reads a finished export (site/export.ts runs it on its output);
// - `validateSite(site)` checks the same things in memory (the tests run it on the sources).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** v1.1 and v1.2 keep the file format: `project.json` keeps `"contract": 1`. */
export const CONTRACT = 1;
/** The version this repo implements, for messages. */
export const CONTRACT_VERSION = "1.2";

/** v1.2 (§2, §3.2): lengths in characters (Unicode code points). */
export const LIMITS = {
    title: 60,
    description: { min: 50, max: 160 },
    keywords: { min: 1, max: 8, length: 40 },
} as const;

// ─── types ───────────────────────────────────────────────────────────────────

export interface ProjectInfo {
    contract: number;
    slug: string;
    title: string;
    description: string;
    frameworks: string[];
    defaultFramework: string;
    registry?: { namespace: string };
    /** v1.1: the header and footer links */
    repository?: string;
    /** v1.2: 1–8 lowercase topics, for the project's structured data only (§2) */
    keywords?: string[];
}

export type SidebarEntry =
    | { label: string; path: string }
    | { label: string; href: string; external: true };

export interface DocsConfig {
    sections: {
        label: string;
        framework?: string;
        /** v1.1: a folder that folds */
        collapsible?: boolean;
        /** v1.1: open on load */
        defaultOpen?: boolean;
        pages: SidebarEntry[];
    }[];
}

export interface ExamplesConfig {
    levels: { id: string; title: string }[];
    themes: {
        name: string;
        title: string;
        description: string;
        scheme: "light" | "dark";
        swatch: string[];
        file?: { path: string; lang: string; content: string };
    }[];
}

export interface Manifest {
    files: Record<string, { lang: string; content: string; shared?: boolean }>;
    examples: {
        id: string;
        title: string;
        description: string;
        level: string;
        order: number;
        features: string[];
        docs?: string;
        layout: "fill" | "flow";
        height: number;
        files: string[];
        registry: string[];
        packages: string[];
    }[];
}

/** An export, in memory. `pages` maps a page path (`guides/tabs`, `index`) to its MDX. */
export interface Site {
    project: ProjectInfo;
    config: DocsConfig;
    pages: Map<string, string>;
    examples: ExamplesConfig;
    manifests: Map<string, Manifest>;
    /** registry item names in r/, when the project exports a registry */
    registry?: Set<string>;
}

// ─── MDX ─────────────────────────────────────────────────────────────────────

/** The v1.1 vocabulary: each component and the props it takes (§3.4). */
const VOCABULARY: Record<string, { props: string[]; required: string[] }> = {
    Example: {
        props: ["id", "framework", "theme", "height", "variant", "label"],
        required: ["id"],
    },
    Callout: { props: ["type", "title"], required: ["type"] },
    Tabs: { props: ["items"], required: ["items"] },
    Tab: { props: ["value"], required: ["value"] },
    Steps: { props: [], required: [] },
    Step: { props: [], required: [] },
    Cards: { props: [], required: [] },
    Card: {
        props: ["title", "href", "description"],
        required: ["title", "href"],
    },
    InstallCommand: { props: ["item"], required: ["item"] },
    Framework: { props: ["name"], required: ["name"] },
    Hero: {
        props: ["title", "description", "eyebrow", "background", "actions"],
        required: ["title"],
    },
    Section: {
        props: ["title", "eyebrow", "description"],
        required: ["title"],
    },
    Features: { props: ["columns", "numbered"], required: [] },
    Feature: { props: ["title"], required: ["title"] },
    Pills: { props: ["items", "strike"], required: ["items"] },
};

/** The components that belong on the landing only (§3.4). */
const LANDING_ONLY = new Set([
    "Hero",
    "Section",
    "Features",
    "Feature",
    "Pills",
]);

const VARIANTS = ["inline", "bleed", "card", "showcase"];
const CALLOUTS = ["info", "warn", "danger"];
const BACKGROUNDS = ["none", "grid"];
const ACTION_VARIANTS = ["primary", "secondary", "ghost"];
const ACTION_ICONS = ["arrow", "external"];

/** The frontmatter's `key: value` lines. */
export function frontmatter(source: string): Record<string, string> {
    const block = /^---\n([\s\S]*?)\n---\n/.exec(source)?.[1];
    const fields: Record<string, string> = {};
    for (const line of block?.split("\n") ?? []) {
        const match = /^([A-Za-z]\w*):\s*(.*)$/.exec(line);
        if (match?.[1]) {
            fields[match[1]] = (match[2] ?? "").replace(/^(["'])(.*)\1$/, "$2");
        }
    }
    return fields;
}

/**
 * The page's prose: frontmatter, fenced code and inline code blanked out (line count kept, so
 * line numbers stay right), plus the fences' info strings, which must name a language.
 */
function prose(
    source: string,
    { keepInlineCode = false } = {},
): { text: string; fences: { line: number; info: string }[] } {
    const fences: { line: number; info: string }[] = [];
    let fence: string | undefined;
    const lines = source.split("\n");
    let inFrontmatter = lines[0] === "---";
    const text = lines
        .map((line, index) => {
            if (inFrontmatter) {
                if (index > 0 && line === "---") inFrontmatter = false;
                return "";
            }
            const marker = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
            if (marker?.[1]) {
                if (!fence) {
                    fence = marker[1];
                    fences.push({
                        line: index + 1,
                        info: (marker[2] ?? "").trim(),
                    });
                } else if (marker[1].startsWith(fence) && !marker[2]?.trim()) {
                    fence = undefined;
                }
                return "";
            }
            if (fence) return "";
            return line
                .replace(/(`+)([\s\S]*?)\1/g, (code, _ticks, inner: string) =>
                    keepInlineCode ? inner : " ".repeat(code.length),
                )
                .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
        })
        .join("\n");
    return { text, fences };
}

interface Tag {
    name: string;
    props: Map<string, string>;
    line: number;
    /** its offset in the prose, for document order */
    index: number;
    /** `<X />`: it has no children */
    selfClosing: boolean;
}

const ATTRIBUTES = String.raw`(?:[^>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*`;

/** The JSX tags of the prose (opening and self-closing), with their raw props. */
function tagsOf(text: string): Tag[] {
    const tags: Tag[] = [];
    const pattern = new RegExp(
        String.raw`<([A-Za-z][\w.]*)(?![\w.:])(${ATTRIBUTES})>`,
        "g",
    );
    for (const match of text.matchAll(pattern)) {
        const props = new Map<string, string>();
        const attributes = (match[2] ?? "").replace(/\/$/, "");
        const prop =
            /([A-Za-z][\w-]*)(?:=("[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}))?/g;
        for (const [, key, value] of attributes.matchAll(prop)) {
            if (key) props.set(key, value ?? "true");
        }
        tags.push({
            name: match[1] ?? "",
            props,
            line: text.slice(0, match.index).split("\n").length,
            index: match.index,
            selfClosing: /\/\s*$/.test(match[2] ?? ""),
        });
    }
    return tags;
}

/**
 * A prop's expression (`{…}`) read as JSON: the landing's `actions={[…]}` and `items={[…]}`
 * are literals, so unquoted keys and trailing commas are all that separates them from JSON.
 * Undefined when it is not a literal.
 */
function literalProp(value: string | undefined): unknown {
    const inner = /^\{([\s\S]*)\}$/.exec(value ?? "")?.[1];
    if (inner === undefined) return undefined;
    try {
        return JSON.parse(
            inner
                .replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":')
                .replace(/,(\s*[\]}])/g, "$1"),
        );
    } catch {
        return undefined;
    }
}

/** A prop's string value (`"x"`, `'x'` or `{"x"}`), or undefined for an expression. */
function stringProp(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    const quoted = /^(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\})$/.exec(value);
    return quoted ? (quoted[1] ?? quoted[2] ?? quoted[3]) : undefined;
}

/** Heading anchors, the way Fumadocs (github-slugger) makes them, duplicates numbered. */
export function anchorsOf(source: string): Set<string> {
    const anchors = new Set<string>();
    const counts = new Map<string, number>();
    const { text } = prose(source, { keepInlineCode: true });
    for (const [, heading] of text.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
        const base = (heading ?? "")
            .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
            .replace(/[*_~]/g, "")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s-]/gu, "")
            .trim()
            .replace(/\s/g, "-");
        const count = counts.get(base) ?? 0;
        counts.set(base, count + 1);
        anchors.add(count === 0 ? base : `${base}-${count}`);
    }
    return anchors;
}

/** Every link target of a page, with its line: markdown links, references, href props, Hero actions. */
function linksOf(text: string): { href: string; line: number }[] {
    const links: { href: string; line: number }[] = [];
    const lineOf = (index: number) => text.slice(0, index).split("\n").length;
    const patterns = [
        /\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
        /^\s*\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/gm,
        /\bhref(?:=|:\s*)["']([^"']+)["']/g,
    ];
    for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
            if (match[1])
                links.push({ href: match[1], line: lineOf(match.index) });
        }
    }
    return links;
}

/** A frontmatter field's line in the file (the block opens on line 1), else 1. */
function fieldLine(source: string, key: string): number {
    const lines = source.split("\n");
    if (lines[0] !== "---") return 1;
    for (let index = 1; index < lines.length; index++) {
        const line = lines[index] ?? "";
        if (line === "---") break;
        if (line.startsWith(`${key}:`)) return index + 1;
    }
    return 1;
}

/**
 * The heading level `www` renders for a component (§3.4): `<Hero>` the h1, a `<Section>`'s title
 * an h2, a `<Feature>`'s title one level below its section (h3, or h2 outside one), and a
 * `<Card>`'s title an h3 wherever it is (Fumadocs' cards).
 */
function renderedLevel(
    name: string,
    ancestors: readonly string[],
): number | undefined {
    switch (name) {
        case "Hero":
            return 1;
        case "Section":
            return 2;
        case "Feature":
            return ancestors.includes("Section") ? 3 : 2;
        case "Card":
            return 3;
        default:
            return undefined;
    }
}

/** An entry of a page's outline: a Markdown heading (its depth) or a component's heading. */
interface OutlineEntry {
    level: number;
    line: number;
    /** the component that renders it; undefined for a Markdown heading */
    component?: string;
}

/**
 * The page's outline as `www` renders it, in document order: the Markdown (ATX) headings of the
 * prose, and the components that render a heading, each knowing the components it is inside.
 */
function outlineOf(text: string): OutlineEntry[] {
    const lineOf = (index: number) => text.slice(0, index).split("\n").length;
    type Event =
        | { index: number; kind: "open"; tag: Tag }
        | { index: number; kind: "close"; name: string }
        | { index: number; kind: "heading"; depth: number };
    const events: Event[] = [
        ...tagsOf(text).map(
            (tag): Event => ({ index: tag.index, kind: "open", tag }),
        ),
        ...[...text.matchAll(/<\/([A-Za-z][\w.]*)\s*>/g)].map(
            (match): Event => ({
                index: match.index,
                kind: "close",
                name: match[1] ?? "",
            }),
        ),
        ...[...text.matchAll(/^[ \t]*(#{1,6})(?=[ \t]|$)/gm)].map(
            (match): Event => ({
                index: match.index,
                kind: "heading",
                depth: match[1]?.length ?? 0,
            }),
        ),
    ].sort((a, b) => a.index - b.index);
    const outline: OutlineEntry[] = [];
    const open: string[] = [];
    for (const event of events) {
        if (event.kind === "heading") {
            outline.push({
                level: event.depth,
                line: lineOf(event.index),
            });
        } else if (event.kind === "open") {
            const level = renderedLevel(event.tag.name, open);
            if (level !== undefined) {
                outline.push({
                    level,
                    line: event.tag.line,
                    component: event.tag.name,
                });
            }
            if (!event.tag.selfClosing) open.push(event.tag.name);
        } else {
            const at = open.lastIndexOf(event.name);
            if (at >= 0) open.length = at;
        }
    }
    return outline;
}

/** The Markdown images of the prose (inline and reference), with their alt text as written. */
function imagesOf(text: string): { alt: string; line: number }[] {
    return [
        ...text.matchAll(/!\[((?:[^[\]\\]|\\.|\[[^\]]*\])*)\](?=[([])/g),
    ].map((match) => ({
        alt: match[1] ?? "",
        line: text.slice(0, match.index).split("\n").length,
    }));
}

/**
 * The headings the outline does not read, rejected outright so this check is never looser than
 * `www`'s parse: a setext heading (text over a line of `===` or `---`: an h1 or an h2), and an
 * ATX heading behind a blockquote or list marker (`> ## x`, `- ## x`, `1. ## x`). A `---` rule
 * right under text is read as a setext heading too: a rule takes a blank line before it.
 */
function headingFormProblems(file: string, text: string): string[] {
    const problems: string[] = [];
    const lines = text.split("\n");
    for (const [index, line] of lines.entries()) {
        const above = index > 0 ? (lines[index - 1] ?? "") : "";
        if (/^[ \t]*(?:=+|-+)[ \t]*$/.test(line) && above.trim() !== "") {
            problems.push(
                `${file}:${index}: a setext heading (a line of === or --- right under text): write headings as ## at the start of a line, and put a blank line before a --- rule (§3.4)`,
            );
        }
        if (
            /^[ \t]*(?:>[ \t]*|[-*+][ \t]+|\d{1,9}[.)][ \t]+)+#{1,6}(?=[ \t]|$)/.test(
                line,
            )
        ) {
            problems.push(
                `${file}:${index + 1}: a heading in a blockquote or a list item: write headings as ## at the start of a line (§3.4)`,
            );
        }
    }
    return problems;
}

/** No `#`, no skipped level, one `<Hero>` on the landing, alt text on images (v1.2, §3.4). */
function structureProblems(
    file: string,
    landing: boolean,
    source: string,
): string[] {
    const problems: string[] = [];
    const { text } = prose(source);
    const heroes = tagsOf(text).filter((tag) => tag.name === "Hero");
    if (landing && heroes.length === 0) {
        problems.push(
            `${file}:1: the landing has no <Hero>: its title is the landing's h1 (§3.4)`,
        );
    }
    if (landing) {
        for (const hero of heroes.slice(1)) {
            problems.push(
                `${file}:${hero.line}: a second <Hero>: the landing has exactly one, its only h1 (§3.4)`,
            );
        }
    }
    // the page starts under its h1 (the frontmatter title, or the landing's <Hero>)
    let previous = 1;
    for (const { level, line, component } of outlineOf(text)) {
        const markdown = component === undefined;
        if (markdown && level === 1) {
            problems.push(
                `${file}:${line}: a Markdown # heading: the page's h1 is ${landing ? "its <Hero>'s title" : "its frontmatter title"} (§3.4)`,
            );
        } else if (markdown && level > previous + 1) {
            problems.push(
                `${file}:${line}: a ${"#".repeat(level)} heading after an h${previous}: headings do not skip a level (§3.4)`,
            );
        } else if (component === "Card" && level > previous + 1) {
            problems.push(
                `${file}:${line}: a <Card> (an h${level}) after an h${previous}: headings do not skip a level (§3.4)`,
            );
        }
        previous = level;
    }
    problems.push(...headingFormProblems(file, text));
    // inline code is blanked out: `![](x.png)` in backticks is not an image
    for (const image of imagesOf(text)) {
        if (image.alt.trim() === "") {
            problems.push(
                `${file}:${image.line}: an image needs alt text: ![what it shows](…) (§3.4)`,
            );
        }
    }
    return problems;
}

/**
 * The frontmatter lines this repo does not read the way YAML (and `www`) would. The frontmatter
 * is one `key: value` per line (frontmatter() reads nothing else), so it rejects:
 * - an unquoted value with ": " or " #" in it: a nested mapping or a comment, not text;
 * - a block scalar (`>`, `|`) and an indented line: a value that goes on past its first line,
 *   whose length would be measured on that line only;
 * - any other line that is not `key: value`, a comment or blank.
 */
function yamlProblems(file: string, source: string): string[] {
    const lines = source.split("\n");
    if (lines[0] !== "---") return [];
    const problems: string[] = [];
    for (let index = 1; index < lines.length; index++) {
        const line = lines[index] ?? "";
        if (line === "---") break;
        const where = `${file}:${index + 1}`;
        if (line.trim() === "" || /^#/.test(line)) continue;
        if (/^\s/.test(line)) {
            problems.push(
                `${where}: frontmatter: an indented line continues a value: write each field on one line (§3.2)`,
            );
            continue;
        }
        const match = /^([A-Za-z]\w*):(?:[ \t]+(.*))?$/.exec(line);
        if (!match) {
            problems.push(
                `${where}: the frontmatter is not valid YAML here: one "key: value" per line`,
            );
            continue;
        }
        const value = match[2]?.trim() ?? "";
        if (/^[|>][-+0-9]*(?:[ \t]+#.*)?$/.test(value)) {
            problems.push(
                `${where}: frontmatter: ${match[1]} is a block scalar (${value}): write it on one line (§3.2)`,
            );
        } else if (!/^["'[{]/.test(value) && /: | #|:$/.test(value)) {
            problems.push(
                `${where}: the frontmatter is not valid YAML: ${match[1]}'s value has ": " or " #" in it; quote it`,
            );
        }
    }
    return problems;
}

/** The frontmatter's lengths, and the landing's title (v1.2, §3.2), at each field's line. */
function searchFieldProblems(
    file: string,
    path: string,
    source: string,
    project: ProjectInfo,
): string[] {
    const problems: string[] = [];
    const { title, description } = frontmatter(source);
    const at = (key: string) => `${file}:${fieldLine(source, key)}`;
    if (title && length(title) > LIMITS.title) {
        problems.push(
            `${at("title")}: frontmatter: title is ${length(title)} characters: at most ${LIMITS.title} (§3.2)`,
        );
    }
    const wrong = description ? descriptionLength(description) : undefined;
    if (wrong)
        problems.push(`${at("description")}: frontmatter: ${wrong} (§3.2)`);
    if (path !== "index" || !title || !project.title) return problems;
    if (!title.includes(project.title)) {
        problems.push(
            `${at("title")}: frontmatter: the landing's title "${title}" is its <title>: it contains the project's title "${project.title}" (§3.2)`,
        );
    } else if (title.trim() === project.title) {
        problems.push(
            `${at("title")}: frontmatter: the landing's title is its <title>: say what ${project.title} is, not only its name ("${project.title} — …") (§3.2)`,
        );
    }
    return problems;
}

/** A length in characters: Unicode code points, as the contract counts them (v1.2). */
const length = (text: string) => [...text].length;

/**
 * Why a description is not 50–160 characters long, or undefined when it is (§2, §3.2). It is
 * counted on the plain text: inline code marks are dropped first.
 */
function descriptionLength(text: string): string | undefined {
    const { min, max } = LIMITS.description;
    const n = length(text.replace(/`([^`]*)`/g, "$1"));
    return n < min || n > max
        ? `description is ${n} characters: ${min}–${max}`
        : undefined;
}

/** `keywords` (v1.2, §2): 1–8 unique topics, lowercase, at most 40 characters each. */
function keywordProblems(keywords: unknown): string[] {
    const { min, max } = LIMITS.keywords;
    if (
        !Array.isArray(keywords) ||
        keywords.length < min ||
        keywords.length > max
    ) {
        return [`project.json: keywords must list ${min}–${max} topics (§2)`];
    }
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const keyword of keywords as unknown[]) {
        if (
            typeof keyword !== "string" ||
            keyword === "" ||
            keyword.trim() !== keyword
        ) {
            problems.push(
                `project.json: keywords: ${JSON.stringify(keyword)} is not a topic: a non-empty string, no surrounding spaces (§2)`,
            );
            continue;
        }
        const where = `project.json: keywords: "${keyword}"`;
        if (keyword !== keyword.toLowerCase()) {
            problems.push(`${where} is not lowercase (§2)`);
        }
        if (length(keyword) > LIMITS.keywords.length) {
            problems.push(
                `${where} is ${length(keyword)} characters: at most ${LIMITS.keywords.length} (§2)`,
            );
        }
        if (seen.has(keyword)) problems.push(`${where} is listed twice (§2)`);
        seen.add(keyword);
    }
    return problems;
}

/** `<meta name="robots" content="noindex">`, whatever the order and quoting of its attributes. */
function isNoindex(tag: string): boolean {
    return (
        /\bname\s*=\s*(["']?)robots\1(?=[\s/>])/i.test(tag) &&
        /\bcontent\s*=\s*(?:(["'])[^"']*\bnoindex\b[^"']*\1|noindex(?=[\s/>]))/i.test(
            tag,
        )
    );
}

/**
 * Why an HTML file of an embed app is not `noindex`, at the line of its `<head>`, or undefined
 * when it is (v1.2, §5.1). `file` names it in the message.
 */
export function noindexProblem(
    file: string,
    source: string,
): string | undefined {
    // comments out, their line breaks kept: a <meta> in a comment does not count
    const html = source.replace(/<!--[\s\S]*?-->/g, (comment) =>
        comment.replace(/[^\n]/g, ""),
    );
    const tags = [...html.matchAll(/<meta\b[^>]*>/gi)];
    if (tags.some(([tag]) => isNoindex(tag))) return undefined;
    const head = /<head\b/i.exec(html);
    const where = head
        ? `${file}:${html.slice(0, head.index).split("\n").length}`
        : file;
    return `${where}: needs <meta name="robots" content="noindex">: an example is not a page for search engines (§5.1)`;
}

// ─── checks ──────────────────────────────────────────────────────────────────

export function validateSite(site: Site): string[] {
    const problems: string[] = [];
    const { project, config, pages, examples, manifests } = site;

    // project.json
    if (project.contract !== CONTRACT) {
        problems.push(
            `project.json: contract ${project.contract}, expected ${CONTRACT}`,
        );
    }
    for (const key of ["slug", "title", "description"] as const) {
        if (!project[key]) problems.push(`project.json: ${key} is required`);
    }
    if (!project.frameworks.includes(project.defaultFramework)) {
        problems.push(
            `project.json: defaultFramework "${project.defaultFramework}" is not in frameworks`,
        );
    }
    if (Boolean(project.registry) !== Boolean(site.registry)) {
        problems.push("project.json: registry.namespace and r/ go together");
    }
    if (
        project.repository !== undefined &&
        !/^https:\/\/\S+$/.test(project.repository)
    ) {
        problems.push("project.json: repository must be an https:// URL");
    }
    const projectDescription =
        typeof project.description === "string" && project.description
            ? descriptionLength(project.description)
            : undefined;
    if (projectDescription) {
        problems.push(`project.json: ${projectDescription} (§2)`);
    }
    if (project.keywords !== undefined) {
        problems.push(...keywordProblems(project.keywords));
    }

    // examples.json
    const levels = new Set(examples.levels.map((level) => level.id));
    if (levels.size !== examples.levels.length)
        problems.push("examples.json: duplicate level id");
    const themes = new Set(examples.themes.map((theme) => theme.name));
    if (themes.size !== examples.themes.length)
        problems.push("examples.json: duplicate theme name");
    for (const scheme of ["light", "dark"]) {
        if (!examples.themes.some((theme) => theme.scheme === scheme)) {
            problems.push(`examples.json: no ${scheme} theme`);
        }
    }
    for (const theme of examples.themes) {
        if (!["light", "dark"].includes(theme.scheme)) {
            problems.push(
                `examples.json: theme "${theme.name}" has scheme "${theme.scheme}"`,
            );
        }
        if (theme.file && !theme.file.content) {
            problems.push(
                `examples.json: theme "${theme.name}" has an empty file`,
            );
        }
    }

    // pages: config ↔ files
    const listed = new Map<string, number>();
    for (const section of config.sections) {
        if (
            section.framework &&
            !project.frameworks.includes(section.framework)
        ) {
            problems.push(
                `config.json: section "${section.label}" names framework "${section.framework}"`,
            );
        }
        for (const key of ["collapsible", "defaultOpen"] as const) {
            if (
                section[key] !== undefined &&
                typeof section[key] !== "boolean"
            ) {
                problems.push(
                    `config.json: section "${section.label}": ${key} takes a boolean`,
                );
            }
        }
        for (const entry of section.pages) {
            if ("path" in entry) {
                listed.set(entry.path, (listed.get(entry.path) ?? 0) + 1);
                if (!pages.has(entry.path)) {
                    problems.push(
                        `config.json: ${entry.path}.mdx does not exist`,
                    );
                }
            } else if (
                !/^https?:\/\//.test(entry.href) ||
                entry.external !== true
            ) {
                problems.push(
                    `config.json: "${entry.label}" needs an absolute href and external: true`,
                );
            }
        }
    }
    for (const [path, count] of listed) {
        if (count > 1)
            problems.push(`config.json: ${path} is listed ${count} times`);
    }
    if (!pages.has("index")) problems.push("docs/index.mdx is missing");
    for (const path of pages.keys()) {
        if (path !== "index" && !listed.has(path)) {
            problems.push(`config.json: ${path}.mdx is not listed`);
        }
    }

    // examples: the manifests
    const exampleIds = new Set<string>();
    for (const [framework, manifest] of manifests) {
        const ids = new Set<string>();
        for (const example of manifest.examples) {
            const where = `embed/${framework}/manifest.json: ${example.id}`;
            if (ids.has(example.id)) problems.push(`${where}: duplicate id`);
            ids.add(example.id);
            exampleIds.add(example.id);
            if (!levels.has(example.level))
                problems.push(`${where}: unknown level "${example.level}"`);
            if (!["fill", "flow"].includes(example.layout))
                problems.push(`${where}: layout "${example.layout}"`);
            if (!(example.height > 0))
                problems.push(`${where}: height must be positive`);
            if (example.files.length === 0) problems.push(`${where}: no files`);
            for (const file of example.files) {
                if (!manifest.files[file])
                    problems.push(`${where}: file ${file} is not in files`);
            }
            for (const item of example.registry) {
                if (item.includes("/"))
                    problems.push(
                        `${where}: registry item "${item}" is namespaced`,
                    );
            }
        }
    }

    // pages: frontmatter, vocabulary, links
    const anchors = new Map(
        [...pages].map(([path, source]) => [path, anchorsOf(source)]),
    );
    const resolve = (href: string, from: string): string | undefined => {
        if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return undefined; // https:, mailto:
        const [path = "", hash] = href.split("#");
        if (path === "") {
            return hash && !anchors.get(from)?.has(hash)
                ? `no heading #${hash} on this page`
                : undefined;
        }
        if (!path.startsWith("/"))
            return `relative link "${href}" (write it base-free, from /)`;
        if (path === "/" || path === "/examples") return undefined;
        const example = /^\/examples\/([^/]+)$/.exec(path);
        if (example) {
            return exampleIds.has(example[1] ?? "")
                ? undefined
                : `no example "${example[1]}"`;
        }
        const page = /^\/docs\/(.+)$/.exec(path)?.[1];
        if (page === undefined || !pages.has(page) || page === "index")
            return `no page ${path}`;
        if (hash && !anchors.get(page)?.has(hash))
            return `no heading #${hash} on ${path}`;
        return undefined;
    };

    for (const [path, source] of pages) {
        const file = `docs/${path}.mdx`;
        const fields = frontmatter(source);
        for (const key of ["title", "description"]) {
            if (!fields[key])
                problems.push(`${file}: frontmatter ${key} is required`);
        }
        if (path === "index" && fields.layout !== "landing") {
            problems.push(`${file}: frontmatter layout must be "landing"`);
        }
        problems.push(...yamlProblems(file, source));
        problems.push(...searchFieldProblems(file, path, source, project));
        const { text, fences } = prose(source);
        for (const fence of fences) {
            if (!/^[\w+-]+(\s+title="[^"]*")?$/.test(fence.info)) {
                problems.push(
                    `${file}:${fence.line}: a code block takes a language and an optional title="…" (got "${fence.info}")`,
                );
            }
        }
        for (const [index, line] of text.split("\n").entries()) {
            if (/^\s*(import|export)\s/.test(line)) {
                problems.push(
                    `${file}:${index + 1}: import/export is not allowed`,
                );
            }
        }
        for (const tag of tagsOf(text)) {
            const where = `${file}:${tag.line}`;
            const spec = VOCABULARY[tag.name];
            if (!spec) {
                problems.push(
                    `${where}: <${tag.name}> is not in the v1.1 vocabulary`,
                );
                continue;
            }
            for (const key of tag.props.keys()) {
                if (!spec.props.includes(key))
                    problems.push(`${where}: <${tag.name}> takes no "${key}"`);
            }
            for (const key of spec.required) {
                if (!tag.props.has(key))
                    problems.push(`${where}: <${tag.name}> needs "${key}"`);
            }
            const value = (key: string) => stringProp(tag.props.get(key));
            if (tag.name === "Example") {
                const id = value("id");
                if (!id || !exampleIds.has(id))
                    problems.push(
                        `${where}: <Example id="${id}"> is not an example`,
                    );
                const variant = value("variant");
                if (
                    tag.props.has("variant") &&
                    !VARIANTS.includes(variant ?? "")
                ) {
                    problems.push(`${where}: <Example variant="${variant}">`);
                }
                const theme = value("theme");
                if (tag.props.has("theme") && !themes.has(theme ?? "")) {
                    problems.push(
                        `${where}: <Example theme="${theme}"> is not in examples.json`,
                    );
                }
                const framework = value("framework");
                if (
                    tag.props.has("framework") &&
                    !project.frameworks.includes(framework ?? "")
                ) {
                    problems.push(
                        `${where}: <Example framework="${framework}">`,
                    );
                }
                if (
                    tag.props.has("height") &&
                    !/^\{\s*\d+\s*\}$/.test(tag.props.get("height") ?? "")
                ) {
                    problems.push(`${where}: <Example height> takes a number`);
                }
                if (tag.props.has("label") && variant !== "showcase") {
                    problems.push(
                        `${where}: <Example label> goes with variant="showcase"`,
                    );
                }
            }
            if (
                tag.name === "Callout" &&
                !CALLOUTS.includes(value("type") ?? "")
            ) {
                problems.push(`${where}: <Callout type="${value("type")}">`);
            }
            if (
                tag.name === "Framework" &&
                !project.frameworks.includes(value("name") ?? "")
            ) {
                problems.push(`${where}: <Framework name="${value("name")}">`);
            }
            if (
                tag.name === "InstallCommand" &&
                !site.registry?.has(value("item") ?? "")
            ) {
                problems.push(
                    `${where}: <InstallCommand item="${value("item")}"> is not in r/`,
                );
            }
            if (LANDING_ONLY.has(tag.name) && path !== "index") {
                problems.push(
                    `${where}: <${tag.name}> belongs on the landing only`,
                );
            }
            if (
                tag.name === "Hero" &&
                tag.props.has("background") &&
                !BACKGROUNDS.includes(value("background") ?? "")
            ) {
                problems.push(
                    `${where}: <Hero background="${value("background")}">`,
                );
            }
            if (tag.name === "Hero" && tag.props.has("actions")) {
                const actions = literalProp(tag.props.get("actions"));
                const valid =
                    Array.isArray(actions) &&
                    actions.every((action: Record<string, unknown>) => {
                        const { label, href, variant, icon } = action ?? {};
                        return (
                            typeof label === "string" &&
                            label !== "" &&
                            typeof href === "string" &&
                            href !== "" &&
                            (variant === undefined ||
                                ACTION_VARIANTS.includes(variant as string)) &&
                            (icon === undefined ||
                                ACTION_ICONS.includes(icon as string))
                        );
                    });
                if (!valid) {
                    problems.push(
                        `${where}: <Hero actions> takes a list of { label, href, variant?: "primary" | "secondary" | "ghost", icon?: "arrow" | "external" }`,
                    );
                }
            }
            if (
                tag.name === "Features" &&
                tag.props.has("columns") &&
                !/^\{\s*[234]\s*\}$/.test(tag.props.get("columns") ?? "")
            ) {
                problems.push(`${where}: <Features columns> takes 2, 3 or 4`);
            }
            if (tag.name === "Pills") {
                const items = literalProp(tag.props.get("items"));
                if (
                    !Array.isArray(items) ||
                    items.length === 0 ||
                    !items.every((item) => typeof item === "string" && item)
                ) {
                    problems.push(
                        `${where}: <Pills items> takes a list of strings`,
                    );
                }
            }
        }
        for (const [index, line] of text.split("\n").entries()) {
            for (const [, name] of line.matchAll(/<\/([A-Za-z][\w.]*)\s*>/g)) {
                if (name && !VOCABULARY[name]) {
                    problems.push(
                        `${file}:${index + 1}: </${name}> is not in the v1.1 vocabulary`,
                    );
                }
            }
        }
        for (const link of linksOf(text)) {
            const problem = resolve(link.href, path);
            if (problem) problems.push(`${file}:${link.line}: ${problem}`);
        }
        problems.push(...structureProblems(file, path === "index", source));
    }

    // the manifests' docs links
    for (const [framework, manifest] of manifests) {
        for (const example of manifest.examples) {
            const problem = example.docs && resolve(example.docs, "index");
            if (problem)
                problems.push(
                    `embed/${framework}/manifest.json: ${example.id}: docs ${problem}`,
                );
        }
    }
    return problems;
}

// ─── reading an export ───────────────────────────────────────────────────────

const readJson = <T>(file: string): T =>
    JSON.parse(readFileSync(file, "utf-8")) as T;

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

/** The pages of a docs directory, by page path. */
export function readPages(docs: string): Map<string, string> {
    return new Map(
        walk(docs)
            .filter((file) => file.endsWith(".mdx"))
            .map((file) => [
                relative(docs, file).replace(/\.mdx$/, ""),
                readFileSync(file, "utf-8"),
            ]),
    );
}

/** Checks a finished export: the in-memory checks, plus the files each part must have. */
export function validateExport(out: string, base: string): string[] {
    const problems: string[] = [];
    for (const file of [
        "project.json",
        "examples.json",
        "docs/config.json",
        "docs/index.mdx",
    ]) {
        if (!existsSync(join(out, file))) problems.push(`${file} is missing`);
    }
    if (problems.length > 0) return problems;
    const project = readJson<ProjectInfo>(join(out, "project.json"));
    const manifests = new Map<string, Manifest>();
    for (const framework of project.frameworks) {
        const dir = join(out, "embed", framework);
        for (const file of ["index.html", "manifest.json"]) {
            if (!existsSync(join(dir, file)))
                problems.push(`embed/${framework}/${file} is missing`);
        }
        if (existsSync(dir)) {
            for (const path of walk(dir).filter((f) => f.endsWith(".html"))) {
                const problem = noindexProblem(
                    relative(out, path).split(sep).join("/"),
                    readFileSync(path, "utf-8"),
                );
                if (problem) problems.push(problem);
            }
        }
        const index = join(dir, "index.html");
        const embedBase = `${base}/embed/${framework}/`;
        if (
            existsSync(index) &&
            !readFileSync(index, "utf-8").includes(`"${embedBase}`)
        ) {
            problems.push(
                `embed/${framework}/index.html was not built for ${embedBase}`,
            );
        }
        if (existsSync(join(dir, "manifest.json"))) {
            manifests.set(
                framework,
                readJson<Manifest>(join(dir, "manifest.json")),
            );
        }
    }
    let registry: Set<string> | undefined;
    if (existsSync(join(out, "r"))) {
        const index = readJson<{ items: { name: string }[] }>(
            join(out, "r", "index.json"),
        );
        registry = new Set(index.items.map((item) => item.name));
    }
    return [
        ...problems,
        ...validateSite({
            project,
            config: readJson<DocsConfig>(join(out, "docs", "config.json")),
            pages: readPages(join(out, "docs")),
            examples: readJson<ExamplesConfig>(join(out, "examples.json")),
            manifests,
            ...(registry ? { registry } : {}),
        }),
    ];
}
