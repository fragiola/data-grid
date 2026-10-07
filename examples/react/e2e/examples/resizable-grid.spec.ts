import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { settle, viewport } from "./helpers";

// React Data Grid's ResizableGrid example: the grid's scroll container is resizable (CSS
// `resize: both`), and the engine follows its size on its own.

const inView = (page: Page) => page.getByTestId("in-view");

/** What the reader's drag on the corner does: the scroll container's inline size. */
async function resize(page: Page, width: number, height: number) {
    await viewport(page).evaluate(
        (element, size) => {
            if (!(element instanceof HTMLElement)) return;
            element.style.width = `${size.width}px`;
            element.style.height = `${size.height}px`;
        },
        { width, height },
    );
    await settle(page);
    await settle(page);
}

test("the grid's corner resizes it", async ({ page }) => {
    await openExample(page, "resizable-grid");
    await expect(viewport(page)).toHaveCSS("resize", "both");
});

test("a smaller grid shows fewer rows and columns, a larger one more", async ({
    page,
}) => {
    await openExample(page, "resizable-grid");
    await resize(page, 300, 200);
    // 300 px of 90 px columns, 200 px less the header of 32 px rows
    await expect(inView(page)).toHaveText(
        /^[5-6] rows × [3-4] columns in view$/,
    );
    const small = await page.locator('[data-grid-part="cell"]').count();

    await resize(page, 600, 360);
    await expect(inView(page)).toHaveText(
        /^1[01] rows × [7-8] columns in view$/,
    );
    // the new cells are rendered: the engine laid the window out again
    expect(
        await page.locator('[data-grid-part="cell"]').count(),
    ).toBeGreaterThan(small);
    const last = page.locator(
        '[data-grid-part="header-cell"][data-column-index="6"]',
    );
    await expect(last).toBeVisible();
});
