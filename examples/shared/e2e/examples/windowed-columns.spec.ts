import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, renderedRows, scrollTo } from "./helpers";

test("requests only the tiles in view, on both axes", async ({ page }) => {
    await openExample(page, "windowed-columns");
    await expect(cell(page, 0, 0)).toHaveAttribute("data-tile-loaded", "");
    await scrollTo(page, { top: 1_600_000, left: 104_000 });
    const rows = await renderedRows(page);
    const row = rows[2] ?? 0;
    // 104,000px / 104px = column 1,000
    await expect(cell(page, row, 1_001)).toHaveAttribute(
        "data-tile-loaded",
        "",
    );
    const requests = await page
        .getByTestId("request-log")
        .locator("li")
        .evaluateAll((items) =>
            items.map((item) => ({
                start: Number(item.getAttribute("data-start")),
                text: item.textContent ?? "",
            })),
        );
    // the first view's tiles (rows from 0), then the few around the new view: nothing between
    const moved = requests.filter((request) => request.start > 0);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.length).toBeLessThanOrEqual(6);
    for (const { text } of moved) {
        expect(text).toMatch(/rows (4\d|5\d)\d{3}–/);
        expect(text).toMatch(/columns (9[89]\d|10\d\d)–/);
    }
    expect(requests.length - moved.length).toBeLessThanOrEqual(2);
});
