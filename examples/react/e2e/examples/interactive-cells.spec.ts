import { expect, test } from "@playwright/test";
import { openExample, part } from "../helpers";
import { cell, pressTabOut } from "./helpers";

// Interactive cells (Epic #52): controls in every cell, and the grid still one tab stop.

test("Enter reaches a cell's field, Escape comes back, Tab leaves the grid", async ({
    page,
}) => {
    await openExample(page, "interactive-cells");
    const root = part(page, "root");
    const focusInGrid = () =>
        root.evaluate((element) => element.contains(document.activeElement));
    // the grid takes focus on its first cell in view, never on a control inside one
    await part(page, "grid").focus();
    await expect(cell(page, 0, 0)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 0, 1)).toBeFocused();
    await page.keyboard.press("Enter");
    const field = cell(page, 0, 1).getByRole("textbox");
    await expect(field).toBeFocused();
    await expect(cell(page, 0, 1)).toHaveAttribute("data-interacting", "");
    await page.keyboard.press("End");
    await page.keyboard.type(" (soon)");
    await expect(field).toHaveValue(/\(soon\)$/);
    // Tab stays in the cell: its only control
    await page.keyboard.press("Tab");
    await expect(field).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(cell(page, 0, 1)).toBeFocused();
    await pressTabOut(page);
    expect(await focusInGrid()).toBe(false);
});

test("a box to check and the actions work from the keyboard and the mouse", async ({
    page,
}) => {
    await openExample(page, "interactive-cells");
    await part(page, "grid").focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("F2");
    const done = cell(page, 1, 0).getByRole("checkbox");
    await expect(done).toBeFocused();
    const before = await done.getAttribute("aria-checked");
    await page.keyboard.press("Space");
    await expect(done).not.toHaveAttribute("aria-checked", before ?? "");
    await page.keyboard.press("Escape");
    // a click on a button activates its cell and gives it the keys
    await cell(page, 2, 4).getByRole("button").first().click();
    await expect(page.getByTestId("count")).toHaveText("61 tasks");
    await expect(cell(page, 2, 4)).toHaveAttribute("data-interacting", "");
    await page.keyboard.press("Tab");
    await expect(cell(page, 2, 4).getByRole("button").nth(1)).toBeFocused();
});
