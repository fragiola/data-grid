import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell } from "./helpers";

test("Tab moves across the row, then to the next row's first cell", async ({
    page,
}) => {
    await openExample(page, "custom-navigation");
    await cell(page, 0, 2).click();
    await page.keyboard.press("Tab");
    await expect(cell(page, 0, 3)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cell(page, 1, 0)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(cell(page, 0, 3)).toBeFocused();
});

test("Tab loops over the row, or leaves the grid, as chosen", async ({
    page,
}) => {
    await openExample(page, "custom-navigation");
    await page.getByLabel("Tab loops over the row").check();
    await cell(page, 4, 3).click();
    await page.keyboard.press("Tab");
    await expect(cell(page, 4, 0)).toBeFocused();

    await page.getByLabel("Tab leaves the grid").check();
    await cell(page, 4, 1).click();
    await page.keyboard.press("Tab");
    await expect(page.locator('[data-grid-part="cell"]:focus')).toHaveCount(0);
});
