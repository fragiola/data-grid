import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { header, settle, values } from "./helpers";

// React Data Grid's HeaderFilters example: a filter in each header cell, the rows filtered in
// memory; the filters are the header cells' controls.

const count = (page: Page) => page.getByTestId("count");

test("a text filter in a header cell filters the rows, and never sorts", async ({
    page,
}) => {
    await openExample(page, "header-filters");
    await expect(count(page)).toHaveText("1000 of 1000 tasks");
    const field = page.getByRole("textbox", { name: "Filter Task" });
    await field.click();
    await field.fill("Budgeting");
    await settle(page);
    await expect(count(page)).not.toHaveText("1000 of 1000 tasks");
    for (const name of await values(page, 1)) {
        expect(name).toContain("Budgeting");
    }
    // a click on the filter is the field's: no sort
    await expect(header(page, "Task")).not.toHaveAttribute("aria-sort");
    // the arrows are the field's too; Escape gives the keys back to the header cell
    await page.keyboard.press("ArrowLeft");
    await expect(field).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(header(page, "Task")).toBeFocused();
});

test("select filters combine, and Clear filters brings every row back", async ({
    page,
}) => {
    await openExample(page, "header-filters");
    await page.getByRole("combobox", { name: "Filter Priority" }).click();
    await page.getByRole("option", { name: "High" }).click();
    await page.getByRole("combobox", { name: "Filter Status" }).click();
    await page.getByRole("option", { name: "Completed" }).click();
    await settle(page);
    expect(new Set(await values(page, 3))).toEqual(new Set(["High"]));
    expect(new Set(await values(page, 4))).toEqual(new Set(["Completed"]));
    // the rating's choices in their order, "Any" first
    await page.getByRole("combobox", { name: "Filter Rating" }).click();
    await expect(page.getByRole("option")).toHaveText([
        "Any",
        "3 and up",
        "4 and up",
        "5",
    ]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(count(page)).toHaveText("1000 of 1000 tasks");
});

test("the filters hide, and the header is one line again", async ({ page }) => {
    await openExample(page, "header-filters");
    const task = header(page, "Task");
    expect((await task.boundingBox())?.height).toBeCloseTo(72, 0);
    await page.getByRole("switch", { name: "Filters" }).click();
    await expect(
        page.getByRole("textbox", { name: "Filter Task" }),
    ).toHaveCount(0);
    await expect
        .poll(async () => (await task.boundingBox())?.height)
        .toBeCloseTo(36, 0);
    // the name still sorts
    await task.click();
    await expect(task).toHaveAttribute("aria-sort", "ascending");
});
