import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, header, settle } from "./helpers";

// React Data Grid's ContextMenu example: the app's menu on a row (a right click), inserting a row
// above or below it or deleting it; focus comes back to the grid's active cell.

const menu = (page: Page) => page.getByRole("menu");
const item = (page: Page, name: string) => page.getByRole("menuitem", { name });

test("inserts a row above the one right-clicked, and focus comes back to it", async ({
    page,
}) => {
    await openExample(page, "context-menu");
    await cell(page, 2, 1).click({ button: "right" });
    await expect(menu(page)).toBeVisible();
    await item(page, "Insert row above").click();
    await expect(menu(page)).toBeHidden();
    await settle(page);
    // the new task (id 201) is row 2; the one clicked moved down
    await expect(cell(page, 2, 0)).toHaveText("201");
    await expect(cell(page, 3, 0)).toHaveText("3");
    await expect(cell(page, 2, 1)).toBeFocused();
    await expect(page.getByRole("status")).toHaveText(
        "Inserted task 201 at row 3.",
    );
});

test("inserts below and deletes, from the keys inside the menu", async ({
    page,
}) => {
    await openExample(page, "context-menu");
    await cell(page, 4, 2).click({ button: "right" });
    await expect(menu(page)).toBeVisible();
    await item(page, "Insert row below").focus();
    await page.keyboard.press("Enter");
    await settle(page);
    await expect(cell(page, 5, 0)).toHaveText("201");
    await expect(cell(page, 5, 2)).toBeFocused();

    await cell(page, 5, 2).click({ button: "right" });
    await item(page, "Delete row").click();
    await settle(page);
    await expect(cell(page, 5, 0)).toHaveText("6");
    await expect(cell(page, 5, 2)).toBeFocused();
});

test("Escape closes the menu, focus back on the cell; the header opens none", async ({
    page,
}) => {
    await openExample(page, "context-menu");
    await cell(page, 1, 3).click({ button: "right" });
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu(page)).toBeHidden();
    await expect(cell(page, 1, 3)).toBeFocused();

    await header(page, "Status").click({ button: "right" });
    await settle(page);
    await expect(menu(page)).toHaveCount(0);
});

/** A touch held on an element, as a finger's first touch: Base UI times a long press from it. */
async function holdTouch(target: ReturnType<typeof cell>) {
    const box = await target.boundingBox();
    if (!box) throw new Error("no box: the element is not rendered");
    const touch = {
        identifier: 1,
        clientX: box.x + 10,
        clientY: box.y + 10,
    };
    await target.dispatchEvent("touchstart", {
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
    });
}

test.describe("on a touch screen", () => {
    test.use({ hasTouch: true });

    test("a long press opens the menu for its row, without a context menu event", async ({
        page,
    }) => {
        await openExample(page, "context-menu");
        await holdTouch(cell(page, 3, 1));
        await expect(menu(page)).toBeVisible();
        await expect(cell(page, 3, 1)).toHaveAttribute("data-active", "");
        await item(page, "Delete row").click();
        await settle(page);
        await expect(cell(page, 3, 0)).toHaveText("5");

        // on the header: no row, no menu
        await holdTouch(header(page, "Status"));
        await page.waitForTimeout(700);
        await expect(menu(page)).toHaveCount(0);
    });
});
