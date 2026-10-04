import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";

// The grid's selection (the app keeps the keys and deletes those rows), and the grid's sort (the
// app orders the rows by it).

const header = (page: Page, name: string) =>
    page.getByRole("columnheader").filter({ hasText: name });

/** The body rows (the header row is a row too). */
const bodyRows = (page: Page) => page.locator('[data-grid-part="row"]');

/** The rendered rows' domains: they identify the companies (the name cell holds initials too). */
/** The order the local pipeline sorts text in: the reader's, numbers by value ("3" before "10"). */
const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
});

const domains = (page: Page) =>
    bodyRows(page).locator('[data-column-index="2"]').allTextContents();

test("selects every row, and shows an indeterminate header after unchecking one", async ({
    page,
}) => {
    await openExample(page, "companies");
    const count = page.getByTestId("selected-count");
    await expect(count).toHaveText("0 selected · 500 companies");
    await page.getByRole("checkbox", { name: "Select all" }).click();
    await expect(count).toHaveText("500 selected · 500 companies");
    await bodyRows(page).first().getByRole("checkbox").click();
    await expect(count).toHaveText("499 selected · 500 companies");
    await expect(
        page.getByRole("checkbox", { name: "Select all" }),
    ).toHaveAttribute("aria-checked", "mixed");
});

test("deletes exactly the selected rows", async ({ page }) => {
    await openExample(page, "companies");
    const [first, second, third] = (await domains(page)).slice(0, 3);
    await bodyRows(page).nth(0).getByRole("checkbox").click();
    await bodyRows(page).nth(2).getByRole("checkbox").click();
    await page.getByRole("button", { name: "Delete selected" }).click();
    await expect(page.getByTestId("selected-count")).toHaveText(
        "0 selected · 498 companies",
    );
    const after = await domains(page);
    expect(after).not.toContain(first);
    expect(after).not.toContain(third);
    expect(after[0]).toBe(second);
    await expect(
        page.getByRole("button", { name: "Delete selected" }),
    ).toBeDisabled();
});

test("sorts from the header, both ways, with aria-sort", async ({ page }) => {
    await openExample(page, "companies");
    await expect(header(page, "Company")).toHaveAttribute(
        "aria-sort",
        "ascending",
    );
    await header(page, "Domain").click();
    await expect(header(page, "Domain")).toHaveAttribute(
        "aria-sort",
        "ascending",
    );
    await expect(header(page, "Company")).not.toHaveAttribute(
        "aria-sort",
        /.*/,
    );
    const ascending = await domains(page);
    expect(ascending).toEqual([...ascending].sort(collator.compare));
    await header(page, "Domain").click();
    await expect(header(page, "Domain")).toHaveAttribute(
        "aria-sort",
        "descending",
    );
    const descending = await domains(page);
    expect(descending).toEqual(
        [...descending].sort((a, b) => collator.compare(b, a)),
    );
});

test("adds a column to the sort with Ctrl or ⌘, the first one keeping aria-sort", async ({
    page,
}) => {
    await openExample(page, "companies");
    await header(page, "Domain").click({ modifiers: ["ControlOrMeta"] });
    await expect(header(page, "Company")).toHaveAttribute(
        "aria-sort",
        "ascending",
    );
    await expect(header(page, "Domain")).toHaveAttribute(
        "data-sort-priority",
        "2",
    );
    await expect(header(page, "Domain")).not.toHaveAttribute("aria-sort", /.*/);
});

test("sorts from the toolbar's select", async ({ page }) => {
    await openExample(page, "companies");
    await page.getByRole("combobox", { name: "Sorted by" }).click();
    // (the location column is out of the column window: its header is not in the page)
    await page.getByRole("option", { name: "Domain" }).click();
    await expect(header(page, "Domain")).toHaveAttribute(
        "aria-sort",
        "ascending",
    );
    await expect(header(page, "Company")).not.toHaveAttribute(
        "aria-sort",
        /.*/,
    );
});

test("the grid is one tab stop: Enter reaches a cell's control, Escape comes back, Tab leaves", async ({
    page,
}) => {
    await openExample(page, "companies");
    const root = page.locator('[data-grid-part="root"]');
    const focusInGrid = () =>
        root.evaluate((element) => element.contains(document.activeElement));
    await bodyRows(page).first().locator('[data-column-index="2"]').click();
    await page.keyboard.press("Tab");
    expect(await focusInGrid()).toBe(false);

    // the arrows reach the checkbox's cell, Enter hands it the keys and Space toggles it
    await bodyRows(page).first().locator('[data-column-index="2"]').click();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    const checkbox = bodyRows(page).first().getByRole("checkbox");
    await expect(checkbox).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("selected-count")).toHaveText(
        "1 selected · 500 companies",
    );
    // Tab stays in the cell (its only control), Escape gives the keys back, Tab leaves
    await page.keyboard.press("Tab");
    await expect(checkbox).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
        bodyRows(page).first().locator('[data-column-index="0"]'),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    expect(await focusInGrid()).toBe(false);
});
