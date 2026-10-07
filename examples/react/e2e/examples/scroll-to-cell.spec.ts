import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { boxOf, cell, expectInView, settle, viewport } from "./helpers";

// React Data Grid's ScrollToCell example: a row, a column or a cell scrolled into view from
// outside the grid (the engine's `scroll-to-cell` through a grid ref), aligned as chosen.

/** The body's visible box: inside the viewport's border, below the header, right of the pin. */
async function bodyBox(page: Page) {
    return viewport(page).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const header = element.querySelector('[data-grid-part="header"]');
        const top =
            rect.top +
            element.clientTop +
            (header?.getBoundingClientRect().height ?? 0);
        const left = rect.left + element.clientLeft;
        return {
            top,
            bottom: rect.top + element.clientTop + element.clientHeight,
            left,
            right: left + element.clientWidth,
        };
    });
}

async function go(page: Page, row: string, column: string) {
    await page.getByLabel("Row").fill(row);
    await page.getByLabel("Column").fill(column);
}

test("scrolls a cell to the centre of the view, far down and far to the right", async ({
    page,
}) => {
    await openExample(page, "scroll-to-cell");
    await go(page, "5000", "120");
    await page.getByRole("button", { name: "Scroll to cell" }).click();
    await settle(page);
    const target = cell(page, 5000, 120);
    await expectInView(page, target);
    const body = await bodyBox(page);
    const box = await boxOf(target);
    // centred on the rows' axis, within a row
    expect(
        Math.abs(box.y + box.height / 2 - (body.top + body.bottom) / 2),
    ).toBeLessThan(34);
    await expect(target).toHaveText("5000 × 120");
});

test("aligns a row at the start and a column at the end, one axis at a time", async ({
    page,
}) => {
    await openExample(page, "scroll-to-cell");
    await page.getByLabel("Start").check();
    await go(page, "300", "199");
    await page.getByRole("button", { name: "Scroll to row" }).click();
    await settle(page);
    const body = await bodyBox(page);
    // the row's top at the body's top; the columns untouched (the first one still in view)
    expect(
        Math.abs((await boxOf(cell(page, 300, 0))).y - body.top),
    ).toBeLessThan(1.5);
    await expect(cell(page, 300, 1)).toBeVisible();

    await page.getByLabel("End").check();
    await page.getByRole("button", { name: "Scroll to column" }).click();
    await settle(page);
    const last = await boxOf(cell(page, 300, 199));
    expect(Math.abs(last.x + last.width - body.right)).toBeLessThan(1.5);
    // the row stayed where it was
    expect(
        Math.abs((await boxOf(cell(page, 300, 0))).y - body.top),
    ).toBeLessThan(1.5);
});

test("makes a cell active: the grid scrolls it into view", async ({ page }) => {
    await openExample(page, "scroll-to-cell");
    await go(page, "9000", "60");
    await page.getByRole("button", { name: "Make it active" }).click();
    await settle(page);
    const target = cell(page, 9000, 60);
    await expect(target).toHaveAttribute("data-active", "");
    await expectInView(page, target);
});
