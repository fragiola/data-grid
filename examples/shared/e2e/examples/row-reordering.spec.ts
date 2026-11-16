import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { boxOf, cell, header, settle, values } from "./helpers";

// A backlog put in order by the rows' handles and the keys (Epic #86, E2.3): the grid tells each
// move, the app moves its own rows and says what moved; sorted, the rows keep the sort's order.

const FIRST = [
    "Market Analysis",
    "Product Design",
    "Manufacturing Setup",
    "Quality Assurance",
    "Marketing Strategy",
];

/** The first rows' tasks, in order. */
async function names(page: Page, count = 5) {
    return (await values(page, 1)).slice(0, count);
}

const handle = (page: Page, rowIndex: number) =>
    page.locator(
        `[data-grid-part="row"][data-row-index="${rowIndex}"] [data-grid-part="row-drag-handle"]`,
    );

const row = (page: Page, rowIndex: number) =>
    page.locator(`[data-grid-part="row"][data-row-index="${rowIndex}"]`);

const status = (page: Page) => page.getByRole("status");

/** Presses a row's handle and moves the pointer to `fraction` of row `to`'s height. */
async function dragRow(
    page: Page,
    from: number,
    to: number,
    fraction: number,
    { hold = false } = {},
) {
    const start = await boxOf(handle(page, from));
    const target = await boxOf(row(page, to));
    await page.mouse.move(
        start.x + start.width / 2,
        start.y + start.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        start.x + start.width / 2,
        target.y + target.height * fraction,
        { steps: 6 },
    );
    await settle(page);
    if (!hold) {
        await page.mouse.up();
        await settle(page);
    }
}

test("a row dragged by its handle moves on release, the drop target drawn meanwhile", async ({
    page,
}) => {
    await openExample(page, "row-reordering");
    expect(await names(page)).toEqual(FIRST);
    await dragRow(page, 1, 3, 0.75, { hold: true });
    await expect(row(page, 1)).toHaveAttribute("data-dragging", "");
    await expect(row(page, 3)).toHaveAttribute("data-drop-target", "after");
    // the app's own indicator, from that attribute: a line inside the target
    await expect(row(page, 3)).toHaveCSS("box-shadow", /inset/);
    await expect(row(page, 1)).toHaveCSS("opacity", "0.5");
    expect(await names(page)).toEqual(FIRST);
    await page.mouse.up();
    await settle(page);
    expect(await names(page)).toEqual([
        "Market Analysis",
        "Manufacturing Setup",
        "Quality Assurance",
        "Product Design",
        "Marketing Strategy",
    ]);
    await expect(status(page)).toHaveText(
        "Moved Product Design to position 4 of 200.",
    );
    // its place in the backlog follows it
    await expect(cell(page, 3, 0)).toHaveText("4");
    await page.getByRole("button", { name: "Reset order" }).click();
    expect(await names(page)).toEqual(FIRST);
});

test("Escape cancels a drag", async ({ page }) => {
    await openExample(page, "row-reordering");
    await dragRow(page, 0, 3, 0.75, { hold: true });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await settle(page);
    expect(await names(page)).toEqual(FIRST);
    expect(
        await page.locator("[data-dragging], [data-drop-target]").count(),
    ).toBe(0);
});

test("Ctrl or ⌘, Shift and the arrows move the active row, focus following it", async ({
    page,
}) => {
    await openExample(page, "row-reordering");
    await cell(page, 0, 1).click();
    await page.keyboard.press("ControlOrMeta+Shift+ArrowDown");
    await page.keyboard.press("ControlOrMeta+Shift+ArrowDown");
    await settle(page);
    expect(await names(page)).toEqual([
        "Product Design",
        "Manufacturing Setup",
        "Market Analysis",
        "Quality Assurance",
        "Marketing Strategy",
    ]);
    await expect(cell(page, 2, 1)).toBeFocused();
    await expect(status(page)).toHaveText(
        "Moved Market Analysis to position 3 of 200.",
    );
});

test("a sorted backlog keeps the sort's order until the sort is cleared", async ({
    page,
}) => {
    await openExample(page, "row-reordering");
    await header(page, "Task").click();
    await expect(status(page)).toHaveText(
        "Sorted rows keep the sort's order: clear it to reorder.",
    );
    await expect(handle(page, 1)).not.toHaveAttribute("data-reorderable");
    const sorted = await names(page);
    await dragRow(page, 1, 3, 0.75);
    expect(await names(page)).toEqual(sorted);
    await page.getByRole("button", { name: "Clear sort" }).click();
    await expect(handle(page, 1)).toHaveAttribute("data-reorderable", "");
    expect(await names(page)).toEqual(FIRST);
});

test("a move among the rows a search leaves lands beside its neighbour in the backlog", async ({
    page,
}) => {
    await openExample(page, "row-reordering");
    await page
        .getByRole("textbox", { name: "Search every column" })
        .fill("Market");
    await settle(page);
    // "Market Analysis", "Marketing Strategy", then the next rounds' ones
    const found = await names(page, 3);
    expect(found.slice(0, 2)).toEqual([
        "Market Analysis",
        "Marketing Strategy",
    ]);
    await dragRow(page, 1, 0, 0.25);
    expect(await names(page, 2)).toEqual([
        "Marketing Strategy",
        "Market Analysis",
    ]);
    await page.getByRole("textbox", { name: "Search every column" }).fill("");
    await settle(page);
    // first in the backlog: it went before Market Analysis
    expect(await names(page, 3)).toEqual([
        "Marketing Strategy",
        "Market Analysis",
        "Product Design",
    ]);
    await expect(cell(page, 0, 0)).toHaveText("1");
});
