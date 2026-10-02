import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, scrollTo } from "./helpers";

test("renders real table elements, virtualized, with the grid's keyboard", async ({
    page,
}) => {
    await openExample(page, "table-elements");
    const table = page.locator("table");
    await expect(table).toHaveAttribute("role", "grid");
    await expect(page.locator("thead > tr > th")).toHaveCount(6);
    const rows = await page.locator("tbody > tr").count();
    expect(rows).toBeGreaterThan(5);
    expect(rows).toBeLessThan(40);
    await scrollTo(page, { top: "50%" });
    await expect(page.locator("tbody > tr").first()).not.toHaveAttribute(
        "data-row-index",
        "0",
    );
    await scrollTo(page, { top: 0 });
    await cell(page, 0, 0).click();
    await page.keyboard.press("End");
    await expect(page.locator("td[data-active]")).toHaveAttribute(
        "data-column-index",
        "5",
    );
});
