import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, scrollTo, viewport } from "./helpers";

// Collapsible groups (Epic #85, E1.3): a year opens into its quarters, a quarter into its months,
// each from the toggle in its header (the app's button, the grid's command); closed, a group
// shows its total. A group's label stays in view while its columns scroll. 2025 starts closed,
// 2026 open with its first quarter closed; the rep is pinned at the start (180px).

/** The header cell of a column (not a group's), by its index. */
const columnHeader = (page: Page, columnIndex: number) =>
    page.locator(
        `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]:not([data-group])`,
    );

/** A group's header cell, by its first column and its row. */
const groupHeader = (page: Page, rowIndex: number, columnIndex: number) =>
    page.locator(
        `[data-grid-part="header-cell"][data-group][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
    );

test("opens and closes a year and a quarter from the toggles in their headers", async ({
    page,
}) => {
    await openExample(page, "collapsible-groups");
    const year = groupHeader(page, -3, 1);
    await expect(year).toHaveAttribute("data-collapsible", "");
    await expect(year).toHaveAttribute("data-collapsed", "");
    // closed: its total alone, spanning the rows below the year
    await expect(columnHeader(page, 1)).toHaveText("Total");
    await expect(columnHeader(page, 1)).toHaveAttribute("aria-rowspan", "2");
    await expect(cell(page, 0, 1)).toHaveText(/^[\d,]+$/);
    const toggle = page.getByRole("button", { name: "2025" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(year).not.toHaveAttribute("data-collapsed");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    // open: its quarters, the first one's months
    await expect(groupHeader(page, -2, 1)).toContainText("Q1");
    await expect(columnHeader(page, 1)).toHaveText("Jan");
    await expect(columnHeader(page, 4)).toHaveText("Total");
    // its first quarter closed: the quarter's total alone
    await groupHeader(page, -2, 1).getByRole("button").click();
    await expect(groupHeader(page, -2, 1)).toHaveAttribute("data-collapsed");
    await expect(columnHeader(page, 1)).toHaveText("Total");
    await expect(columnHeader(page, 2)).toHaveText("Apr");
});

test("opens and closes every group from the toolbar", async ({ page }) => {
    await openExample(page, "collapsible-groups");
    const grid = page.getByRole("grid", { name: "Sales" });
    await page.getByRole("button", { name: "Collapse all" }).click();
    // the rep and each year's total
    await expect(grid).toHaveAttribute("aria-colcount", "3");
    await page.getByRole("button", { name: "Expand all" }).click();
    // the rep, then each year's 4 quarters of 3 months and a total
    await expect(grid).toHaveAttribute("aria-colcount", "33");
});

test("keeps a year's label in view while its columns scroll, right of the rep", async ({
    page,
}) => {
    await openExample(page, "collapsible-groups");
    await page.getByRole("button", { name: "Expand all" }).click();
    await scrollTo(page, { left: 600 });
    const label = page.locator(
        '[data-grid-part="group-label"][data-grid-group-label="2025"]',
    );
    const start = await viewport(page).evaluate(
        (element) => element.getBoundingClientRect().left + element.clientLeft,
    );
    const box = await label.boundingBox();
    expect((box?.x ?? 0) - start).toBeCloseTo(180, 0);
    // its toggle still closes it
    await label.getByRole("button", { name: "2025" }).click();
    await expect(groupHeader(page, -3, 1)).toHaveAttribute("data-collapsed");
});
