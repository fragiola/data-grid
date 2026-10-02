import { expect, test } from "@playwright/test";
import { THEMES } from "./helpers";

// The example themes (src/examples/_themes) belong to this app, so their checks run here, on
// computed styles (verify by compiling, not by reading class names). Their shape on a grid is
// checked by the examples' own specs.

test("the themes paint different floors, whatever the page theme", async ({
    page,
}) => {
    const seen = new Set<string>();
    for (const theme of THEMES) {
        await page.goto(`./?theme=${theme.name}`);
        await expect(page.locator("body")).toHaveAttribute(
            "data-example-theme",
            theme.name,
        );
        seen.add(
            await page
                .getByTestId("stage")
                .evaluate((el) => getComputedStyle(el).backgroundColor),
        );
    }
    expect(seen.size).toBe(THEMES.length);
});

test("a theme declares the grid tokens the examples read", async ({ page }) => {
    for (const theme of THEMES) {
        await page.goto(`./?theme=${theme.name}`);
        const tokens = await page.getByTestId("stage").evaluate((el) => {
            const style = getComputedStyle(el);
            return ["--dg-font", "--dg-cell-padding", "--dg-active-line"].map(
                (name) => style.getPropertyValue(name).trim(),
            );
        });
        for (const value of tokens) expect(value, theme.name).not.toBe("");
    }
});
