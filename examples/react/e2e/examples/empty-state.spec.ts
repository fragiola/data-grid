import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell } from "./helpers";

// The app clears and refills its rows; the grid shows the app's empty content while it has none.

const empty = (page: Page) => page.locator('[data-grid-part="empty"]');
const grid = (page: Page) => page.getByRole("grid", { name: "People" });
const addRows = (page: Page) =>
    page.getByRole("button", { name: "Add sample rows" });

test("starts empty: the content shows in the body, and the grid is marked", async ({
    page,
}) => {
    await openExample(page, "empty-state");
    await expect(empty(page)).toBeVisible();
    await expect(empty(page)).toContainText("No people yet");
    await expect(grid(page)).toHaveAttribute("data-empty", "");
    await expect(page.locator('[data-grid-part="root"]')).toHaveAttribute(
        "data-empty",
        "",
    );
    await expect(page.locator('[data-grid-part="row"]')).toHaveCount(0);
    await expect(
        page.getByRole("columnheader", { name: "Email" }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Clear all" }),
    ).toBeDisabled();
    // the content fills the empty area and is centred in it
    const area = await empty(page).boundingBox();
    const content = await page.getByTestId("empty").boundingBox();
    const action = await addRows(page).boundingBox();
    expect(content?.height).toBeCloseTo(area?.height ?? 0, 0);
    expect(
        (action?.x ?? 0) +
            (action?.width ?? 0) / 2 -
            ((area?.x ?? 0) + (area?.width ?? 0) / 2),
    ).toBeCloseTo(0, 0);
});

test("the action brings the rows back, and clearing empties the grid again", async ({
    page,
}) => {
    await openExample(page, "empty-state");
    await addRows(page).click();
    await expect(page.getByTestId("row-count")).toHaveText("50 people");
    await expect(empty(page)).toHaveCount(0);
    // the action went away with the empty state: focus stayed in the grid
    expect(
        await page
            .locator('[data-grid-part="root"]')
            .evaluate((root) => root.contains(document.activeElement)),
    ).toBe(true);
    await expect(grid(page)).not.toHaveAttribute("data-empty");
    await expect(cell(page, 0, 1)).toBeVisible();

    await cell(page, 0, 1).click();
    await expect(cell(page, 0, 1)).toHaveAttribute("data-active", "");
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(empty(page)).toBeVisible();
    await expect(grid(page)).toHaveAttribute("data-empty", "");
    await expect(page.locator('[data-grid-part="row"]')).toHaveCount(0);
});

test("the keyboard: the grid is a tab stop, and the action is reachable", async ({
    page,
}) => {
    await openExample(page, "empty-state");
    // nothing active: the grid itself is the tab stop ("Clear all", before it, is disabled)
    await expect(grid(page)).toHaveAttribute("tabindex", "0");
    // tabbing in hands focus to the first cell in view: with no rows, the first header cell
    await page.keyboard.press("Tab");
    await expect(page.getByRole("columnheader", { name: "#" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(addRows(page)).toBeFocused();
    // the action's keys are its own: the grid does not take them
    for (const key of ["ArrowRight", "ArrowDown", "End", "PageDown"]) {
        await page.keyboard.press(key);
        await expect(addRows(page), key).toBeFocused();
    }
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("row-count")).toHaveText("50 people");
    await expect(empty(page)).toHaveCount(0);
});

test("emptied with a cell active, the active cell moves to its header: still a tab stop", async ({
    page,
}) => {
    await openExample(page, "empty-state");
    await addRows(page).click();
    await cell(page, 3, 1).click();
    await page.getByRole("button", { name: "Clear all" }).click();
    const name = page.getByRole("columnheader", { name: "Name" });
    await expect(name).toHaveAttribute("data-active", "");
    await expect(name).toHaveAttribute("tabindex", "0");
    await name.focus();
    await page.keyboard.press("Tab");
    await expect(addRows(page)).toBeFocused();
});
