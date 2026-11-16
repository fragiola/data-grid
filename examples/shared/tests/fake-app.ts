// A throwaway framework app for the tests: `examples/<framework>`'s layout in a temp directory.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type ExamplesApp, examplesApp } from "../scripts/examples-lib.ts";
import type { Framework } from "../src/framework.ts";

/** Writes `files` (paths relative to the app's src/examples) and returns the app and a cleanup. */
export function fakeApp(
    framework: Framework,
    files: Record<string, string>,
): { app: ExamplesApp; remove: () => void } {
    const root = mkdtempSync(join(tmpdir(), `examples-${framework}-`));
    const app = examplesApp(framework, root);
    for (const [path, content] of Object.entries(files)) {
        const file = join(app.examplesDir, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
    }
    mkdirSync(join(app.src, "embed"), { recursive: true });
    return {
        app,
        remove: () => rmSync(root, { recursive: true, force: true }),
    };
}
