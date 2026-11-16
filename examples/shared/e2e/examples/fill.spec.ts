import { expect, type Locator, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { boxOf, cell, settle } from "./helpers";

// A shipping plan filled from a handle (Epic #88, E4.4): the grid tells the cells a drag fills;
// the app repeats the source or continues its series, and writes its rows.

const status = (page: Page) => page.getByRole("status");

const handle = (page: Page) => page.locator('[data-grid-part="fill-handle"]');

const units = async (page: Page, rowIndex: number, columnIndex: number) =>
    Number(await cell(page, rowIndex, columnIndex).textContent());

/** Drags the fill handle to a cell's centre and releases it. */
async function fillTo(page: Page, target: Locator) {
    const from = await boxOf(handle(page));
    const to = await boxOf(target);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
        steps: 6,
    });
    await settle(page);
    await expect(target).toHaveAttribute("data-fill-target", "");
    await page.mouse.up();
    await settle(page);
}

test("a drag down repeats the range's rows, the target drawn meanwhile", async ({
    page,
}) => {
    await openExample(page, "fill");
    await cell(page, 0, 1).click();
    await page.keyboard.press("Shift+ArrowDown");
    await expect(handle(page)).toHaveCount(1);
    await expect(
        cell(page, 1, 1).locator('[data-grid-part="fill-handle"]'),
    ).toHaveCount(1);
    const first = await units(page, 0, 1);
    const second = await units(page, 1, 1);
    await fillTo(page, cell(page, 4, 1));
    await expect(status(page)).toHaveText("Filled 3 cells.");
    expect(await units(page, 2, 1)).toBe(first);
    expect(await units(page, 3, 1)).toBe(second);
    expect(await units(page, 4, 1)).toBe(first);
    // the range grew to the filled cells: the handle at its new corner
    await expect(
        cell(page, 4, 1).locator('[data-grid-part="fill-handle"]'),
    ).toHaveCount(1);
});

test("a drag across continues a series in that mode", async ({ page }) => {
    await openExample(page, "fill");
    await page.getByRole("button", { name: "continues a series" }).click();
    await cell(page, 2, 2).click();
    await page.keyboard.press("Shift+ArrowRight");
    const before = await units(page, 2, 2);
    const last = await units(page, 2, 3);
    await fillTo(page, cell(page, 2, 5));
    const step = last - before;
    expect(await units(page, 2, 4)).toBe(Math.max(0, last + step));
    expect(await units(page, 2, 5)).toBe(Math.max(0, last + 2 * step));
});

test("a source holding the product fills from its units only", async ({
    page,
}) => {
    await openExample(page, "fill");
    await page.getByRole("button", { name: "continues a series" }).click();
    await cell(page, 1, 0).click();
    await page.keyboard.press("Shift+ArrowRight");
    await page.keyboard.press("Shift+ArrowRight");
    const before = await units(page, 1, 1);
    const last = await units(page, 1, 2);
    await fillTo(page, cell(page, 1, 4));
    await expect(status(page)).toHaveText("Filled 2 cells.");
    // the series of the weeks, the product's name read as no units
    const step = last - before;
    expect(await units(page, 1, 3)).toBe(Math.max(0, last + step));
    expect(await units(page, 1, 4)).toBe(Math.max(0, last + 2 * step));
});
