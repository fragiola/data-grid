import { expect, type Page, test } from "@playwright/test";

// A grid nested in a cell of another one is its own grid (#17), in Chromium and Firefox.

async function open(page: Page) {
    await page.goto("/fixtures/nested-grid/");
    await expect(page.getByRole("grid", { name: "Orders" })).toBeVisible();
}

/** An outer cell, or a cell of the inner grid in the outer row `order` (0-based). */
const outer = (page: Page, rowIndex: number, columnIndex: number) =>
    page.locator(
        `[data-grid-name="outer"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
    );

const inner = (
    page: Page,
    order: number,
    rowIndex: number,
    columnIndex: number,
) =>
    page
        .getByRole("grid", { name: `Items of order ${order + 1}` })
        .locator(
            `[data-grid-name="inner"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
        );

test("a click in the inner grid activates its cell, and the outer cell that holds it", async ({
    page,
}) => {
    await open(page);
    await inner(page, 0, 1, 1).click();
    await expect(inner(page, 0, 1, 1)).toHaveAttribute("data-active", "");
    await expect(inner(page, 0, 1, 1)).toBeFocused();
    await expect(outer(page, 0, 2)).toHaveAttribute("data-active", "");
});

test("arrows inside the inner grid move only its active cell", async ({
    page,
}) => {
    await open(page);
    await inner(page, 0, 0, 0).click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await expect(inner(page, 0, 1, 1)).toBeFocused();
    await expect(inner(page, 0, 1, 1)).toHaveAttribute("data-active", "");
    // the outer grid stays on the cell holding the inner grid
    await expect(outer(page, 0, 2)).toHaveAttribute("data-active", "");
    await expect(
        page.locator('[data-grid-name="outer"][data-active]'),
    ).toHaveCount(1);
});

test("Tab from the outer cell enters the inner grid, and Shift+Tab returns", async ({
    page,
}) => {
    await open(page);
    await outer(page, 0, 1).click();
    await page.keyboard.press("ArrowRight");
    await expect(outer(page, 0, 2)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(inner(page, 0, 0, 0)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(outer(page, 0, 2)).toBeFocused();
});

test("the outer grid's keys focus its own cells, never the inner ones at the same indexes", async ({
    page,
}) => {
    await open(page);
    await outer(page, 1, 0).click();
    await page.keyboard.press("ArrowRight");
    await expect(outer(page, 1, 1)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(outer(page, 0, 1)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(outer(page, 0, 3)).toBeFocused();
    await expect(
        page.locator('[data-grid-name="inner"][data-active]'),
    ).toHaveCount(0);
});
