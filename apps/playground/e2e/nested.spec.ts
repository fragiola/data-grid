import { expect, type Page, test } from "@playwright/test";

// A grid nested in a cell of another one is its own grid (#17), in Chromium, Firefox and WebKit.

async function open(page: Page, query = "") {
    await page.goto(`/fixtures/nested-grid/${query}`);
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

test("an inner grid is no tab stop of its own: Tab from a cell not holding one leaves the grid (Epic #89)", async ({
    page,
}) => {
    await open(page);
    // no inner grid's cell nor grid is in the tab order while its outer cell is not active
    await outer(page, 0, 1).click();
    await expect(
        page.locator('[data-grid-name="inner"][tabindex="0"]'),
    ).toHaveCount(0);
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("after")).toBeFocused();
    // the outer cell holding one: its inner grid (and only it) is reachable
    await outer(page, 0, 1).click();
    await page.keyboard.press("ArrowRight");
    await expect(
        page
            .getByRole("grid", { name: "Items of order 1" })
            .and(page.locator('[tabindex="0"]')),
    ).toHaveCount(1);
    await expect(
        page
            .getByRole("grid", { name: /Items of order/ })
            .and(page.locator('[tabindex="0"]')),
    ).toHaveCount(1);
});

test("an inner grid keeps a tab stop of its own with ownTabStop", async ({
    page,
}) => {
    await open(page, "?ownTabStop=1");
    await outer(page, 0, 1).click();
    // the next cell holds an inner grid, a tab stop whatever the outer active cell
    await page.keyboard.press("Tab");
    await expect(inner(page, 0, 0, 0)).toBeFocused();
});
