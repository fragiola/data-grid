import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";
import { scrollTo } from "./helpers";

test("reports the column window as it scrolls sideways", async ({ page }) => {
    await openExample(page, "many-columns");
    await expect(page.getByTestId("visible-columns")).toHaveText(/^1–\d+$/);
    await scrollTo(page, { left: 300_000 });
    // 300,000px / 120px = column 2,500
    await expect(page.getByTestId("visible-columns")).toHaveText(
        /^2,501–2,5\d\d$/,
    );
    await expect(
        page.getByRole("columnheader", { name: "Column 2,501", exact: true }),
    ).toBeVisible();
    const headers = await page
        .locator('[data-grid-part="header-cell"]')
        .count();
    expect(headers).toBeLessThan(20);
});
