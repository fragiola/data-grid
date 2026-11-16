import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, rows } from "./helpers";

// Selecting on a server (Epic #89, E5.2): the documented middleware turns `selected-rows.select-all`
// into the app's "every row but" state, which an export sends as it is.

const count = (page: Page) => page.getByTestId("selected-count");
const lastRequest = (page: Page) =>
    page.getByTestId("request-log").locator("li").first();
const selectAll = (page: Page) =>
    page.getByRole("checkbox", { name: "Select all" });

async function open(page: Page) {
    await openExample(page, "server-selection");
    await expect(cell(page, 0, 1)).toHaveText("1");
}

test("the header's box selects every row of the server's, kept across pages", async ({
    page,
}) => {
    await open(page);
    await selectAll(page).click();
    await expect(count(page)).toHaveText("10,000 of 10,000 selected");
    await expect(page.getByTestId("banner")).toContainText(
        "All 10,000 people are selected",
    );
    await expect(rows(page).first()).toHaveAttribute("aria-selected", "true");
    // the next page is selected too: it is part of "all"
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(cell(page, 0, 1)).toHaveText("51");
    await expect(rows(page).first()).toHaveAttribute("aria-selected", "true");
    // a row left out: every row but one
    await page
        .getByRole("checkbox", { name: /^Select / })
        .nth(1)
        .click();
    await expect(count(page)).toHaveText("9,999 of 10,000 selected");
    await expect(rows(page).first()).toHaveAttribute("aria-selected", "false");
    await page.getByRole("button", { name: "Export" }).click();
    await expect(lastRequest(page)).toHaveText("export every person but 1");
    await expect(page.getByTestId("exported")).toHaveText(
        "Exported every person but 1",
    );
    // and clearing
    await page.getByRole("button", { name: "Clear selection" }).click();
    await expect(count(page)).toHaveText("0 of 10,000 selected");
    await expect(page.locator("[data-selected]")).toHaveCount(0);
});

test("Ctrl/⌘+A goes through the middleware too, and a page selected offers every row", async ({
    page,
}) => {
    await open(page);
    await cell(page, 2, 2).click();
    await page.keyboard.press("ControlOrMeta+a");
    await expect(count(page)).toHaveText("10,000 of 10,000 selected");
    await selectAll(page).click();
    await expect(count(page)).toHaveText("0 of 10,000 selected");
    // two rows chosen one by one: their keys only
    await page
        .getByRole("checkbox", { name: /^Select / })
        .nth(1)
        .click();
    await page
        .getByRole("checkbox", { name: /^Select / })
        .nth(2)
        .click();
    await expect(count(page)).toHaveText("2 of 10,000 selected");
    await expect(selectAll(page)).toHaveAttribute("aria-checked", "mixed");
    await page.getByRole("button", { name: "Export" }).click();
    await expect(lastRequest(page)).toHaveText("export 2 people");
});
