import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell } from "./helpers";

// Row selection (Epic #57): the grid keeps the selected keys; checkboxes, Shift+click, Shift+Space,
// Shift+Down and Ctrl+A select; completed tasks cannot be selected.

const row = (page: Page, rowIndex: number) =>
    page.locator(`[data-grid-part="row"][data-row-index="${rowIndex}"]`);

/** The rendered rows that can be selected (they carry aria-selected), among the first `count`. */
async function selectable(page: Page, count: number): Promise<number[]> {
    const found: number[] = [];
    for (let index = 0; index < count; index++) {
        if ((await row(page, index).getAttribute("aria-selected")) !== null) {
            found.push(index);
        }
    }
    return found;
}

const count = (page: Page) => page.getByTestId("selected-count");

test("a checkbox selects a row, Shift+click the selectable rows since it", async ({
    page,
}) => {
    await openExample(page, "row-selection");
    const rows = await selectable(page, 8);
    const first = rows[0] ?? 0;
    const last = rows.at(-1) ?? 0;
    await row(page, first).getByRole("checkbox").click();
    await expect(row(page, first)).toHaveAttribute("data-selected", "");
    await expect(row(page, first)).toHaveAttribute("aria-selected", "true");
    await row(page, last)
        .getByRole("checkbox")
        .click({ modifiers: ["Shift"] });
    await expect(count(page)).toHaveText(`${rows.length} selected`);
    // a completed task in the range stayed out
    for (let index = first; index <= last; index++) {
        if (!rows.includes(index)) {
            await expect(row(page, index)).not.toHaveAttribute(
                "data-selected",
                /.*/,
            );
        }
    }
});

test("Shift+Space, Shift+Down and Ctrl+A select from the keyboard; the header clears", async ({
    page,
}) => {
    await openExample(page, "row-selection");
    const rows = await selectable(page, 8);
    const first = rows[0] ?? 0;
    await page.locator('[data-grid-part="grid"]').focus();
    for (let index = 0; index < first; index++) {
        await page.keyboard.press("ArrowDown");
    }
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, first, 1)).toBeFocused();
    await page.keyboard.press("Shift+Space");
    await expect(row(page, first)).toHaveAttribute("data-selected", "");
    await page.keyboard.press("Shift+ArrowDown");
    await expect(cell(page, first + 1, 1)).toBeFocused();
    await expect(count(page)).toHaveText(
        `${rows.filter((index) => index <= first + 1).length} selected`,
    );
    await page.keyboard.press("ControlOrMeta+a");
    const all = page.getByRole("checkbox", { name: "Select all" });
    await expect(all).toHaveAttribute("aria-checked", "true");
    await all.click();
    await expect(count(page)).toHaveText("0 selected");
    await expect(page.locator("[data-selected]")).toHaveCount(0);
});

test("one at a time: a row replaces the other, and the grid is not multiselectable", async ({
    page,
}) => {
    await openExample(page, "row-selection");
    const grid = page.locator('[data-grid-part="grid"]');
    await expect(grid).toHaveAttribute("aria-multiselectable", "true");
    await page.getByRole("switch").click();
    await expect(grid).not.toHaveAttribute("aria-multiselectable", /.*/);
    const [a = 0, b = 1] = await selectable(page, 8);
    await row(page, a).getByRole("checkbox").click();
    await row(page, b).getByRole("checkbox").click();
    await expect(count(page)).toHaveText("1 selected");
    await expect(row(page, b)).toHaveAttribute("data-selected", "");
    await expect(row(page, a)).not.toHaveAttribute("data-selected", /.*/);
    // a Shift+click is a plain toggle with one row at a time
    await row(page, a)
        .getByRole("checkbox")
        .click({ modifiers: ["Shift"] });
    await expect(count(page)).toHaveText("1 selected");
    await expect(row(page, a)).toHaveAttribute("data-selected", "");
    // the header only clears
    const all = page.getByRole("checkbox", { name: "Select all" });
    await all.click();
    await expect(count(page)).toHaveText("0 selected");
    await expect(all).toBeDisabled();
});
