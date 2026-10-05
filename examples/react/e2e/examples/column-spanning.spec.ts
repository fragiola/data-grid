import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { boxOf, cell, scrollTo } from "./helpers";

// Column spanning (Epic #85, E1.2): a booking spans the hours it takes, the hours it covers
// render no cell, the header groups the hours two by two, and the arrows step over a booking.
// Room 1.01 (row 0) is free at 08:00 (column 1), then booked 09:00–13:00 (columns 2–5) and
// 13:00–16:00 (columns 6–8).

const headerCell = (page: Page, columnIndex: number) =>
    page.locator(
        `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]`,
    );

test("spans a booking over its hours, the hours it covers left out", async ({
    page,
}) => {
    await openExample(page, "column-spanning");
    const booking = cell(page, 0, 2);
    await expect(booking).toHaveAttribute("aria-colspan", "4");
    await expect(booking).toContainText("09:00–13:00");
    expect((await boxOf(booking)).width).toBeCloseTo(4 * 96, 0);
    for (const columnIndex of [3, 4, 5]) {
        await expect(cell(page, 0, columnIndex)).toHaveCount(0);
    }
    await expect(cell(page, 0, 6)).toHaveAttribute("aria-colspan", "3");
    await expect(cell(page, 0, 1)).not.toHaveAttribute("aria-colspan");
    // the header: a cell per two hours
    await expect(headerCell(page, 1)).toHaveAttribute("aria-colspan", "2");
    await expect(headerCell(page, 1)).toHaveText("08:00–10:00");
    await expect(headerCell(page, 2)).toHaveCount(0);
});

test("steps over a booking with the arrows", async ({ page }) => {
    await openExample(page, "column-spanning");
    await cell(page, 0, 1).click();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 0, 2)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 0, 6)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(cell(page, 0, 2)).toBeFocused();
    // Room 1.02 is booked 09:00–13:00 too
    await page.keyboard.press("ArrowDown");
    await expect(cell(page, 1, 2)).toBeFocused();
    await expect(cell(page, 1, 2)).toHaveAttribute("data-active", "");
});

test("keeps a booking that starts left of the rendered hours", async ({
    page,
}) => {
    await page.setViewportSize({ width: 700, height: 600 });
    await openExample(page, "column-spanning");
    await scrollTo(page, { left: 500 });
    // 09:00 is scrolled out, its booking reaches the hours in view
    await expect(cell(page, 1, 1)).toHaveCount(0);
    await expect(cell(page, 0, 2)).toHaveCount(1);
    const booking = await boxOf(cell(page, 0, 2));
    const after = await boxOf(cell(page, 0, 6));
    expect(booking.x + booking.width).toBeCloseTo(after.x, 0);
});
