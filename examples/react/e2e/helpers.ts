import { expect, type Page } from "@playwright/test";
import { listExampleSlugs } from "../scripts/examples-lib.ts";
import { THEMES, type ThemeName } from "../src/examples/_themes/themes";

// The examples run in the embed app, addressed by its directory URL (`…/?id=`, §5.1 of the
// site export contract), alone on the page: the stage is the page's own `data-testid="stage"`,
// and the site's Reset (which reloads the iframe) is a reload.

export const EXAMPLES = listExampleSlugs().map((slug) => ({ slug }));
export { THEMES };

/** Opens an example in a theme and waits for its grid to mount. */
export async function openExample(
    page: Page,
    slug: string,
    options: { theme?: ThemeName } = {},
) {
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
