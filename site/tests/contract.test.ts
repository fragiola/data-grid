import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { listExampleSlugs } from "../../examples/react/scripts/examples-lib.ts";
import {
    anchorsOf,
    noindexProblem,
    type ProjectInfo,
    type Site,
    validateSite,
} from "../contract.ts";
import { readSite } from "../sources.ts";

// The export's sources meet the site export contract (v1.2), and the checks that guarantee it
// catch what `www` would reject: each case below breaks one rule on a copy of the real site.

let site: Site;

beforeAll(async () => {
    site = await readSite();
});

/** A copy of the site with one page replaced (or added). */
function withPage(path: string, source: string): Site {
    return { ...site, pages: new Map([...site.pages, [path, source]]) };
}

/** A description of 50–160 characters (v1.2). */
const DESCRIPTION =
    "A page of the contract tests, long enough to be a real description.";

const page = (body: string) =>
    `---\ntitle: T\ndescription: ${DESCRIPTION}\n---\n\n## A heading\n\n${body}\n`;

/** The landing's frontmatter: a title that names the project and says what it is. */
const LANDING = `---\ntitle: Data Grid — a test landing\ndescription: ${DESCRIPTION}\nlayout: landing\n---`;

/** The problems of a copy where `beyond-v0` (a listed page) has `body`. */
const problemsOf = (body: string) =>
    validateSite(withPage("beyond-v0", page(body)));

describe("the site export", () => {
    it("has the landing, every page in the sidebar and every example", () => {
        expect(site.pages.has("index")).toBe(true);
        const listed = site.config.sections.flatMap((section) =>
            section.pages.filter((entry) => "path" in entry),
        );
        expect(site.pages.size).toBe(listed.length + 1);
        expect(site.manifests.get("react")?.examples).toHaveLength(
            listExampleSlugs().length,
        );
    });

    it("passes the contract checks", () => {
        expect(validateSite(site)).toEqual([]);
    });
});

describe("the contract checks", () => {
    it("accept the vocabulary and base-free links", () => {
        expect(
            problemsOf(
                [
                    '<Example id="hello-grid" theme="ide" variant="card" height={400} />',
                    '<Callout type="info" title="x">y</Callout>',
                    "[a](/docs/concepts/keyboard) [b](/examples/large-dataset) [c](/) [d](#a-heading) [e](https://x.dev)",
                    '```tsx title="a.tsx"\nconst a = <Foo />;\n```',
                    "`<Inline />` is code",
                ].join("\n\n"),
            ),
        ).toEqual([]);
    });

    it("reject a component outside the vocabulary, and raw HTML", () => {
        expect(problemsOf("<Foo />")).toEqual([
            expect.stringContaining("<Foo> is not in the v1.1 vocabulary"),
        ]);
        expect(problemsOf("<div>x</div>").join()).toContain("<div>");
    });

    it("reject unknown props and bad values", () => {
        expect(problemsOf('<Example slug="hello-grid" />').join()).toMatch(
            /takes no "slug".*needs "id"/,
        );
        expect(problemsOf('<Example id="nope" />').join()).toContain(
            "is not an example",
        );
        expect(
            problemsOf('<Example id="large-dataset" theme="neon" />').join(),
        ).toContain("not in examples.json");
        expect(
            problemsOf('<Callout type="warning">x</Callout>').join(),
        ).toContain('<Callout type="warning">');
        expect(problemsOf('<Hero title="x" />').join()).toContain(
            "landing only",
        );
    });

    it("accept the v1.1 landing vocabulary on the landing, and only there", () => {
        const landing = [
            LANDING,
            '<Hero eyebrow="e" title="t" background="grid" actions={[',
            '    { label: "Docs", href: "/docs/concepts/keyboard", variant: "primary", icon: "arrow" },',
            '    { label: "Browse {examples} examples", href: "/examples", variant: "secondary" },',
            '    { label: "GitHub", href: "https://github.com/x", variant: "ghost", icon: "external" },',
            "]} />",
            '<Example id="large-dataset" variant="showcase" theme="ide" label="Themes:" />',
            '<Features columns={4} numbered>\n<Feature title="a">b</Feature>\n</Features>',
            '<Section title="t" eyebrow="e" description="d">',
            '<Pills strike items={["CSS", "Icons"]} />',
            "</Section>",
        ].join("\n\n");
        expect(validateSite(withPage("index", landing))).toEqual([]);
        expect(problemsOf('<Section title="t">x</Section>').join()).toContain(
            "<Section> belongs on the landing only",
        );
        expect(problemsOf('<Pills items={["a"]} />').join()).toContain(
            "<Pills> belongs on the landing only",
        );
    });

    it("reject bad v1.1 values", () => {
        const onLanding = (body: string) =>
            validateSite(withPage("index", `${LANDING}\n\n${body}\n`)).join();
        expect(
            onLanding(
                '<Hero title="t" actions={[{ label: "x", href: "/", variant: "loud" }]} />',
            ),
        ).toContain("<Hero actions> takes a list");
        expect(
            onLanding('<Hero title="t" actions={[{ label: "x" }]} />'),
        ).toContain("<Hero actions> takes a list");
        expect(onLanding('<Hero title="t" background="dots" />')).toContain(
            '<Hero background="dots">',
        );
        expect(
            onLanding(
                '<Features columns={5}><Feature title="a">b</Feature></Features>',
            ),
        ).toContain("<Features columns> takes 2, 3 or 4");
        expect(onLanding("<Pills items={[]} />")).toContain(
            "<Pills items> takes a list of strings",
        );
        expect(onLanding("<Feature>x</Feature>")).toContain(
            '<Feature> needs "title"',
        );
        expect(onLanding('<Example id="large-dataset" label="x" />')).toContain(
            '<Example label> goes with variant="showcase"',
        );
        expect(
            validateSite({
                ...site,
                project: { ...site.project, repository: "github.com/x" },
            }).join(),
        ).toContain("repository must be an https:// URL");
    });

    it("reject broken, relative and anchorless links", () => {
        expect(problemsOf("[x](/docs/nope)").join()).toContain(
            "no page /docs/nope",
        );
        expect(
            problemsOf("[x](/docs/concepts/keyboard#nope)").join(),
        ).toContain("no heading #nope");
        expect(problemsOf("[x](../concepts/keyboard.mdx)").join()).toContain(
            "relative link",
        );
        expect(problemsOf("[x](/examples/nope)").join()).toContain(
            'no example "nope"',
        );
        expect(problemsOf("[x](#nope)").join()).toContain("no heading #nope");
    });

    it("reject a code block without a language, and ESM", () => {
        expect(problemsOf("```\nx\n```").join()).toContain("takes a language");
        expect(problemsOf('import x from "y";').join()).toContain(
            "import/export",
        );
    });

    it("reject missing frontmatter, and a page missing from the sidebar", () => {
        expect(
            validateSite(withPage("beyond-v0", "# no frontmatter\n")).join(),
        ).toMatch(/title is required.*description is required/);
        expect(validateSite(withPage("extra", page(""))).join()).toContain(
            "extra.mdx is not listed",
        );
    });

    it("slug headings like Fumadocs", () => {
        expect([
            ...anchorsOf(
                "## The `onAction` hook\n\n## Tabs & tabsets\n\n## Tabs & tabsets\n",
            ),
        ]).toEqual(["the-onaction-hook", "tabs--tabsets", "tabs--tabsets-1"]);
    });
});

describe("the v1.2 checks", () => {
    const withProject = (changes: Partial<ProjectInfo>) =>
        validateSite({ ...site, project: { ...site.project, ...changes } });
    /** The problems of a landing with this frontmatter title and body. */
    const landing = (body: string, title = "Data Grid — a test landing") =>
        validateSite(
            withPage(
                "index",
                `---\ntitle: ${title}\ndescription: ${DESCRIPTION}\nlayout: landing\n---\n\n${body}\n`,
            ),
        );
    const HERO = '<Hero title="t" />';

    it("measure the project's description in code points (§2)", () => {
        expect(withProject({ description: "Too short." })).toEqual([
            "project.json: description is 10 characters: 50–160 (§2)",
        ]);
        expect(withProject({ description: "x".repeat(161) })).toEqual([
            "project.json: description is 161 characters: 50–160 (§2)",
        ]);
        // 50 code points, 100 UTF-16 units
        expect(withProject({ description: "🧩".repeat(50) })).toEqual([]);
    });

    it("check the keywords: 1–8 unique lowercase topics of at most 40 characters (§2)", () => {
        expect(withProject({ keywords: ["react", "tabs"] })).toEqual([]);
        expect(withProject({ keywords: [] })).toEqual([
            "project.json: keywords must list 1–8 topics (§2)",
        ]);
        expect(
            withProject({
                keywords: Array.from({ length: 9 }, (_, i) => `k${i}`),
            }),
        ).toEqual(["project.json: keywords must list 1–8 topics (§2)"]);
        expect(
            withProject({
                keywords: [
                    " tabs",
                    "",
                    3 as unknown as string,
                    "React",
                    "a".repeat(41),
                    "tabs",
                    "tabs",
                ],
            }),
        ).toEqual([
            'project.json: keywords: " tabs" is not a topic: a non-empty string, no surrounding spaces (§2)',
            'project.json: keywords: "" is not a topic: a non-empty string, no surrounding spaces (§2)',
            "project.json: keywords: 3 is not a topic: a non-empty string, no surrounding spaces (§2)",
            'project.json: keywords: "React" is not lowercase (§2)',
            `project.json: keywords: "${"a".repeat(41)}" is 41 characters: at most 40 (§2)`,
            'project.json: keywords: "tabs" is listed twice (§2)',
        ]);
    });

    it("measure the frontmatter's title and description, at their lines (§3.2)", () => {
        expect(
            validateSite(
                withPage(
                    "beyond-v0",
                    `---\ntitle: ${"t".repeat(61)}\ndescription: Short.\n---\n\n## A heading\n`,
                ),
            ),
        ).toEqual([
            "docs/beyond-v0.mdx:2: frontmatter: title is 61 characters: at most 60 (§3.2)",
            "docs/beyond-v0.mdx:3: frontmatter: description is 6 characters: 50–160 (§3.2)",
        ]);
        expect(
            validateSite(
                withPage(
                    "beyond-v0",
                    `---\ntitle: ${"é".repeat(60)}\ndescription: ${"é".repeat(160)}\n---\n`,
                ),
            ),
        ).toEqual([]);
    });

    it("reject a frontmatter value YAML would not read as text", () => {
        expect(
            validateSite(
                withPage(
                    "beyond-v0",
                    `---\ntitle: Hooks\ndescription: The lower layer: hooks under the primitives, for your own markup.\n---\n`,
                ),
            ),
        ).toEqual([
            `docs/beyond-v0.mdx:3: the frontmatter is not valid YAML: description's value has ": " or " #" in it; quote it`,
        ]);
        expect(
            validateSite(
                withPage(
                    "beyond-v0",
                    `---\ntitle: "Hooks: the lower layer"\ndescription: "The lower layer: hooks under the primitives, for your own markup."\n---\n`,
                ),
            ),
        ).toEqual([]);
    });

    it("reject a value that goes on past its line: an indented line, a block scalar (§3.2)", () => {
        const fm = (fields: string) =>
            validateSite(withPage("beyond-v0", `---\n${fields}\n---\n`));
        expect(
            fm(
                `title: Hooks\ndescription: ${DESCRIPTION}\n    and a second line that YAML reads as part of it.`,
            ),
        ).toEqual([
            "docs/beyond-v0.mdx:4: frontmatter: an indented line continues a value: write each field on one line (§3.2)",
        ]);
        expect(
            fm(`title: Hooks\ndescription: >\n    ${DESCRIPTION}`).slice(0, 2),
        ).toEqual([
            "docs/beyond-v0.mdx:3: frontmatter: description is a block scalar (>): write it on one line (§3.2)",
            "docs/beyond-v0.mdx:4: frontmatter: an indented line continues a value: write each field on one line (§3.2)",
        ]);
        expect(
            fm(`title: |-\n    Hooks\ndescription: ${DESCRIPTION}`),
        ).toContain(
            "docs/beyond-v0.mdx:2: frontmatter: title is a block scalar (|-): write it on one line (§3.2)",
        );
        expect(
            fm(`title: Hooks\nnot a field\ndescription: ${DESCRIPTION}`),
        ).toEqual([
            'docs/beyond-v0.mdx:3: the frontmatter is not valid YAML here: one "key: value" per line',
        ]);
        expect(
            fm(`# a comment\ntitle: Hooks\n\ndescription: ${DESCRIPTION}`),
        ).toEqual([]);
    });

    it("count a description on its plain text: inline code marks dropped (§2, §3.2)", () => {
        // 52 characters as written, 48 without the four backticks
        const description =
            "The `useDataGrid` hook and the `Root`, in one place.";
        expect([...description].length).toBe(52);
        expect(withProject({ description })).toEqual([
            "project.json: description is 48 characters: 50–160 (§2)",
        ]);
        expect(
            validateSite(
                withPage(
                    "beyond-v0",
                    `---\ntitle: T\ndescription: ${description}\n---\n`,
                ),
            ),
        ).toEqual([
            "docs/beyond-v0.mdx:3: frontmatter: description is 48 characters: 50–160 (§3.2)",
        ]);
    });

    it("want the landing's title to name the project and say what it is (§3.2)", () => {
        expect(landing(HERO)).toEqual([]);
        expect(landing(HERO, "Headless tables")).toEqual([
            'docs/index.mdx:2: frontmatter: the landing\'s title "Headless tables" is its <title>: it contains the project\'s title "Data Grid" (§3.2)',
        ]);
        expect(landing(HERO, "Data Grid")).toEqual([
            'docs/index.mdx:2: frontmatter: the landing\'s title is its <title>: say what Data Grid is, not only its name ("Data Grid — …") (§3.2)',
        ]);
    });

    it("want exactly one <Hero> on the landing (§3.4)", () => {
        expect(landing("Prose only.")).toEqual([
            "docs/index.mdx:1: the landing has no <Hero>: its title is the landing's h1 (§3.4)",
        ]);
        expect(landing(`${HERO}\n\n${HERO}`)).toEqual([
            "docs/index.mdx:9: a second <Hero>: the landing has exactly one, its only h1 (§3.4)",
        ]);
    });

    it("reject a Markdown # heading and a skipped level (§3.4)", () => {
        // the body of problemsOf starts on line 8, under "## A heading"
        expect(problemsOf("# Title")).toEqual([
            "docs/beyond-v0.mdx:8: a Markdown # heading: the page's h1 is its frontmatter title (§3.4)",
        ]);
        expect(problemsOf("#### Deep")).toEqual([
            "docs/beyond-v0.mdx:8: a #### heading after an h2: headings do not skip a level (§3.4)",
        ]);
        expect(
            validateSite(
                withPage(
                    "beyond-v0",
                    `---\ntitle: T\ndescription: ${DESCRIPTION}\n---\n\n### Steps first\n`,
                ),
            ),
        ).toEqual([
            "docs/beyond-v0.mdx:6: a ### heading after an h1: headings do not skip a level (§3.4)",
        ]);
        expect(landing(`${HERO}\n\n# Title`)).toEqual([
            "docs/index.mdx:9: a Markdown # heading: the page's h1 is its <Hero>'s title (§3.4)",
        ]);
        expect(landing(`${HERO}\n\n### Skipped`)).toEqual([
            "docs/index.mdx:9: a ### heading after an h1: headings do not skip a level (§3.4)",
        ]);
        expect(
            landing(
                `${HERO}\n\n<Section title="s">\n\n#### Too deep\n\n</Section>`,
            ),
        ).toEqual([
            "docs/index.mdx:11: a #### heading after an h2: headings do not skip a level (§3.4)",
        ]);
    });

    it("reject the heading forms the outline does not read: setext, quoted, in a list (§3.4)", () => {
        const setext =
            "a setext heading (a line of === or --- right under text): write headings as ## at the start of a line, and put a blank line before a --- rule (§3.4)";
        const nested =
            "a heading in a blockquote or a list item: write headings as ## at the start of a line (§3.4)";
        expect(problemsOf("An h1\n===")).toEqual([
            `docs/beyond-v0.mdx:8: ${setext}`,
        ]);
        expect(problemsOf("An h2\n---")).toEqual([
            `docs/beyond-v0.mdx:8: ${setext}`,
        ]);
        expect(problemsOf("> # quoted")).toEqual([
            `docs/beyond-v0.mdx:8: ${nested}`,
        ]);
        expect(problemsOf("- #### in a list")).toEqual([
            `docs/beyond-v0.mdx:8: ${nested}`,
        ]);
        expect(problemsOf("1. ## in an ordered list")).toEqual([
            `docs/beyond-v0.mdx:8: ${nested}`,
        ]);
        // a rule after a blank line, a table, a list item that is not a heading, code
        expect(
            problemsOf(
                [
                    "Text.\n\n---\n\nMore text.",
                    "| a | b |\n| --- | --- |\n| 1 | 2 |",
                    "- C# is not a heading\n- #hashtag neither",
                    "```md\nText\n===\n> # x\n```",
                ].join("\n\n"),
            ),
        ).toEqual([]);
    });

    it("read a <Card>'s title as an h3, wherever it is (§3.4)", () => {
        const cards =
            '<Cards>\n<Card title="Tabs" href="/docs/concepts/keyboard" />\n</Cards>';
        expect(problemsOf(`### Next\n\n${cards}`)).toEqual([]);
        // right under the page's h1
        expect(
            validateSite(
                withPage(
                    "beyond-v0",
                    `---\ntitle: T\ndescription: ${DESCRIPTION}\n---\n\n${cards}\n`,
                ),
            ),
        ).toEqual([
            "docs/beyond-v0.mdx:7: a <Card> (an h3) after an h1: headings do not skip a level (§3.4)",
        ]);
        // first thing after the Hero
        expect(landing(`${HERO}\n\n${cards}`)).toEqual([
            "docs/index.mdx:10: a <Card> (an h3) after an h1: headings do not skip a level (§3.4)",
        ]);
        // a Markdown heading after a Card compares against 3
        expect(problemsOf(`${cards}\n\n#### After the cards`)).toEqual([]);
        expect(problemsOf(`### x\n\n${cards}\n\n##### Too deep`)).toEqual([
            "docs/beyond-v0.mdx:14: a ##### heading after an h3: headings do not skip a level (§3.4)",
        ]);
    });

    it("accept an outline that only steps down one level, and headings in code (§3.4)", () => {
        expect(
            problemsOf(
                "### Sub\n\n#### Subsub\n\n## Back up\n\n```sh\n# a comment\n#### not a heading\n```",
            ),
        ).toEqual([]);
        expect(
            landing(
                [
                    HERO,
                    "## Top",
                    '<Section title="s">',
                    "### Inside the section",
                    '<Features><Feature title="f">x</Feature></Features>',
                    "#### Under a feature in a section",
                    "</Section>",
                    '<Features columns={2}>\n<Feature title="g">y</Feature>\n</Features>',
                    "### Under a feature outside a section",
                ].join("\n\n"),
            ),
        ).toEqual([]);
    });

    it("want alt text on every image (§3.4)", () => {
        expect(problemsOf("![](https://x.dev/a.png)")).toEqual([
            "docs/beyond-v0.mdx:8: an image needs alt text: ![what it shows](…) (§3.4)",
        ]);
        expect(problemsOf("![ ][shot]\n\n[shot]: https://x.dev/a.png")).toEqual(
            [
                "docs/beyond-v0.mdx:8: an image needs alt text: ![what it shows](…) (§3.4)",
            ],
        );
        expect(
            problemsOf("![Two tabsets side by side](https://x.dev/a.png)"),
        ).toEqual([]);
        // an image in inline code is code, not an image
        expect(
            problemsOf("Write `![](x.png)` for a decorative image."),
        ).toEqual([]);
    });

    it("want noindex in every HTML file of an embed app (§5.1)", () => {
        const html = (meta: string) =>
            `<!doctype html>\n<html>\n    <head>\n        ${meta}\n    </head>\n</html>\n`;
        const message =
            'needs <meta name="robots" content="noindex">: an example is not a page for search engines (§5.1)';
        expect(noindexProblem("embed/react/popout.html", html(""))).toBe(
            `embed/react/popout.html:3: ${message}`,
        );
        expect(
            noindexProblem(
                "embed/react/index.html",
                html('<meta name="robots" content="index" />'),
            ),
        ).toBe(`embed/react/index.html:3: ${message}`);
        expect(noindexProblem("embed/react/a.html", "<p>x</p>")).toBe(
            `embed/react/a.html: ${message}`,
        );
        expect(
            noindexProblem(
                "embed/react/index.html",
                html("<meta content='noindex, nofollow' name=robots>"),
            ),
        ).toBeUndefined();
        expect(
            noindexProblem(
                "embed/react/index.html",
                html("<meta name=robots content=noindex>"),
            ),
        ).toBeUndefined();
        // a <meta> in a comment does not count; the line is still the <head>'s
        expect(
            noindexProblem(
                "embed/react/index.html",
                `<!doctype html>\n<!--\n  <meta name="robots" content="noindex">\n-->\n<html>\n<head>\n</head>\n</html>\n`,
            ),
        ).toBe(`embed/react/index.html:6: ${message}`);
    });

    it("find noindex in the examples app's HTML (§5.1)", () => {
        const app = join(import.meta.dirname, "../../examples/react");
        for (const file of ["index.html"]) {
            expect(
                noindexProblem(file, readFileSync(join(app, file), "utf-8")),
            ).toBeUndefined();
        }
    });
});
