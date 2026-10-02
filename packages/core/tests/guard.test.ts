import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The architecture rules a code review would miss (AGENTS.md, D2 and the core rules): the core
// has no dependencies, never imports React, never touches the browser globals, exports no `any`,
// and every file derived from a reference project says so.

const root = join(import.meta.dirname, "..");
const src = join(root, "src");

function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

/** Source text with comments and string literals blanked out, so only code is scanned. */
function codeOnly(source: string): string {
    return source.replace(
        /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g,
        (match) => (match.startsWith("/") ? "" : '""'),
    );
}

// the core never reaches for the browser globals: DOM access goes through an element's
// ownerDocument/defaultView, so the model loads in Node and the engine runs in any document
const GLOBAL_DOM =
    /(?<![.\w$])(document|window|requestAnimationFrame|cancelAnimationFrame|getComputedStyle|navigator|localStorage|sessionStorage|ResizeObserver)\b(?!\s*:)/;

const IMPORT_REACT =
    /(?:from\s+|import\s+|import\s*\(\s*|require\s*\(\s*)["'](?:react|react-dom)(?:\/[^"']*)?["']/;

/**
 * The files derived from a reference project (D2), each with the project it comes from. A file
 * here starts with a line comment naming the project, its copyright and the MIT licence, and the
 * root LICENSE carries that project's notice.
 */
const DERIVED: { file: string; from: keyof typeof NOTICES }[] = [
    { file: "src/model/sort.ts", from: "react-data-grid" },
];

/** What a derived file's header and the root LICENSE must name, per reference project. */
const NOTICES = {
    "react-data-grid": [
        "Copyright (c) 2014 Prometheus Research",
        "Copyright 2015 Comcast",
    ],
    "tanstack-table": ["Copyright (c) 2016 Tanner Linsley"],
} as const;

/**
 * The exported declarations of a source (comments and strings already blanked): each `export`
 * statement up to its end (the first `;` or blank-line-terminated block at column 0).
 */
function exportedDeclarations(source: string): string[] {
    const declarations: string[] = [];
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (!line.startsWith("export ")) continue;
        const block = [line];
        // a multi-line declaration runs until a line closing it at column 0
        if (!/;\s*$/.test(line) && !/^export \{.*\}.*;?$/.test(line)) {
            for (let j = i + 1; j < lines.length; j++) {
                const next = lines[j] ?? "";
                block.push(next);
                if (/^[}\]);]/.test(next)) break;
            }
        }
        declarations.push(block.join("\n"));
    }
    return declarations;
}

/** The leading line comments of a file, joined into one sentence. */
function header(file: string): string {
    return (
        /^(?:\/\/[^\n]*\n)+/.exec(readFileSync(file, "utf8"))?.[0] ?? ""
    ).replace(/\s*\n\/\/\s*|\s+/g, " ");
}

describe("core package guard", () => {
    it("has no runtime or peer dependencies", () => {
        const pkg = JSON.parse(
            readFileSync(join(root, "package.json"), "utf8"),
        ) as Record<string, unknown>;
        expect(pkg.dependencies ?? {}).toEqual({});
        expect(pkg.peerDependencies ?? {}).toEqual({});
    });

    it("never imports react or react-dom", () => {
        const offenders = listFiles(src).filter((file) =>
            IMPORT_REACT.test(readFileSync(file, "utf8")),
        );
        expect(offenders).toEqual([]);
    });

    it("never touches global document, window, observers or frame scheduling", () => {
        const offenders = listFiles(src).flatMap((file) => {
            const match = GLOBAL_DOM.exec(codeOnly(readFileSync(file, "utf8")));
            return match ? [`${file}: ${match[0]}`] : [];
        });
        expect(offenders).toEqual([]);
    });

    it("has no `any` in its exported declarations", () => {
        const offenders = listFiles(src).flatMap((file) =>
            exportedDeclarations(codeOnly(readFileSync(file, "utf8")))
                .filter((declaration) => /\bany\b/.test(declaration))
                .map((declaration) => `${file}: ${declaration.slice(0, 80)}`),
        );
        expect(offenders).toEqual([]);
    });

    it("every derived file names its source project, copyright and the MIT licence", () => {
        const missing = DERIVED.filter(({ file, from }) => {
            const path = join(root, file);
            if (!existsSync(path)) return true;
            const head = header(path);
            return !(
                head.includes(from) &&
                head.includes("MIT") &&
                NOTICES[from].every((line) => head.includes(line))
            );
        });
        expect(missing).toEqual([]);
    });

    it("ships the root licence in each package, with the notice of every project code derives from", () => {
        const rootLicence = readFileSync(
            join(root, "..", "..", "LICENSE"),
            "utf8",
        );
        for (const { from } of DERIVED) {
            for (const line of NOTICES[from]) {
                expect(rootLicence).toContain(line);
            }
        }
        for (const pkg of ["core", "react"]) {
            expect(readFileSync(join(root, "..", pkg, "LICENSE"), "utf8")).toBe(
                rootLicence,
            );
        }
    });

    // the detectors themselves
    it("detects global DOM access in code but not in comments, strings or parameters", () => {
        const found = (code: string) => GLOBAL_DOM.test(codeOnly(code));
        expect(found("const el = document.createElement('div');")).toBe(true);
        expect(found("requestAnimationFrame(() => {});")).toBe(true);
        expect(found("new ResizeObserver(cb);")).toBe(true);
        expect(
            found("el.ownerDocument.defaultView.requestAnimationFrame(cb);"),
        ).toBe(false);
        expect(found("view.ResizeObserver")).toBe(false);
        expect(found('// the window\nif (type === "window") {}')).toBe(false);
        expect(found("function f(window: Window) {}")).toBe(false);
    });

    it("detects a react import and an exported any", () => {
        expect(IMPORT_REACT.test('import type * as React from "react";')).toBe(
            true,
        );
        expect(IMPORT_REACT.test('import "react-dom/client";')).toBe(true);
        expect(IMPORT_REACT.test('import { x } from "./reactive";')).toBe(
            false,
        );
        expect(
            exportedDeclarations("export type X = any;\nconst y: any = 1;"),
        ).toEqual(["export type X = any;"]);
    });
});
