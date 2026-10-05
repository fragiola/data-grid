import { expect, type Locator, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { boxOf, cell, dragBy, header, settle, viewport } from "./helpers";

// Right to left (Epic #85, E1.1): the grid reads from the right edge, the name pinned there and
// the salary at the left edge, the arrows mirrored; the switch turns it left to right.

/** An element's start from the view's start: its right edge, or left to right its left edge. */
async function startInView(page: Page, target: Locator, rtl = true) {
    const view = await viewport(page).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const left = rect.left + element.clientLeft;
        return { left, right: left + element.clientWidth };
    });
    const box = await boxOf(target);
    return rtl ? view.right - (box.x + box.width) : box.x - view.left;
}

/** A native scroll from the start: a negative `scrollLeft` right to left. */
async function scrollFromStart(page: Page, inline: number | "end") {
    await viewport(page).evaluate((element, x) => {
        element.scrollLeft = -(x === "end" ? element.scrollWidth : x);
    }, inline);
    await settle(page);
}

test("reads from the right, both pinned parts in place while it scrolls", async ({
    page,
}) => {
    // narrower than its columns: it scrolls
    await page.setViewportSize({ width: 800, height: 700 });
    await openExample(page, "rtl");
    await expect(viewport(page)).toHaveAttribute("dir", "rtl");
    const width = await viewport(page).evaluate(
        (element) => element.clientWidth,
    );
    for (const inline of [0, 200, "end"] as const) {
        await scrollFromStart(page, inline);
        // the name at the right edge, the salary at the left
        expect(await startInView(page, cell(page, 0, 0))).toBeCloseTo(0, 0);
        expect(
            await startInView(page, header(page, "الاسم").first()),
        ).toBeCloseTo(0, 0);
        const salary = await boxOf(cell(page, 0, 5));
        // the salary at the left edge
        expect(
            (await startInView(page, cell(page, 0, 5))) + salary.width,
        ).toBeCloseTo(width, 0);
    }
    expect(
        await viewport(page).evaluate((element) => element.scrollLeft),
    ).toBeLessThan(0);
    await expect(cell(page, 0, 5)).toHaveAttribute("data-pinned", "end");
    await expect(cell(page, 0, 0)).toHaveAttribute("data-pinned", "start");
});

test("moves to the next column with ArrowLeft", async ({ page }) => {
    await openExample(page, "rtl");
    await cell(page, 2, 0).click();
    await page.keyboard.press("ArrowLeft");
    await expect(cell(page, 2, 1)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 2, 0)).toBeFocused();
    await page.keyboard.press("End");
    await expect(cell(page, 2, 5)).toBeFocused();
});

test("grows a column dragged to the left, and reorders by dropping toward the end", async ({
    page,
}) => {
    await openExample(page, "rtl");
    const team = header(page, "الفريق");
    const before = (await boxOf(team)).width;
    await dragBy(
        page,
        page.getByRole("separator", { name: "تغيير عرض الفريق" }),
        -40,
    );
    expect((await boxOf(team)).width).toBeCloseTo(before + 40, 0);
    // the team dropped past the joining date's middle, to its left: after it
    const joined = header(page, "تاريخ الانضمام");
    const target = await boxOf(joined);
    const from = await boxOf(team);
    await dragBy(
        page,
        team,
        target.x + target.width / 4 - (from.x + from.width / 2),
    );
    await expect(
        page.locator(
            '[data-grid-part="header-cell"][data-column-index="4"]:not([data-group])',
        ),
    ).toHaveText("الفريق");
});

test("turns left to right with its switch", async ({ page }) => {
    await openExample(page, "rtl");
    await page.getByRole("switch", { name: "Right to left" }).click();
    await expect(viewport(page)).toHaveAttribute("dir", "ltr");
    expect(await startInView(page, cell(page, 0, 0), false)).toBeCloseTo(0, 0);
    await cell(page, 2, 0).click();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 2, 1)).toBeFocused();
});

test("grows the salary, pinned at the end, from its start edge: to the right", async ({
    page,
}) => {
    await openExample(page, "rtl");
    const salary = header(page, "الراتب");
    const before = await boxOf(salary);
    const handle = page.getByRole("separator", { name: "تغيير عرض الراتب" });
    // the boundary with the columns that scroll: the salary's right edge
    const box = await boxOf(handle);
    expect(box.x + box.width).toBeCloseTo(before.x + before.width, 0);
    await dragBy(page, handle, 30);
    const after = await boxOf(salary);
    expect(after.width).toBeCloseTo(before.width + 30, 0);
    // still at the view's left end
    expect(after.x).toBeCloseTo(before.x, 0);
});
