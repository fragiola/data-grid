import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, renderedRows, scrollTo } from "./helpers";

test("loads only the window the scrollbar lands on, never the rows in between", async ({
    page,
}) => {
    await openExample(page, "windowed-loading");
    await expect(cell(page, 0, 1)).toHaveText("Guido Dijkstra");
    await expect(page.getByTestId("request-count")).toContainText("1 request,");

    // the thumb dragged to about 90%: a native jump of 900,000 rows
    await scrollTo(page, { top: "90%" });
    const rows = await renderedRows(page);
    const first = rows[0] ?? 0;
    expect(first).toBeGreaterThan(850_000);
    // placeholders first, in their place
    await expect(
        page.locator('[data-grid-part="row"]').first(),
    ).toHaveAttribute("data-loading", "");
    // then the rows themselves
    await expect(
        page.locator('[data-grid-part="row"][data-loading]'),
    ).toHaveCount(0);
    await expect(cell(page, first, 0)).toHaveText(String(first + 1));

    const requests = await page
        .getByTestId("request-log")
        .locator("li")
        .evaluateAll((items) =>
            items.map((item) => ({
                start: Number(item.getAttribute("data-start")),
                end: Number(item.getAttribute("data-end")),
            })),
        );
    expect(requests.length).toBeLessThanOrEqual(4);
    for (const { start } of requests) {
        expect(start < 1_000 || start > 850_000, `rows from ${start}`).toBe(
            true,
        );
    }
});
