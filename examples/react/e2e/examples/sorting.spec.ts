import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";
import { header, values } from "./helpers";

// Sorting from the header (Epic #27): the grid keeps the sort, and one hook orders the rows in
// memory by it (Epic #47).

const sortedBy = (list: string[], order: 1 | -1) =>
    [...list].sort((a, b) => order * a.localeCompare(b));

test("starts sorted by team, and a click sorts by another column, both ways", async ({
    page,
}) => {
    await openExample(page, "sorting");
    await expect(header(page, "Team")).toHaveAttribute(
        "aria-sort",
        "ascending",
    );
    const teams = await values(page, 3);
    expect(teams).toEqual(sortedBy(teams, 1));
    await header(page, "City").click();
    await expect(header(page, "City")).toHaveAttribute(
        "aria-sort",
        "ascending",
    );
    await expect(header(page, "Team")).not.toHaveAttribute("aria-sort", /.*/);
    const cities = await values(page, 2);
    expect(cities).toEqual(sortedBy(cities, 1));
    await header(page, "City").click();
    await expect(header(page, "City")).toHaveAttribute(
        "aria-sort",
        "descending",
    );
    const descending = await values(page, 2);
    expect(descending).toEqual(sortedBy(descending, -1));
});

test("sorts names by last name, the column's own compare", async ({ page }) => {
    await openExample(page, "sorting");
    await header(page, "Name").click();
    const lastNames = (await values(page, 0)).map(
        (name) => name.split(" ").at(-1) ?? name,
    );
    expect(lastNames).toEqual(sortedBy(lastNames, 1));
});

test("adds a column with Ctrl or ⌘, showing each one's priority", async ({
    page,
}) => {
    await openExample(page, "sorting");
    await header(page, "City").click({ modifiers: ["ControlOrMeta"] });
    await expect(header(page, "Team")).toHaveAttribute(
        "data-sort-priority",
        "1",
    );
    await expect(header(page, "City")).toHaveAttribute(
        "data-sort-priority",
        "2",
    );
    await expect(header(page, "City")).toContainText("2");
    // inside a team, cities are in order
    const rows = await page
        .locator('[data-grid-part="row"]')
        .evaluateAll((elements) =>
            elements.map((row) => [
                row.querySelector('[data-column-index="3"]')?.textContent ?? "",
                row.querySelector('[data-column-index="2"]')?.textContent ?? "",
            ]),
        );
    for (let i = 1; i < rows.length; i++) {
        const [team, city] = rows[i] ?? [];
        const [previousTeam, previousCity] = rows[i - 1] ?? [];
        if (team === previousTeam) {
            expect(
                (previousCity ?? "").localeCompare(city ?? ""),
            ).toBeLessThanOrEqual(0);
        }
    }
});

test("sorts from the keyboard, and not by a column that is not sortable", async ({
    page,
}) => {
    await openExample(page, "sorting");
    await header(page, "Email").click();
    await expect(header(page, "Email")).not.toHaveAttribute(
        "data-sortable",
        /.*/,
    );
    await expect(header(page, "Team")).toHaveAttribute(
        "aria-sort",
        "ascending",
    );
    // Email is active: one to the right is City
    await page.keyboard.press("ArrowRight");
    await expect(header(page, "City")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(header(page, "City")).toHaveAttribute(
        "aria-sort",
        "ascending",
    );
    await page.keyboard.press("Space");
    await expect(header(page, "City")).toHaveAttribute(
        "aria-sort",
        "descending",
    );
});
