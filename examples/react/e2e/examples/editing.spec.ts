import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, settle } from "./helpers";

// Tasks edited in place (Epic #88, E4.3): a text field, a number, a select and a date, each the
// app's editor; Enter, F2 or typing start an edit, Enter or Tab commit, Escape cancels, a click
// outside commits, and the app writes each value.

const status = (page: Page) => page.getByRole("status");

/** The edited cell's editor: the field or the select's trigger inside it. */
const editorIn = (page: Page, rowIndex: number, columnIndex: number) =>
    cell(page, rowIndex, columnIndex).locator("input, button").first();

test("a name typed over commits with Enter, the active cell moving down", async ({
    page,
}) => {
    await openExample(page, "editing");
    await cell(page, 0, 0).click();
    await page.keyboard.type("Kickoff");
    await expect(cell(page, 0, 0)).toHaveAttribute("data-editing", "");
    await expect(editorIn(page, 0, 0)).toHaveValue("Kickoff");
    await page.keyboard.press("Enter");
    await settle(page);
    await expect(cell(page, 0, 0)).toHaveText("Kickoff");
    await expect(cell(page, 1, 0)).toBeFocused();
    await expect(status(page)).toHaveText("Saved Task of Kickoff.");
    // Escape cancels: nothing saved
    await page.keyboard.press("F2");
    await editorIn(page, 1, 0).fill("dropped");
    await page.keyboard.press("Escape");
    await expect(cell(page, 1, 0)).not.toHaveText("dropped");
    await expect(cell(page, 1, 0)).toBeFocused();
});

test("a budget that is no amount keeps the edit open; a valid one saves with Tab", async ({
    page,
}) => {
    await openExample(page, "editing");
    // the first task that is not completed
    const statuses = await page
        .locator('[data-grid-part="cell"][data-column-index="3"]')
        .allTextContents();
    const rowIndex = statuses.findIndex((text) => text !== "Completed");
    await cell(page, rowIndex, 2).click();
    await page.keyboard.press("Enter");
    const field = editorIn(page, rowIndex, 2);
    await field.fill("");
    await page.keyboard.press("Enter");
    await expect(cell(page, rowIndex, 2)).toHaveAttribute("data-editing", "");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await field.fill("4200");
    await page.keyboard.press("Tab");
    await settle(page);
    await expect(cell(page, rowIndex, 2)).toHaveText("$4,200");
    await expect(cell(page, rowIndex, 3)).toBeFocused();
    // a completed task's budget is not editable
    const done = statuses.indexOf("Completed");
    await cell(page, done, 2).click();
    await page.keyboard.press("Enter");
    await expect(cell(page, done, 2)).not.toHaveAttribute("data-editing");
});

test("a status is chosen from its list, portalled out of the grid, and saved", async ({
    page,
}) => {
    await openExample(page, "editing");
    await cell(page, 2, 3).click();
    await page.keyboard.press("Enter");
    const option = page.getByRole("option", { name: "Not Started" });
    await expect(option).toBeVisible();
    await option.click();
    await settle(page);
    await expect(cell(page, 2, 3)).toHaveText("Not Started");
    await expect(cell(page, 2, 3)).not.toHaveAttribute("data-editing");
    await expect(status(page)).toHaveText(/^Saved Status of /);
});

test("a due date edited saves on a click outside", async ({ page }) => {
    await openExample(page, "editing");
    await cell(page, 3, 4).dblclick();
    await editorIn(page, 3, 4).fill("2026-12-24");
    await page.locator("kbd").first().click();
    await settle(page);
    await expect(cell(page, 3, 4)).toHaveText("2026-12-24");
    await expect(cell(page, 3, 4)).not.toHaveAttribute("data-editing");
});
