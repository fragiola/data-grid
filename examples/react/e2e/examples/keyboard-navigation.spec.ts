import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, expectInView } from "./helpers";

test("mirrors the controlled active cell, and the app moves it too", async ({
    page,
}) => {
    await openExample(page, "keyboard-navigation");
    const active = page.getByTestId("active");
    await expect(active).toHaveText("Active: row 1, Name");
    await cell(page, 0, 1).click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("End");
    await expect(active).toHaveText("Active: row 3, Salary");
    await expect(cell(page, 2, 5)).toBeFocused();
    await page.keyboard.press("PageDown");
    await expect(active).toContainText("Salary");
    await page.keyboard.press("ControlOrMeta+Home");
    await expect(active).toHaveText("Active: header, #");

    await page.getByRole("button", { name: "Last row" }).click();
    await expect(active).toHaveText("Active: row 5,000, Salary");
    await expect(cell(page, 4_999, 5)).toHaveAttribute("data-active", "");
    await expectInView(page, cell(page, 4_999, 5));
});
