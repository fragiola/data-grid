import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, pressTabOut } from "./helpers";

// React Data Grid's cell navigation modes (its CellNavigation example), from the cells' own
// onKeyDown: Tab leaving, going on to the next row, looping over the row or down the column, and
// the arrows wrapping at a row's ends.

const headerCell = (page: Page, columnIndex: number) =>
    page.locator(
        `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]`,
    );

test("Tab and the arrows go on to the next row's first cell", async ({
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
    // the arrows too, at the row's ends only
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 1, 0)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 1, 1)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(cell(page, 0, 3)).toBeFocused();
});

test("Tab and the arrows loop over the row", async ({ page }) => {
    await openExample(page, "custom-navigation");
    await page.getByLabel("Tab and the arrows loop over the row").check();
    await cell(page, 4, 3).click();
    await page.keyboard.press("Tab");
    await expect(cell(page, 4, 0)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(cell(page, 4, 3)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 4, 0)).toBeFocused();
});

test("Tab moves down the column, through the header after the last row", async ({
    page,
}) => {
    await openExample(page, "custom-navigation");
    await page.getByLabel("Tab moves down the column").check();
    await cell(page, 2, 1).click();
    await page.keyboard.press("Tab");
    await expect(cell(page, 3, 1)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(cell(page, 0, 1)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(headerCell(page, 1)).toBeFocused();
    // before the header, the last row
    await page.keyboard.press("Shift+Tab");
    await expect(cell(page, 999, 1)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(headerCell(page, 1)).toBeFocused();
});

test("Tab leaves the grid, as it does by default", async ({ page }) => {
    await openExample(page, "custom-navigation");
    await page.getByLabel("Tab leaves the grid").check();
    await cell(page, 4, 1).click();
    await pressTabOut(page);
    await expect(page.locator('[data-grid-part="cell"]:focus')).toHaveCount(0);
});
