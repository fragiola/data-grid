import { expect, type Page, test } from "@playwright/test";
import { openExample, THEMES } from "../helpers";
import { cell, scrollTo, settle } from "./helpers";

// Groups over columns, two header rows: a group stays over its columns while they scroll
// sideways (cut by the column window or not), and the arrows climb from a column to its group.

/** Each rendered group's edges against its columns' header cells (when those are rendered). */
function groupEdges(page: Page) {
    return page.evaluate(() => {
        const header = (column: number) =>
            document.querySelector(
                `[data-grid-part="header-cell"][data-row-index="-1"][data-column-index="${column}"]`,
            );
        return [
            ...document.querySelectorAll(
                '[data-grid-part="header-cell"][data-group]',
            ),
        ].map((group) => {
            const start = Number(group.getAttribute("data-column-index"));
            const span = Number(group.getAttribute("aria-colspan"));
            const box = group.getBoundingClientRect();
            const first = header(start)?.getBoundingClientRect();
            const last = header(start + span - 1)?.getBoundingClientRect();
            return {
                name: group.textContent,
                left: first ? first.left - box.left : null,
                right: last ? last.right - box.right : null,
                below: first ? first.top - box.bottom : null,
            };
        });
    });
}

test("a group stays over its columns while they scroll sideways", async ({
    page,
}) => {
    await openExample(page, "grouped-headers");
    let cut = 0;
    for (const left of [0, 400, 1_337, "60%", "100%"] as const) {
        await scrollTo(page, { left });
        const groups = await groupEdges(page);
        expect(groups.length, `at ${left}`).toBeGreaterThan(0);
        for (const group of groups) {
            if (group.left === null || group.right === null) cut++;
            for (const edge of [group.left, group.right, group.below]) {
                if (edge !== null) {
                    expect(
                        Math.abs(edge),
                        `${group.name} at ${left}`,
                    ).toBeLessThan(1);
                }
            }
        }
    }
    // the column window cut a group somewhere on the way
    expect(cut).toBeGreaterThan(0);
});

test("ArrowUp from a column reaches its group, and ArrowDown comes back", async ({
    page,
}) => {
    await openExample(page, "grouped-headers");
    // Name (column 1) is the first column of Person
    await cell(page, 0, 1).click();
    await page.keyboard.press("ArrowUp");
    const name = page.getByRole("columnheader", { name: "Name" });
    await expect(name).toBeFocused();
    await page.keyboard.press("ArrowUp");
    const person = page.getByRole("columnheader", { name: "Person" });
    await expect(person).toBeFocused();
    await expect(person).toHaveAttribute("data-group", "");
    await expect(person).toHaveAttribute("aria-colspan", "2");
    await page.keyboard.press("ArrowRight");
    await expect(
        page.getByRole("columnheader", { name: "Work" }),
    ).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowDown");
    await expect(name).toBeFocused();
    // "#" spans both header rows: Up from its body cell reaches it
    await cell(page, 0, 0).click();
    await page.keyboard.press("ArrowUp");
    const id = page.getByRole("columnheader", { name: "#" });
    await expect(id).toBeFocused();
    await expect(id).toHaveAttribute("aria-rowspan", "2");
});

test("the header is two rows tall, counted in ARIA", async ({ page }) => {
    await openExample(page, "grouped-headers");
    const grid = page.getByRole("grid", { name: "People" });
    await expect(grid).toHaveAttribute("aria-rowcount", "1002");
    await expect(page.locator('[data-grid-part="header-row"]')).toHaveCount(2);
    await settle(page);
    const rows = await page
        .locator('[data-grid-part="header-row"]')
        .evaluateAll((all) =>
            all.map((row) => row.getAttribute("aria-rowindex")),
        );
    expect(rows).toEqual(["1", "2"]);
});

test("renders in every theme", async ({ page }) => {
    for (const theme of THEMES) {
        await openExample(page, "grouped-headers", { theme: theme.name });
        await expect(
            page.getByRole("columnheader", { name: "Person" }),
        ).toBeVisible();
    }
});
