import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell } from "./helpers";

test("shows a hundred people, and the arrows move the active cell", async ({
    page,
}) => {
    await openExample(page, "hello-grid");
    const grid = page.getByRole("grid", { name: "People" });
    await expect(grid).toHaveAttribute("aria-rowcount", "101");
    await expect(grid).toHaveAttribute("aria-colcount", "6");
    await expect(
        page.getByRole("columnheader", { name: "Salary" }),
    ).toBeVisible();
    await cell(page, 0, 1).click();
    await expect(cell(page, 0, 1)).toHaveAttribute("data-active", "");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 1, 2)).toBeFocused();
    await expect(cell(page, 1, 2)).toHaveAttribute("data-active", "");
});

test("takes its shape from the theme", async ({ page }) => {
    await openExample(page, "hello-grid", { theme: "paper" });
    const header = page.getByRole("columnheader", { name: "Name" });
    await expect(header).toHaveCSS("text-transform", "uppercase");
    await openExample(page, "hello-grid", { theme: "terminal" });
    await cell(page, 0, 0).click();
    await expect(cell(page, 0, 0)).toHaveCSS("outline-style", "dashed");
});

test("the active cell's outline goes with focus: a click outside or Escape, back with Tab", async ({
    page,
}) => {
    await openExample(page, "hello-grid");
    const active = cell(page, 1, 1);
    await active.click();
    await expect(active).not.toHaveCSS("outline-style", "none");
    // a click outside the grid: the cell stays active, its outline goes
    await page.mouse.click(2, 2);
    await expect(active).toHaveAttribute("data-active", "");
    await expect(active).toHaveCSS("outline-style", "none");
    // Tab comes back to it
    await page.keyboard.press("Tab");
    await expect(active).toBeFocused();
    await expect(active).not.toHaveCSS("outline-style", "none");
    // Escape gives focus up, the cell still active
    await page.keyboard.press("Escape");
    await expect(active).not.toBeFocused();
    await expect(active).toHaveAttribute("data-active", "");
    await expect(active).toHaveCSS("outline-style", "none");
});
