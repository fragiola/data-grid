// `pnpm site:export --base /<slug> --out <dir>`: the site export, contract v1.2 (fragiola/www
// CONTRACT.md). Writes what fragiola.com is built from, with this repo's own install:
//
//   <out>/project.json               site/project.json
//   <out>/docs/                      site/docs, as written (links are base-free)
//   <out>/examples.json              the categories as levels (meta-types.ts) and the themes (_themes/), with CSS
//   <out>/embed/react/               the examples app (examples/react), built for
//                                    <base>/embed/react/, with manifest.json
//
// Then it validates the output against the contract (site/contract.ts) and exits non-zero on
// any problem. It only deletes --out when the folder holds a previous export.

import { execFileSync } from "node:child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { CONTRACT_VERSION, validateExport } from "./contract.ts";
import {
    buildExamplesConfig,
    buildManifests,
    DOCS_DIR,
    readProject,
} from "./sources.ts";

const REPO = resolve(import.meta.dirname, "..");

const { values } = parseArgs({
    options: {
        base: { type: "string" },
        out: { type: "string" },
    },
});
if (values.base === undefined || !values.out) {
    console.error("usage: pnpm site:export --base /<slug> --out <dir>");
    process.exit(1);
}
// "/data-grid", "data-grid/" → "/data-grid"; "/" → ""
const base = `/${values.base}`.replace(/\/+/g, "/").replace(/\/$/, "");
const out = resolve(values.out);

// Only ever replace a previous export: never wipe a directory we did not write.
if (existsSync(out) && readdirSync(out).length > 0) {
    if (!existsSync(join(out, "project.json"))) {
        console.error(`${out} is not empty and is not a previous export`);
        process.exit(1);
    }
    rmSync(out, { recursive: true });
}

const run = (args: string[], env: Record<string, string> = {}) =>
    execFileSync("pnpm", args, {
        cwd: REPO,
        stdio: "inherit",
        env: { ...process.env, ...env },
    });

const write = (file: string, content: string) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
};
const json = (value: unknown) => `${JSON.stringify(value, null, 4)}\n`;

const project = readProject();

// ─── embed apps ─────────────────────────────────────────────────────────────
// Built against the packages' dist, like any consumer.
run([
    "--filter",
    "@fragiola/data-grid",
    "--filter",
    "@fragiola/data-grid-react",
    "build",
]);
const manifests = await buildManifests();
for (const framework of project.frameworks) {
    const embed = join(out, "embed", framework);
    run(
        [
            "--filter",
            `examples-${framework}`,
            "exec",
            "sh",
            "-c",
            `node scripts/generate.ts && vite build --outDir "${embed}" --emptyOutDir`,
        ],
        { EMBED_BASE: `${base}/embed/${framework}/` },
    );
    write(join(embed, "manifest.json"), json(manifests.get(framework)));
}

// ─── pages, gallery, project ─────────────────────────────────────────────────
cpSync(DOCS_DIR, join(out, "docs"), { recursive: true });
write(join(out, "examples.json"), json(buildExamplesConfig()));
write(join(out, "project.json"), json(project));

// ─── self-validation ─────────────────────────────────────────────────────────
const problems = validateExport(out, base);
if (problems.length > 0) {
    for (const problem of problems) console.error(`error: ${problem}`);
    console.error(`site export: ${problems.length} problem(s)`);
    process.exit(1);
}
console.log(
    `site export (contract v${CONTRACT_VERSION}) → ${out} (base ${base || "/"})`,
);
