import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "../src/examples/_themes/themes";
import { blend, contrast, oklchToSrgb, parseOklch, type RGB } from "./color";

// The theme contract: every palette of every theme declares the six
// roles, every theme declares the same palettes and shape tokens, text
// meets WCAG AA on the surfaces it is drawn on, and a theme only sets values:
// it styles no markup, so everything an example looks like is in its own code.

const DIR = join(import.meta.dirname, "../src/examples/_themes");
const ROLES = ["base", "soft", "line", "contrast", "accent", "ring"] as const;
const TOKENS = [
    "font",
    "font-size",
    "numeric-font",
    "cell-padding",
    "radius",
    "border",
    "shadow",
    "gridline",
    "header-weight",
    "header-transform",
    "header-tracking",
    "active-width",
    "active-style",
    "zebra",
    "motion",
    // per palette: they read the palette the element sits in
    "header-bg",
    "row-alt-bg",
    "row-hover-bg",
    "gridline-color",
    "active-line",
    "loading-bg",
];
const NEUTRAL = ["surface", "raised"];

type Palettes = Map<string, Map<string, string>>;

function parse(name: string): { palettes: Palettes; tokens: Set<string> } {
    const css = readFileSync(join(DIR, `${name}.css`), "utf-8");
    const palettes: Palettes = new Map();
    const block = new RegExp(
        String.raw`:root \[data-example-theme="${name}"\] \.palette-([a-z-]+),[^{]*\{([^}]*)\}`,
        "g",
    );
    for (const [, palette, body] of css.matchAll(block)) {
        const roles = new Map<string, string>();
        for (const [, role, value] of (body ?? "").matchAll(
            /--palette-([a-z]+):\s*([^;]+);/g,
        )) {
            roles.set(role ?? "", value ?? "");
        }
        palettes.set(palette ?? "", roles);
    }
    const tokens = new Set(
        [...css.matchAll(/--dg-([a-z-]+):/g)].map(([, token]) => token ?? ""),
    );
    return { palettes, tokens };
}

/** Every rule of a theme file: its selectors and the properties it declares. */
function rules(name: string): { selectors: string[]; properties: string[] }[] {
    const css = readFileSync(join(DIR, `${name}.css`), "utf-8").replace(
        /\/\*[\s\S]*?\*\//g,
        "",
    );
    return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, head, body]) => ({
        selectors: (head ?? "")
            .split(",")
            .map((s) => s.trim().replace(/\s+/g, " ")),
        properties: (body ?? "")
            .split(";")
            .map((declaration) => declaration.split(":")[0]?.trim() ?? "")
            .filter(Boolean),
    }));
}

function color(roles: Map<string, string>, role: string): RGB {
    return oklchToSrgb(parseOklch(roles.get(role) ?? ""));
}

const parsed = THEMES.map((theme) => ({ theme, ...parse(theme.name) }));
const reference = parsed[0];

describe.each(parsed)("theme $theme.name", ({ theme, palettes, tokens }) => {
    it("only sets values: custom properties on the theme and on its palettes", () => {
        const scope = `[data-example-theme="${theme.name}"]`;
        const allowed = [
            scope,
            new RegExp(
                String.raw`^:root \[data-example-theme="${theme.name}"\] ?(\.palette-[a-z-]+|\[class\*="palette-"\])$`,
            ),
        ];
        for (const rule of rules(theme.name)) {
            for (const selector of rule.selectors) {
                expect(
                    allowed.some((pattern) =>
                        typeof pattern === "string"
                            ? pattern === selector
                            : pattern.test(selector),
                    ),
                    selector,
                ).toBe(true);
            }
            for (const property of rule.properties) {
                expect(
                    property.startsWith("--") || property === "color-scheme",
                    `${rule.selectors[0]}: ${property}`,
                ).toBe(true);
            }
        }
    });

    it("declares the same palettes as the others", () => {
        expect([...palettes.keys()].sort()).toEqual(
            [...(reference?.palettes.keys() ?? [])].sort(),
        );
        expect(palettes.size).toBeGreaterThanOrEqual(7);
    });

    it("declares all six roles in every palette", () => {
        for (const [palette, roles] of palettes) {
            expect([...roles.keys()].sort(), palette).toEqual(
                [...ROLES].sort(),
            );
        }
    });

    it("declares every shape token", () => {
        expect([...tokens].sort()).toEqual([...TOKENS].sort());
    });

    it("draws contrast text on base at AA (4.5:1) in every palette", () => {
        for (const [palette, roles] of palettes) {
            const ratio = contrast(
                color(roles, "contrast"),
                color(roles, "base"),
            );
            expect(
                ratio,
                `${palette}: contrast on base`,
            ).toBeGreaterThanOrEqual(4.5);
        }
    });

    it("draws secondary text (accent/85) at AA on the neutral surfaces", () => {
        for (const palette of NEUTRAL) {
            const roles = palettes.get(palette);
            expect(roles, palette).toBeDefined();
            if (!roles) continue;
            for (const background of ["base", "soft"]) {
                const bg = color(roles, background);
                const text = blend(color(roles, "accent"), bg, 0.85);
                expect(
                    contrast(text, bg),
                    `${palette}: accent/85 on ${background}`,
                ).toBeGreaterThanOrEqual(4.5);
            }
        }
    });
});
