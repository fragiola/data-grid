import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, header, settle } from "./helpers";

// React Data Grid's CustomizableRenderers example: the checkbox, the sort status, the cells' and
// rows' looks are the app's own markup; a title edited in place.

const row = (page: Page, rowIndex: number) =>
    page.locator(`[data-grid-part="row"][data-row-index="${rowIndex}"]`);

test("the app's sort status: a triangle, and priorities on several columns", async ({
    page,
}) => {
    await openExample(page, "custom-renderers");
    await header(page, "Priority").click();
    await expect(header(page, "Priority")).toContainText("▲");
    await header(page, "Priority").click();
    await expect(header(page, "Priority")).toContainText("▼");
    await header(page, "Status").click({ modifiers: ["ControlOrMeta"] });
    await expect(header(page, "Priority")).toContainText("▼1");
    await expect(header(page, "Status")).toContainText("▲2");
});

test("native checkboxes select rows, the header's one every row", async ({
    page,
}) => {
    await openExample(page, "custom-renderers");
    await row(page, 1).getByRole("checkbox").check();
    await expect(row(page, 1)).toHaveAttribute("aria-selected", "true");
    const all = page.getByRole("checkbox", { name: "Select all" });
    await expect
        .poll(() =>
            all.evaluate(
                (box) => box instanceof HTMLInputElement && box.indeterminate,
            ),
        )
        .toBe(true);
    await all.click();
    await expect(all).toBeChecked();
    await expect(row(page, 4)).toHaveAttribute("aria-selected", "true");
});

test("a title edited in place is written by the app", async ({ page }) => {
    await openExample(page, "custom-renderers");
    await cell(page, 0, 2).click();
    await page.keyboard.press("Enter");
    await cell(page, 0, 2).locator("input").fill("Renamed task");
    await page.keyboard.press("Enter");
    await settle(page);
    await expect(cell(page, 0, 2)).toHaveText("Renamed task");
});
