import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";

// Each grid keeps its own active cell, keys and focus (#17).

const order = (page: Page, id: number) =>
    page.getByRole("grid", { name: `Items of order ${id}` });

test("keys inside an order's items move only that grid", async ({ page }) => {
    await openExample(page, "nested-grid");
    const items = order(page, 1001);
    await items.getByRole("gridcell").first().click();
    await page.keyboard.press("ArrowDown");
    await expect(
        items.locator('[data-row-index="1"][data-column-index="0"]'),
    ).toBeFocused();
    // the orders grid stays on the cell that holds the items
    const orders = page.getByRole("grid", { name: "Orders" });
    const active = await orders
        .locator('[data-grid-part="cell"][data-active]')
        .evaluateAll((cells) =>
            cells
                .filter(
                    (cell) =>
                        cell
                            .closest('[role="grid"]')
                            ?.getAttribute("aria-label") === "Orders",
                )
                .map((cell) => [
                    cell.getAttribute("data-row-index"),
                    cell.getAttribute("data-column-index"),
                ]),
        );
    expect(active).toEqual([["0", "2"]]);
});

test("Tab enters the items from their order's cell, and Shift+Tab returns", async ({
    page,
}) => {
    await openExample(page, "nested-grid");
    const orders = page.getByRole("grid", { name: "Orders" });
    await orders.getByRole("gridcell", { name: "Guido Dijkstra" }).click();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Tab");
    await expect(
        order(page, 1001).locator(
            '[data-row-index="0"][data-column-index="0"]',
        ),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    // back on the orders grid's own Items cell (an inner Price cell is column 2 too)
    const focused = await page.evaluate(() => {
        const element = document.activeElement;
        return {
            grid: element?.closest('[role="grid"]')?.getAttribute("aria-label"),
            row: element?.getAttribute("data-row-index"),
            column: element?.getAttribute("data-column-index"),
        };
    });
    expect(focused).toEqual({ grid: "Orders", row: "0", column: "2" });
});

test("Tab from the orders grid skips the items of the other orders", async ({
    page,
}) => {
    await openExample(page, "nested-grid");
    const orders = page.getByRole("grid", { name: "Orders" });
    await orders.getByRole("gridcell", { name: "Guido Dijkstra" }).click();
    await page.keyboard.press("Tab");
    // the active cell (row 0, Customer) holds no grid: Tab leaves the grids altogether
    const label = await page.evaluate(
        () =>
            document.activeElement
                ?.closest('[role="grid"]')
                ?.getAttribute("aria-label") ?? null,
    );
    expect(label).toBeNull();
});
