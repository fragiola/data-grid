import { expect, type Page, test } from "@playwright/test";
import { openExample, part } from "../helpers";
import { cell, rows } from "./helpers";

// Loading and errors (Epic #89, E5.2): skeleton rows through `getRow` → `undefined` while the first
// load runs, the error in the grid's empty state with a retry, and a refetch that keeps the rows.

const status = (page: Page) => page.getByTestId("status");
const failNext = (page: Page) =>
    page.getByRole("switch", { name: "Fail the next request" });
const grid = (page: Page) => page.getByRole("grid", { name: "People" });

test("shows skeleton rows while the first load runs, then the rows", async ({
    page,
}) => {
    await openExample(page, "loading-states");
    await expect(status(page)).toHaveText("Loading…");
    await expect(grid(page)).toHaveAttribute("aria-busy", "true");
    // every row is one not loaded yet: data-loading, a skeleton in its cells
    await expect(rows(page).first()).toHaveAttribute("data-loading", "");
    await expect(
        page.locator('[data-grid-part="row"]:not([data-loading])'),
    ).toHaveCount(0);
    await expect(status(page)).toHaveText("40 people");
    await expect(grid(page)).not.toHaveAttribute("aria-busy");
    await expect(
        page.locator('[data-grid-part="row"][data-loading]'),
    ).toHaveCount(0);
    await expect(cell(page, 0, 0)).toHaveText("1");
});

test("a failed first load shows its error and a retry in the empty state", async ({
    page,
}) => {
    await openExample(page, "loading-states");
    await expect(status(page)).toHaveText("40 people");
    await failNext(page).click();
    await page.getByRole("button", { name: "Start over" }).click();
    await expect(status(page)).toHaveText("Loading…");
    await expect(rows(page).first()).toHaveAttribute("data-loading", "");
    await expect(status(page)).toHaveText("Failed");
    // no rows: the grid's empty cell holds the error
    const error = page.getByTestId("error");
    await expect(error).toContainText("The people could not be loaded");
    await expect(error).toHaveAttribute("role", "gridcell");
    await expect(part(page, "root")).toHaveAttribute("data-empty", "");
    await failNext(page).click();
    await error.getByRole("button", { name: "Retry" }).click();
    await expect(status(page)).toHaveText("40 people");
    await expect(error).toHaveCount(0);
});

test("a refetch keeps the rows, marks the grid busy, and a failed one shows a banner", async ({
    page,
}) => {
    await openExample(page, "loading-states");
    await expect(status(page)).toHaveText("40 people");
    await page.getByRole("button", { name: "Refetch" }).click();
    await expect(status(page)).toHaveText("Refreshing…");
    await expect(grid(page)).toHaveAttribute("aria-busy", "true");
    // the rows stay on screen meanwhile
    await expect(cell(page, 0, 1)).not.toBeEmpty();
    await expect(status(page)).toHaveText("40 people");
    await failNext(page).click();
    await page.getByRole("button", { name: "Refetch" }).click();
    const banner = page.getByTestId("banner");
    await expect(banner).toHaveAttribute("role", "alert");
    await expect(banner).toContainText("Could not refresh");
    await expect(rows(page)).not.toHaveCount(0);
    await failNext(page).click();
    await banner.getByRole("button", { name: "Retry" }).click();
    await expect(banner).toHaveCount(0);
    await expect(status(page)).toHaveText("40 people");
});
