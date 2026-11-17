import { expect, type Page, test } from "@playwright/test";
import {
    cell,
    renderedRows,
    scrollTo,
    settle,
    viewport,
} from "../../../examples/shared/e2e/examples/helpers.ts";

// The bare grid (Epic #141, fixtures/bare-grid): no feature installed. It renders, scrolls on both
// axes past the scaling cap and virtualizes as before; its sortable columns neither sort nor carry
// a sort attribute. Without navigation (Epic #144) it is the APG table pattern: `role="table"`,
// `columnheader` and `cell`, no tab stop on the grid nor its cells, and the arrow keys move
// nothing. As a table and as divs, in Chromium, Firefox and WebKit.

const KINDS = ["table", "div"] as const;

/** The console's errors and the page's uncaught ones: none is expected. */
let errors: string[] = [];

test.beforeEach(({ page }) => {
    errors = [];
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
});

test.afterEach(() => {
    expect(errors).toEqual([]);
});

async function open(page: Page, kind: string) {
    await page.goto(`/fixtures/bare-grid/?kind=${kind}`);
    await expect(page.locator('[data-grid-part="grid"]')).toBeVisible();
    await settle(page);
}

/** The rendered cells' column indexes in the first rendered row. */
function renderedColumns(page: Page) {
    return page
        .locator('[data-grid-part="row"]')
        .first()
        .locator('[data-grid-part="cell"]')
        .evaluateAll((cells) =>
            cells.map((element) =>
                Number(element.getAttribute("data-column-index")),
            ),
        );
}

for (const kind of KINDS) {
    test.describe(`the bare grid as ${kind}`, () => {
        test("renders a window of a million rows and a thousand columns, ARIA counting them all", async ({
            page,
        }) => {
            await open(page, kind);
            const grid = page.locator('[data-grid-part="grid"]');
            await expect(grid).toHaveAttribute("aria-rowcount", "1000001");
            await expect(grid).toHaveAttribute("aria-colcount", "1000");
            const rows = await renderedRows(page);
            expect(rows[0]).toBe(0);
            expect(rows.length).toBeGreaterThan(10);
            expect(rows.length).toBeLessThan(40);
            const columns = await renderedColumns(page);
            expect(columns.length).toBeGreaterThan(4);
            expect(columns.length).toBeLessThan(20);
            await expect(cell(page, 0, 0)).toHaveText("0:0");
        });

        test("scrolls both axes past the cap, scaled, to the last row and column", async ({
            page,
        }) => {
            await open(page, kind);
            const size = await viewport(page).evaluate((element) => ({
                height: element.scrollHeight,
                width: element.scrollWidth,
            }));
            // 24,000,000 px of rows and 100,000 px of columns, held in the cap
            expect(size.height).toBeLessThanOrEqual(80_000 + 400);
            expect(size.width).toBeLessThanOrEqual(80_000 + 600);
            await scrollTo(page, { top: "50%", left: "50%" });
            const middle = await renderedRows(page);
            expect(middle[0]).toBeGreaterThan(400_000);
            expect(middle[0]).toBeLessThan(600_000);
            await scrollTo(page, { top: "100%", left: "100%" });
            const rows = await renderedRows(page);
            expect(rows.at(-1)).toBe(999_999);
            expect(await renderedColumns(page)).toContain(999);
            await expect(cell(page, 999_999, 999)).toHaveText("999999:999");
            await expect(cell(page, 999_999, 999)).toBeInViewport();
        });

        test("is a table: role table, cells role cell, no tabindex on the grid nor its cells", async ({
            page,
        }) => {
            await open(page, kind);
            const grid = page.locator('[data-grid-part="grid"]');
            await expect(grid).toHaveAttribute("role", "table");
            await expect(grid).not.toHaveAttribute("tabindex");
            await expect(
                page.getByRole("columnheader", { name: "C0", exact: true }),
            ).toBeVisible();
            const cells = page.locator('[data-grid-part="cell"]');
            expect(await cells.count()).toBeGreaterThan(0);
            const roles = await cells.evaluateAll((elements) => [
                ...new Set(
                    elements.map((element) => element.getAttribute("role")),
                ),
            ]);
            expect(roles).toEqual(["cell"]);
            expect(
                await page
                    .locator(
                        '[data-grid-part="cell"][tabindex], [data-grid-part="header-cell"][tabindex]',
                    )
                    .count(),
            ).toBe(0);
        });

        test("moves nothing with the arrow keys: no cell is ever active", async ({
            page,
        }) => {
            await open(page, kind);
            await cell(page, 0, 0).click();
            for (const key of ["ArrowDown", "ArrowRight"]) {
                await page.keyboard.press(key);
            }
            await settle(page);
            expect(await page.locator("[data-active]").count()).toBe(0);
            expect(await page.locator('[tabindex="0"]').count()).toBe(0);
        });

        test("never sorts: no sort attribute, and a click or Enter on a header cell changes nothing", async ({
            page,
        }) => {
            await open(page, kind);
            const first = page.getByRole("columnheader", {
                name: "C0",
                exact: true,
            });
            await first.click();
            await page.keyboard.press("Enter");
            await settle(page);
            const sorted = await page
                .locator(
                    "[aria-sort], [data-sortable], [data-sort], [data-sort-priority]",
                )
                .count();
            expect(sorted).toBe(0);
            await expect(cell(page, 0, 0)).toHaveText("0:0");
        });
    });
}
