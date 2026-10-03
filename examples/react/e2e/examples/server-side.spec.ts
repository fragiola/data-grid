import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";

// The external mode (Epic #47): the app sends the sort, a filter, a search and the page to a
// pretend server, and the grid shows the page that comes back.

const header = (page: Page, name: string) =>
    page.getByRole("columnheader").filter({ hasText: name });

const values = (page: Page, columnIndex: number) =>
    page
        .locator(`[data-grid-part="cell"][data-column-index="${columnIndex}"]`)
        .allTextContents();

/** The newest request the app sent. */
const lastRequest = (page: Page) =>
    page.getByTestId("request-log").locator("li").first();

test("asks the server for a sorted page, and shows it", async ({ page }) => {
    await openExample(page, "server-side");
    await expect(page.getByTestId("count")).toHaveText("10,000 people");
    await expect(lastRequest(page)).toHaveText("page 1 · sorted by name ↑");
    await expect(page.getByTestId("page")).toHaveText("Page 1 of 200");
    await header(page, "City").click();
    await expect(lastRequest(page)).toHaveText("page 1 · sorted by city ↑");
    await expect(page.getByTestId("count")).toHaveText("10,000 people");
    const cities = await values(page, 2);
    expect(cities).toEqual([...cities].sort((a, b) => a.localeCompare(b)));
});

test("sends a filter, a search and the page, back to the first page on a filter", async ({
    page,
}) => {
    await openExample(page, "server-side");
    await expect(page.getByTestId("count")).toHaveText("10,000 people");
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(lastRequest(page)).toHaveText("page 2 · sorted by name ↑");
    await page.getByRole("combobox", { name: "Team" }).click();
    await page.getByRole("option", { name: "Design" }).click();
    await expect(lastRequest(page)).toHaveText(
        "page 1 · sorted by name ↑ · team Design",
    );
    await expect(page.getByTestId("count")).not.toHaveText("Loading…");
    for (const team of await values(page, 3)) expect(team).toBe("Design");
    await page
        .getByRole("textbox", { name: "Search every column" })
        .fill("ana");
    await expect(lastRequest(page)).toHaveText(
        "page 1 · sorted by name ↑ · team Design · “ana”",
    );
});
