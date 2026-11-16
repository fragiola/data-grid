import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { boxOf, cell, scrollTo, viewport } from "./helpers";

// Summary rows (Epic #86, E2.1): an average row under the header and a total row at the bottom
// edge, the app's own figures over the rows a search leaves.

const summaryCell = (
    page: Page,
    position: "top" | "bottom",
    columnIndex: number,
) =>
    page.locator(
        `[data-grid-part="summary-cell"][data-summary="${position}"][data-column-index="${columnIndex}"]`,
    );

test("totals the rows a search leaves", async ({ page }) => {
    await openExample(page, "summary-rows");
    const grid = page.getByRole("grid", { name: "People" });
    // the header row, the average row, 500 people and the total row
    await expect(grid).toHaveAttribute("aria-rowcount", "503");
    await expect(summaryCell(page, "top", 0)).toHaveText("Average");
    await expect(summaryCell(page, "bottom", 0)).toHaveText(
        "Total · 500 people",
    );
    // the teams and cities span two columns
    await expect(summaryCell(page, "bottom", 1)).toHaveAttribute(
        "aria-colspan",
        "2",
    );
    await expect(summaryCell(page, "bottom", 1)).toContainText("teams in");
    const total = await summaryCell(page, "bottom", 4).textContent();
    await page
        .getByRole("textbox", { name: "Search every column" })
        .fill("design");
    await expect(summaryCell(page, "bottom", 0)).not.toHaveText(
        "Total · 500 people",
    );
    const count = Number(
        (await summaryCell(page, "bottom", 0).textContent())?.replace(
            /[^\d]/g,
            "",
        ),
    );
    expect(count).toBeGreaterThan(0);
    await expect(grid).toHaveAttribute("aria-rowcount", String(count + 3));
    await expect(summaryCell(page, "bottom", 4)).not.toHaveText(total ?? "");
});

test("keeps the average under the header and the total at the bottom edge", async ({
    page,
}) => {
    await openExample(page, "summary-rows");
    const edges = () =>
        viewport(page).evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const top = rect.top + element.clientTop;
            const header = element.querySelector('[data-grid-part="header"]');
            return {
                headerBottom: header?.getBoundingClientRect().bottom ?? top,
                bottom: top + element.clientHeight,
            };
        });
    for (const top of [0, "50%", "100%"] as const) {
        await scrollTo(page, { top });
        const { headerBottom, bottom } = await edges();
        expect((await boxOf(summaryCell(page, "top", 0))).y).toBeCloseTo(
            headerBottom,
            0,
        );
        const total = await boxOf(summaryCell(page, "bottom", 0));
        expect(total.y + total.height).toBeCloseTo(bottom, 0);
    }
});

test("reaches the total row with Ctrl+End, and leaves it with the arrows", async ({
    page,
}) => {
    await openExample(page, "summary-rows");
    await cell(page, 0, 1).click();
    await page.keyboard.press("ArrowUp");
    await expect(summaryCell(page, "top", 1)).toBeFocused();
    await page.keyboard.press("Control+End");
    await expect(summaryCell(page, "bottom", 5)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(cell(page, 499, 5)).toBeFocused();
});
