import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, header, settle } from "./helpers";

// Rows grouped by team, or by team then city (Epic #87, E3.2): a treegrid whose group rows show a
// count and a payroll, expanded by their toggle and the keys, sorted, searched and selected
// inside their groups.

const row = (page: Page, rowIndex: number) =>
    page.locator(`[data-grid-part="row"][data-row-index="${rowIndex}"]`);

const grid = (page: Page) => page.getByRole("treegrid", { name: "People" });

const toggle = (page: Page, name: string) =>
    page.getByRole("button", { name, exact: true });

test("groups the people by team, with each team's count and payroll", async ({
    page,
}) => {
    await openExample(page, "row-grouping");
    // the header row, six teams and the 84 people of Design, expanded to start with
    await expect(grid(page)).toHaveAttribute("aria-rowcount", "91");
    await expect(row(page, 0)).toHaveAttribute("data-group-row", "");
    await expect(row(page, 0)).toHaveAttribute("aria-expanded", "false");
    await expect(cell(page, 0, 1)).toContainText("Data");
    await expect(cell(page, 0, 1)).toContainText("81");
    await expect(row(page, 1)).toHaveAttribute("aria-expanded", "true");
    await expect(cell(page, 1, 4)).toHaveText("$8,997,000");
    // its people a level down, sorted by name
    await expect(row(page, 2)).toHaveAttribute("aria-level", "2");
    await expect(cell(page, 2, 2)).toHaveText("Design");
    await toggle(page, "Collapse Design").click();
    await expect(grid(page)).toHaveAttribute("aria-rowcount", "7");
    await page.getByRole("button", { name: "Expand all" }).click();
    await expect(grid(page)).toHaveAttribute("aria-rowcount", "507");
    await page.getByRole("button", { name: "Collapse all" }).click();
    await expect(grid(page)).toHaveAttribute("aria-rowcount", "7");
});

test("expands and collapses a group with the keys", async ({ page }) => {
    await openExample(page, "row-grouping");
    await cell(page, 0, 3).click();
    await page.keyboard.press("Enter");
    await expect(row(page, 0)).toHaveAttribute("aria-expanded", "true");
    // ← on the group's name (its toggle's cell, after the checkboxes) collapses it
    await cell(page, 0, 1).click({ position: { x: 200, y: 10 } });
    await page.keyboard.press("ArrowLeft");
    await expect(row(page, 0)).toHaveAttribute("aria-expanded", "false");
    // the checkbox column is a plain one: → moves to the name, then opens
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await expect(row(page, 0)).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("ArrowRight");
    await expect(row(page, 0)).toHaveAttribute("aria-expanded", "true");
    // down into its people, and ← on a name back up to the group's
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowLeft");
    await settle(page);
    await expect(cell(page, 0, 1)).toBeFocused();
});

test("groups by team, then city", async ({ page }) => {
    await openExample(page, "row-grouping");
    await page.getByRole("combobox", { name: "Group rows" }).click();
    await page.getByRole("option", { name: "By team, then city" }).click();
    await toggle(page, "Expand Data").click();
    // Data's cities, a level down, collapsed
    await expect(row(page, 1)).toHaveAttribute("aria-level", "2");
    await expect(row(page, 1)).toHaveAttribute("aria-expanded", "false");
    await expect(row(page, 1)).toHaveAttribute("data-group-row", "");
});

test("selects a group's people with its checkbox, the archived ones left out", async ({
    page,
}) => {
    await openExample(page, "row-grouping");
    await page.getByRole("checkbox", { name: "Select Design" }).click();
    // 84 in Design, 5 of them archived (joined before 2012)
    await expect(page.getByTestId("selected-count")).toContainText(
        "79 selected",
    );
    await expect(row(page, 1)).toHaveAttribute("aria-selected", "true");
    // the first, archived: never selected
    await expect(row(page, 2).getByRole("checkbox")).toBeDisabled();
    await expect(row(page, 3)).toHaveAttribute("aria-selected", "true");
    // one person cleared: the group's box shows some of them
    await row(page, 3).getByRole("checkbox").click();
    await expect(page.getByTestId("selected-count")).toContainText(
        "78 selected",
    );
    await expect(
        page.getByRole("checkbox", { name: "Select Design" }),
    ).toHaveAttribute("aria-checked", "mixed");
    await expect(row(page, 1)).toHaveAttribute("aria-selected", "false");
});

test("selects every selectable person with Ctrl+A, collapsed groups' too", async ({
    page,
}) => {
    await openExample(page, "row-grouping");
    await page.getByRole("button", { name: "Collapse all" }).click();
    await cell(page, 0, 3).click();
    await page.keyboard.press("ControlOrMeta+a");
    // 500 people, 63 of them archived
    await expect(page.getByTestId("selected-count")).toContainText(
        "437 selected",
    );
    await expect(row(page, 0)).toHaveAttribute("aria-selected", "true");
});

test("searches and sorts inside the groups", async ({ page }) => {
    await openExample(page, "row-grouping");
    const first = await cell(page, 2, 1).textContent();
    // the salary descending: Design's best paid first
    await header(page, "Salary").click();
    await header(page, "Salary").click();
    await expect(cell(page, 2, 1)).not.toHaveText(first ?? "");
    const top = Number(
        (await cell(page, 2, 4).textContent())?.replace(/\D/g, ""),
    );
    const next = Number(
        (await cell(page, 3, 4).textContent())?.replace(/\D/g, ""),
    );
    expect(top).toBeGreaterThanOrEqual(next);
    // a search keeps the groups with someone left, and their people who match
    await page
        .getByRole("textbox", { name: "Search every column" })
        .fill("lisbon");
    await expect(page.getByTestId("selected-count")).not.toContainText(
        "500 people",
    );
    const cities = await page
        .locator(
            '[data-grid-part="row"]:not([data-group-row]) [data-grid-part="cell"][data-column-index="3"]',
        )
        .allTextContents();
    expect(cities.length).toBeGreaterThan(0);
    expect(new Set(cities)).toEqual(new Set(["Lisbon"]));
});
