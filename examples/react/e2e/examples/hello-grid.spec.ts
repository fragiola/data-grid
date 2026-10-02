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
