import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";
import { header, values } from "./helpers";

// Rows in memory (Epic #47): one hook searches, filters, sorts and pages a thousand people.

test("pages the people, and a page size changes the pages", async ({
    page,
}) => {
    await openExample(page, "local-rows");
    await expect(page.getByTestId("count")).toHaveText("1,000 of 1,000 people");
    await expect(page.getByTestId("page")).toHaveText("Page 1 of 40");
    // the grid holds the page: 25 rows and the header row (it renders those in view)
    await expect(page.getByRole("grid", { name: "People" })).toHaveAttribute(
        "aria-rowcount",
        "26",
    );
    const first = await values(page, 0);
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByTestId("page")).toHaveText("Page 2 of 40");
    expect(await values(page, 0)).not.toEqual(first);
    await page.getByRole("button", { name: "Last page" }).click();
    await expect(page.getByTestId("page")).toHaveText("Page 40 of 40");
    await expect(
        page.getByRole("button", { name: "Next page" }),
    ).toBeDisabled();
    await page.getByRole("combobox", { name: "Rows per page" }).click();
    await page.getByRole("option", { name: "100 a page" }).click();
    await expect(page.getByTestId("page")).toHaveText("Page 1 of 10");
});

test("searches, filters by column and goes back to the first page", async ({
    page,
}) => {
    await openExample(page, "local-rows");
    await page.getByRole("button", { name: "Next page" }).click();
    await page
        .getByRole("textbox", { name: "Search every column" })
        .fill("design");
    await expect(page.getByTestId("page")).toContainText("Page 1 of");
    const teams = await values(page, 3);
    expect(teams.length).toBeGreaterThan(0);
    // a search matches any column: here, the team
    for (const team of teams) expect(team.toLowerCase()).toContain("design");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByTestId("count")).toHaveText("1,000 of 1,000 people");

    await page.getByRole("checkbox", { name: "Data" }).click();
    await page.getByRole("checkbox", { name: "Mobile" }).click();
    for (const team of await values(page, 3)) {
        expect(["Data", "Mobile"]).toContain(team);
    }
    await page.getByRole("combobox", { name: "Salary" }).click();
    await page.getByRole("option", { name: "From $120k" }).click();
    for (const salary of await values(page, 4)) {
        expect(Number(salary.replace(/[^\d]/g, ""))).toBeGreaterThanOrEqual(
            120_000,
        );
    }
    await page.getByRole("textbox", { name: "Name contains" }).fill("zzzz");
    await expect(page.getByTestId("empty")).toBeVisible();
    await expect(page.getByTestId("count")).toHaveText("0 of 1,000 people");
});

test("sorts from the header, the hook ordering the rows", async ({ page }) => {
    await openExample(page, "local-rows");
    await header(page, "Name").click();
    await expect(header(page, "Name")).toHaveAttribute(
        "aria-sort",
        "descending",
    );
    const names = await values(page, 0);
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
});
