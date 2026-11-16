import { expect, type Page, test } from "@playwright/test";
import { examplesApp, listExampleSlugs } from "../scripts/examples-lib.ts";
import { THEMES, type ThemeName } from "../src/themes/themes.ts";
import { embedBase, frameworkOf, skipOrFail } from "./available.ts";

// The examples run in a framework's embed app, addressed by its directory URL (`…/?id=`, §5.1 of
// the site export contract), alone on the page: the stage is the page's own `data-testid="stage"`,
// and the site's Reset (which reloads the iframe) is a reload.
//
// Every framework runs these specs (config.ts). They reach the examples only through what every
// adapter reproduces: the grid's `data-grid-part` and `data-*` state, roles and accessible names,
// the markup and test ids the example renders itself; never a class name or a framework detail.

/** The framework under test, set by the app's playwright.config.ts. */
export const FRAMEWORK = frameworkOf(process.env.EXAMPLES_FRAMEWORK);
/** Where the e2e server mounts its embed (serve.ts). */
export const EMBED_BASE = embedBase(FRAMEWORK);
const AVAILABLE = listExampleSlugs(examplesApp(FRAMEWORK));
/** The framework's examples: a spec loops over these, never over a fixed list. */
export const EXAMPLES = AVAILABLE.map((slug) => ({ slug }));
export { THEMES };

/**
 * Skips the running test (or, at the top of a spec file, the whole file) when the framework has
 * not every one of these examples: a framework may ship a subset of them. A complete framework
 * (`COMPLETE_FRAMEWORKS`) fails instead.
 */
export function requireExamples(...slugs: string[]) {
    const reason = skipOrFail(FRAMEWORK, AVAILABLE, slugs);
    test.skip(reason !== undefined, reason);
}

/**
 * Opens an example in a theme and waits for its grid to mount. Skips the test when the framework
 * has no such example.
 */
export async function openExample(
    page: Page,
    slug: string,
    options: { theme?: ThemeName } = {},
) {
    requireExamples(slug);
    const params = new URLSearchParams({ id: slug });
    if (options.theme) params.set("theme", options.theme);
    await page.goto(`./?${params}`);
    const stage = page.getByTestId("stage");
    if (options.theme) {
        await expect(page.locator("body")).toHaveAttribute(
            "data-example-theme",
            options.theme,
        );
    }
    await expect(part(page, "root").first()).toBeVisible();
    return stage;
}

/** The site's Reset: it reloads the example's frame. */
export async function reset(page: Page) {
    await page.reload();
    await expect(part(page, "root").first()).toBeVisible();
}

/** Collects console errors and uncaught exceptions for the page's lifetime. */
export function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    return errors;
}

/** The grid parts of a kind inside the stage (`data-grid-part`). */
export function part(page: Page, name: string) {
    return page.getByTestId("stage").locator(`[data-grid-part="${name}"]`);
}
