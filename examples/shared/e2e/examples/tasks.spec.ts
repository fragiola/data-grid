import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { rows } from "./helpers";

// The app's own faceted filters over the rows it gives the grid: AND across facets, OR within.

const filters = (page: Page) =>
    page.getByRole("complementary", { name: "Filters" });

const option = (page: Page, facet: string, value: string) =>
    filters(page)
        .getByRole("group", { name: facet })
        .locator("label")
        .filter({ hasText: value });

/** Every rendered row's value in a column (0 Name, 2 Priority, 4 Assigned to). */
const column = (page: Page, index: number) =>
    rows(page).locator(`[data-column-index="${index}"]`).allTextContents();

test("filters by two facets at once, and clears", async ({ page }) => {
    await openExample(page, "tasks");
    const shown = page.getByTestId("shown");
    await expect(shown).toHaveText("200 of 200 tasks");
    const highCount = Number(
        await option(page, "Priority", "High")
            .locator("span")
            .last()
            .textContent(),
    );

    await option(page, "Priority", "High").click();
    await expect(shown).toHaveText(`${highCount} of 200 tasks`);
    // Sara's count now counts only High tasks: checking it shows exactly that many
    const saraCount = Number(
        await option(page, "Assigned to", "Sara")
            .locator("span")
            .last()
            .textContent(),
    );
    await option(page, "Assigned to", "Sara").click();
    await expect(shown).toHaveText(`${saraCount} of 200 tasks`);
    expect(new Set(await column(page, 2))).toEqual(new Set(["High"]));
    expect(new Set(await column(page, 4))).toEqual(new Set(["Sara"]));

    await filters(page).getByRole("button", { name: "Clear" }).click();
    await expect(shown).toHaveText("200 of 200 tasks");
});

test("checking two values of one facet keeps both", async ({ page }) => {
    await openExample(page, "tasks");
    await option(page, "Project", "Project A").click();
    await option(page, "Project", "Project C").click();
    expect(new Set(await column(page, 1))).toEqual(
        new Set(["Project A", "Project C"]),
    );
});
