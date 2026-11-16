import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, scrollTo } from "./helpers";

const OVERSCAN = { rows: 4, columns: 2 };

test("keeps the cells in the page bounded at the top, the middle and the end", async ({
    page,
}) => {
    await openExample(page, "large-dataset");
    await expect(page.getByTestId("readout")).toContainText("1,000,000,000");
    for (const at of [0, "50%", "100%"] as const) {
        await scrollTo(page, { top: at, left: at });
        const size = await page
            .locator('[data-grid-part="root"]')
            .evaluate((element) => ({
                rows: Math.ceil(element.clientHeight / 32) + 1,
                columns: Math.ceil(element.clientWidth / 96) + 1,
            }));
        const cells = await page.locator('[data-grid-part="cell"]').count();
        expect(cells, `at ${at}`).toBeGreaterThan(0);
        expect(cells, `at ${at}`).toBeLessThanOrEqual(
            (size.rows + 2 * OVERSCAN.rows) *
                (size.columns + 2 * OVERSCAN.columns),
        );
    }
    // the end is the last row and the last column
    await expect(cell(page, 999_999, 999)).toBeVisible();
    await expect(page.getByTestId("rendered-cells")).not.toHaveText("0");
});

test("keeps the pinned row column in view, far to the right", async ({
    page,
}) => {
    await openExample(page, "large-dataset");
    await scrollTo(page, { top: "50%", left: "75%" });
    const view = await page
        .locator('[data-grid-part="root"]')
        .first()
        .boundingBox();
    const first = page
        .locator('[data-grid-part="cell"][data-column-index="0"]')
        .nth(3);
    await expect(first).toHaveAttribute("data-pinned", "start");
    const box = await first.boundingBox();
    if (!view || !box) throw new Error("no box");
    expect(box.x - view.x).toBeLessThan(4);
    await expect(first).toHaveText(/^\d[\d,]*$/);
});
