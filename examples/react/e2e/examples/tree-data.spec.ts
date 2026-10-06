import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, settle } from "./helpers";

// A project's files as a tree (Epic #87, E3.3): folders that open with their toggle, Space and the
// arrows, searched in memory (a match's folders stay), a folder's checkbox selecting what it
// holds, and the same tree listed by a server as folders open, their entries loading in place.

const row = (page: Page, rowIndex: number) =>
    page.locator(`[data-grid-part="row"][data-row-index="${rowIndex}"]`);

const grid = (page: Page) => page.getByRole("treegrid", { name: "Files" });

test("shows the files as a tree, src open to start with", async ({ page }) => {
    await openExample(page, "tree-data");
    // the header row, six top entries and src's four
    await expect(grid(page)).toHaveAttribute("aria-rowcount", "11");
    await expect(row(page, 0)).toHaveAttribute("aria-expanded", "true");
    await expect(row(page, 0)).toHaveAttribute("aria-level", "1");
    await expect(row(page, 1)).toHaveAttribute("aria-level", "2");
    await expect(cell(page, 1, 1)).toContainText("components");
    await page.getByRole("button", { name: "Expand components" }).click();
    await expect(row(page, 2)).toHaveAttribute("aria-level", "3");
    await expect(cell(page, 2, 1)).toContainText("button.tsx");
    await page.getByRole("button", { name: "Collapse src" }).click();
    await expect(grid(page)).toHaveAttribute("aria-rowcount", "7");
});

test("opens and closes folders with Space and the arrows", async ({ page }) => {
    await openExample(page, "tree-data");
    // docs, the second top entry once src closes
    await cell(page, 0, 3).click();
    await page.keyboard.press(" ");
    await expect(row(page, 0)).toHaveAttribute("aria-expanded", "false");
    // on docs' name (the toggle's cell, after the checkboxes), → opens it
    await cell(page, 1, 1).click({ position: { x: 200, y: 10 } });
    await page.keyboard.press("ArrowRight");
    await expect(row(page, 1)).toHaveAttribute("aria-expanded", "true");
    // a file (no toggle of its own): ← on its name goes up to docs' name
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowLeft");
    await settle(page);
    await expect(cell(page, 1, 1)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(row(page, 1)).toHaveAttribute("aria-expanded", "false");
});

test("keeps a search's folders, and selects a folder with what it holds", async ({
    page,
}) => {
    await openExample(page, "tree-data");
    await page.getByRole("button", { name: "Expand all" }).click();
    await page.getByRole("textbox", { name: "Search files" }).fill("keyboard");
    // docs, guides and keyboard.md
    await expect(grid(page)).toHaveAttribute("aria-rowcount", "4");
    await expect(cell(page, 2, 1)).toContainText("keyboard.md");
    await page.getByRole("checkbox", { name: "Select guides" }).click();
    await expect(row(page, 1)).toHaveAttribute("aria-selected", "true");
    await expect(row(page, 2)).toHaveAttribute("aria-selected", "true");
    await expect(
        page.getByRole("checkbox", { name: "Select docs" }),
    ).toHaveAttribute("aria-checked", "mixed");
});

test("lists the folders from a server as they open, their entries loading in place", async ({
    page,
}) => {
    await openExample(page, "tree-data");
    await page
        .getByRole("switch", { name: "Load folders from a server" })
        .click();
    await expect(grid(page)).toHaveAttribute("aria-rowcount", "7");
    await page.getByRole("button", { name: "Expand src" }).click();
    // src's four entries keep their room while they load
    await expect(grid(page)).toHaveAttribute("aria-rowcount", "11");
    await expect(row(page, 1)).toHaveAttribute("data-loading", "");
    await expect(row(page, 1)).toHaveAttribute("aria-level", "2");
    await expect(cell(page, 1, 1)).toContainText("components");
    await expect(row(page, 1)).not.toHaveAttribute("data-loading");
});
