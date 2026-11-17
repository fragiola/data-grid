import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    type ExamplesApp,
    examplesApp,
} from "../../examples/shared/scripts/examples-lib.ts";
import type { Framework } from "../../examples/shared/src/framework.ts";
import { validateExport } from "../contract.ts";
import {
    buildExamplesConfig,
    buildManifests,
    DOCS_DIR,
    embedBuilds,
    frameworksOf,
    readProject,
} from "../sources.ts";

// The export handles any number of frameworks: one manifest and one embed per framework of
// project.json, each from its own app. A fake Vue app (two examples) stands in for a second one.

let dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs = [];
});

function temp(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(dir);
    return dir;
}

/** A Vue app with hello-grid and large-dataset only: a framework may ship a subset. */
function fakeVueApp(): ExamplesApp {
    const app = examplesApp("vue", temp("examples-vue-"));
    for (const slug of ["hello-grid", "large-dataset"]) {
        mkdirSync(join(app.examplesDir, slug), { recursive: true });
        writeFileSync(
            join(app.examplesDir, slug, "index.vue"),
            '<script setup lang="ts">\nimport { DataGrid } from "@fragiola/data-grid-vue";\n</script>\n',
        );
    }
    return app;
}

const appOf = (vue: ExamplesApp) => (framework: Framework) =>
    framework === "vue" ? vue : examplesApp(framework);

describe("the frameworks of project.json", () => {
    it("are known frameworks; an unknown one throws", () => {
        expect(frameworksOf(readProject())).toEqual([
            "react",
            "vue",
            "angular",
        ]);
        expect(frameworksOf({ frameworks: ["react", "vue"] })).toEqual([
            "react",
            "vue",
        ]);
        expect(() => frameworksOf({ frameworks: ["svelte"] })).toThrow(
            /framework "svelte"/,
        );
    });

    it("each get an embed under <base>/embed/<framework>/ and <out>/embed/<framework>", () => {
        expect(embedBuilds(["react", "vue"], "/data-grid", "/out")).toEqual([
            {
                framework: "react",
                package: "examples-react",
                base: "/data-grid/embed/react/",
                dir: "/out/embed/react",
            },
            {
                framework: "vue",
                package: "examples-vue",
                base: "/data-grid/embed/vue/",
                dir: "/out/embed/vue",
            },
        ]);
    });

    it("each get a manifest built from their own app", async () => {
        const manifests = await buildManifests(
            ["react", "vue"],
            appOf(fakeVueApp()),
        );
        expect([...manifests.keys()]).toEqual(["react", "vue"]);
        const vue = manifests.get("vue");
        expect(vue?.examples.map((e) => e.id)).toEqual([
            "hello-grid",
            "large-dataset",
        ]);
        expect(vue?.examples[0]?.files).toEqual(["hello-grid/index.vue"]);
        expect(vue?.examples[0]?.packages).toEqual([
            "@fragiola/data-grid",
            "@fragiola/data-grid-vue",
        ]);
        expect(manifests.get("react")?.examples.length ?? 0).toBeGreaterThan(2);
    });

    it("validate as an export with several frameworks, each embed checked on its own", async () => {
        const out = temp("site-export-");
        const base = "/data-grid";
        // every framework the docs name: a page's <Framework> block needs its framework
        const frameworks: Framework[] = ["react", "vue", "angular"];
        const project = { ...readProject(), frameworks };
        const manifests = await buildManifests(frameworks, appOf(fakeVueApp()));
        cpSync(DOCS_DIR, join(out, "docs"), { recursive: true });
        const json = (value: unknown) => `${JSON.stringify(value, null, 4)}\n`;
        writeFileSync(join(out, "project.json"), json(project));
        writeFileSync(join(out, "examples.json"), json(buildExamplesConfig()));
        for (const embed of embedBuilds(frameworks, base, out)) {
            mkdirSync(embed.dir, { recursive: true });
            // the vue embed forgets noindex: only it is reported
            const robots =
                embed.framework !== "vue"
                    ? '<meta name="robots" content="noindex">'
                    : "";
            writeFileSync(
                join(embed.dir, "index.html"),
                `<!doctype html>\n<html>\n<head>${robots}\n<script type="module" src="${embed.base}assets/index.js"></script>\n</head>\n</html>\n`,
            );
            writeFileSync(
                join(embed.dir, "manifest.json"),
                json(manifests.get(embed.framework)),
            );
        }
        const problems = validateExport(out, base);
        expect(
            problems.filter((p) => /embed\/(react|angular)\//.test(p)),
        ).toEqual([]);
        expect(problems).toEqual([
            expect.stringMatching(
                /^embed\/vue\/index\.html:3: needs <meta name="robots"/,
            ),
        ]);
    });
});
