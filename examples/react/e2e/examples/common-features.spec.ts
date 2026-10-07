import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, header, settle } from "./helpers";

// React Data Grid's CommonFeatures example: selection, columns pinned at both ends, sorting,
// resizing and editing, summary rows on top and at the bottom, and an export.

const summaryCell = (page: Page, position: "top" | "bottom", key: number) =>
    page
        .locator(`[data-grid-part="summary"]`)
        .nth(position === "top" ? 0 : 1)
        .locator(`[data-grid-part="summary-cell"][data-column-index="${key}"]`);

test("totals above and below, the availability's share following its checkboxes", async ({
    page,
}) => {
    await openExample(page, "common-features");
    await expect(summaryCell(page, "bottom", 1)).toHaveText(
        "Total · 1000 jobs",
    );
    await expect(summaryCell(page, "top", 1)).toHaveText("Average");
    const share = summaryCell(page, "bottom", 9);
    const before = await share.textContent();
    // the checkbox of the first row, pinned at the end
    await cell(page, 0, 9).getByRole("checkbox").click();
    await expect(share).not.toHaveText(before ?? "");
    await expect(cell(page, 0, 9)).toHaveAttribute("data-pinned", "end");
    await expect(cell(page, 0, 1)).toHaveAttribute("data-pinned", "start");
});

test("selects rows, a completed job excepted, and sorts by any column", async ({
    page,
}) => {
    await openExample(page, "common-features");
    await page.getByRole("checkbox", { name: "Select all" }).click();
    await expect(page.getByTestId("selected-count")).not.toHaveText(
        "0 selected",
    );
    const status = header(page, "Status");
    await status.click();
    await status.click();
    await settle(page);
    // descending: the first rows are not started, and the completed ones (at the end) cannot be
    // selected
    await expect(cell(page, 0, 3)).toHaveText("Not Started");
    await header(page, "Budget").click();
    await expect(header(page, "Budget")).toHaveAttribute(
        "aria-sort",
        "ascending",
    );
});

test("exports the app's rows to CSV, in the order shown", async ({ page }) => {
    await openExample(page, "common-features");
    await header(page, "Budget").click();
    await settle(page);
    const first = await cell(page, 0, 1).textContent();
    const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Export to CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("jobs.csv");
    const path = await download.path();
    const lines = (await readFile(path, "utf8")).split("\n");
    expect(lines[0]).toBe(
        "Task,Project,Status,Priority,Assignee,Completion,Deadline,Budget,Available",
    );
    // every row, not the few rendered
    expect(lines).toHaveLength(1001);
    expect(lines[1]?.startsWith(`${first},`)).toBe(true);
    // each cell as the grid shows it: the completion as a percentage, the budget as money
    const fields = lines[1]?.split(",") ?? [];
    expect(fields[5]).toMatch(/^\d+%$/);
    expect(lines[1]).toMatch(/,"?\$[\d,]+"?,(Yes|No)$/);
});

test("a job completed by an edit leaves select-all with every job it can select", async ({
    page,
}) => {
    await openExample(page, "common-features");
    let rowIndex = 0;
    while ((await cell(page, rowIndex, 3).textContent()) === "Completed") {
        rowIndex += 1;
    }
    await cell(page, rowIndex, 3).click();
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: "Completed" }).click();
    await expect(cell(page, rowIndex, 3)).toHaveText("Completed");
    const all = page.getByRole("checkbox", { name: "Select all" });
    await all.click();
    // every job that can be selected is: the one just completed is no longer among them
    await expect(all).toBeChecked();
    await expect(
        page.locator(`[data-grid-part="row"][data-row-index="${rowIndex}"]`),
    ).not.toHaveAttribute("aria-selected", "true");
});
