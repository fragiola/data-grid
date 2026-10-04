import { expect, test } from "@playwright/test";
import { collectErrors, EXAMPLES, openExample, reset, THEMES } from "./helpers";

// Every example mounts and logs no error, in the reference theme (the first of THEMES); a new
// example folder is covered without touching this file. A theme is CSS (its shape is checked in
// themes.spec.ts), so every theme runs on a representative set, not on every example.
// `E2E_ALL_THEMES=1` runs every example in every theme.

/** Examples run in every theme, chosen so that together they cover what a theme can break. */
const REPRESENTATIVE: string[] = [
    "hello-grid", // the baseline: header, rows, the active cell
    "styling-showcase", // presets made of palettes and fixed colours
    "table-elements", // the same look on table elements
    "windowed-loading", // placeholders and the request log beside the grid
    "keyboard-navigation", // the app's panel and buttons (Fragiola UI) around the grid
    "grouped-headers", // two header rows: group cells, a column spanning both
    "column-resizing", // the resize handles, drawn with the theme's tokens
    "column-reordering", // the drop indicator and the dragged cell, drawn with the theme's tokens
];

const slugs = new Set(EXAMPLES.map((example) => example.slug));
const missing = REPRESENTATIVE.filter((slug) => !slugs.has(slug));
if (missing.length > 0) {
    throw new Error(
        `smoke.spec.ts: REPRESENTATIVE names examples that do not exist: ${missing.join(", ")}`,
    );
}

const ALL_THEMES = process.env.E2E_ALL_THEMES === "1";
const [reference] = THEMES;

test("the index lists every example", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByTestId("stage").getByRole("link")).toHaveCount(
        EXAMPLES.length,
    );
});

for (const example of EXAMPLES) {
    const themes =
        ALL_THEMES || REPRESENTATIVE.includes(example.slug)
            ? THEMES
            : [reference];
    for (const theme of themes) {
        test(`${example.slug} renders in ${theme.name}`, async ({ page }) => {
            const errors = collectErrors(page);
            await openExample(page, example.slug, { theme: theme.name });
            // the site's Reset reloads the frame: the example must come back
            await reset(page);
            expect(errors).toEqual([]);
        });
    }
}
