import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { boxOf, cell, header, settle } from "./helpers";

// A task sheet with every cell feature (Epic #88): edits, ranges, the clipboard and the fill,
// over sorted rows, a pinned column and resizable ones; every value written by the app.

const status = (page: Page) => page.getByRole("status");

test("an edit on sorted rows writes the row shown", async ({ page }) => {
    await openExample(page, "all-features");
    await header(page, "Task").click();
    await settle(page);
    const first = await cell(page, 0, 0).textContent();
    await cell(page, 0, 0).click();
    await page.keyboard.press("Enter");
    await cell(page, 0, 0).locator("input").fill(`${first} (renamed)`);
    await page.keyboard.press("Enter");
    await settle(page);
    await expect(status(page)).toHaveText("Saved Task: 1 cell written.");
    await expect(page.getByText(`${first} (renamed)`)).toBeVisible();
});

test("a copied due date pastes into other rows, and the fill repeats it further", async ({
    page,
}) => {
    await openExample(page, "all-features");
    const due = await cell(page, 0, 4).textContent();
    await cell(page, 0, 4).click();
    await page.keyboard.press("ControlOrMeta+c");
    await cell(page, 2, 4).click();
    await page.keyboard.press("ControlOrMeta+v");
    await settle(page);
    await expect(cell(page, 2, 4)).toHaveText(due ?? "");
    await expect(status(page)).toHaveText("Pasted: 1 cell written.");
    // the handle at the active cell's corner, dragged down two rows
    const from = await boxOf(
        cell(page, 2, 4).locator('[data-grid-part="fill-handle"]'),
    );
    const to = await boxOf(cell(page, 4, 4));
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
        steps: 6,
    });
    await page.mouse.up();
    await settle(page);
    await expect(status(page)).toHaveText("Filled: 2 cells written.");
    await expect(cell(page, 4, 4)).toHaveText(due ?? "");
});
