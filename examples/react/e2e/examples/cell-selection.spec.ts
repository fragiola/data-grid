import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { boxOf, cell, settle } from "./helpers";

// A year's budget selected by range (Epic #88, E4.1–E4.2): the app sums the range as it changes,
// copies go to the clipboard as TSV (an owner's name through `getCopyText`) and pastes land in
// the app's own rows, a paste reaching the totals refused.

const status = (page: Page) => page.getByRole("status");

const summary = (page: Page) => page.getByText(/cells · Sum|No range selected/);

/** A cell's amount, as shown ("$1,200" → 1200). */
async function amount(page: Page, rowIndex: number, columnIndex: number) {
    const text = await cell(page, rowIndex, columnIndex).textContent();
    return Number(text?.replace(/[$,]/g, ""));
}

/** A drag from one cell's centre to another's. */
async function dragCells(
    page: Page,
    from: [number, number],
    to: [number, number],
) {
    const start = await boxOf(cell(page, ...from));
    const end = await boxOf(cell(page, ...to));
    await page.mouse.move(
        start.x + start.width / 2,
        start.y + start.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {
        steps: 6,
    });
    await page.mouse.up();
    await settle(page);
}

test("a dragged range is drawn from its cells' attributes and summed by the app", async ({
    page,
}) => {
    await openExample(page, "cell-selection");
    await expect(summary(page)).toHaveText("No range selected");
    await dragCells(page, [0, 2], [1, 3]);
    const sum =
        (await amount(page, 0, 2)) +
        (await amount(page, 0, 3)) +
        (await amount(page, 1, 2)) +
        (await amount(page, 1, 3));
    await expect(summary(page)).toHaveText(
        `2 × 2 cells · Sum $${sum.toLocaleString("en-US")}`,
    );
    const corner = cell(page, 0, 2);
    await expect(corner).toHaveAttribute("data-range-edge", "top start");
    await expect(corner).toHaveAttribute("aria-selected", "true");
    // the app's own lines, on a layer over the cell
    expect(
        await corner.evaluate((element) => {
            const after = getComputedStyle(element, "::after");
            return [after.borderTopWidth, after.borderInlineStartWidth];
        }),
    ).toEqual(["2px", "2px"]);
    await page.keyboard.press("Escape");
    await expect(summary(page)).toHaveText("No range selected");
    await expect(corner).not.toHaveAttribute("data-range-edge");
});

test("a copied range pastes into the app's rows, from the range's first cell", async ({
    page,
}) => {
    await openExample(page, "cell-selection");
    const january = await cell(page, 0, 2).textContent();
    const february = await cell(page, 0, 3).textContent();
    await cell(page, 0, 2).click();
    await page.keyboard.press("Shift+ArrowRight");
    await page.keyboard.press("ControlOrMeta+c");
    await cell(page, 5, 2).click();
    await page.keyboard.press("ControlOrMeta+v");
    await settle(page);
    await expect(cell(page, 5, 2)).toHaveText(january ?? "");
    await expect(cell(page, 5, 3)).toHaveText(february ?? "");
    await expect(status(page)).toHaveText("Pasted 2 cells.");
    // reaching the totals: refused whole (December, the last month, scrolled to by the keys)
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowLeft");
    await settle(page);
    await expect(cell(page, 5, 13)).toBeFocused();
    const december = await cell(page, 5, 13).textContent();
    await page.keyboard.press("ControlOrMeta+v");
    await settle(page);
    await expect(status(page)).toHaveText(
        "Totals are worked out from the months: paste into the lines, owners or months.",
    );
    await expect(cell(page, 5, 13)).toHaveText(december ?? "");
});

test("an owner copies as its name, through the column's getCopyText", async ({
    page,
}) => {
    await openExample(page, "cell-selection");
    const owner = await cell(page, 0, 1).textContent();
    await cell(page, 0, 1).click();
    await page.keyboard.press("ControlOrMeta+c");
    await cell(page, 3, 1).click();
    await page.keyboard.press("ControlOrMeta+v");
    await settle(page);
    await expect(cell(page, 3, 1)).toHaveText(owner ?? "");
    // text is no amount: left as it was, and said
    const march = await cell(page, 3, 4).textContent();
    await cell(page, 3, 4).click();
    await page.keyboard.press("ControlOrMeta+v");
    await settle(page);
    await expect(cell(page, 3, 4)).toHaveText(march ?? "");
    await expect(status(page)).toHaveText(
        "Pasted 1 cell; 1 not an amount, left as it was.",
    );
});
