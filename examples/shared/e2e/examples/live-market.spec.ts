import { expect, type Page, test } from "@playwright/test";
import { openExample, part } from "../helpers";
import { boxOf, header, rows, scrollTo, settle } from "./helpers";

// A market that ticks on every frame: the rows on screen show the moves (the app tells the grid
// which rows changed), a moved price flashes, Pause stops it, a click on a header sorts it (the
// app orders the rows), the ticker stays pinned and the summary row adds the portfolio up.

/** the columns, by index: the ticker (pinned), the price and the change since the open */
const TICKER = 0;
const PRICE = 3;
const CHANGE = 4;

/** The rendered rows' text in a column, in order. */
const column = (page: Page, columnIndex: number) =>
    rows(page)
        .locator(`[data-column-index="${columnIndex}"]`)
        .allTextContents();

/** A signed percentage as a number ("−2.20%", "+0.46%", "0.00%"). */
const percent = (text: string) =>
    Number.parseFloat(text.replace(/[^\d.+-]/g, "").replace("−", "-"));

const pause = (page: Page) =>
    page.getByRole("button", { name: "Pause" }).click();

test("the prices on screen move while it plays, and stand still once paused", async ({
    page,
}) => {
    await openExample(page, "live-market");
    const before = await column(page, PRICE);
    await expect
        .poll(async () => (await column(page, PRICE)).join(" "))
        .not.toBe(before.join(" "));
    await expect(page.getByTestId("updates")).not.toHaveText("0");

    await pause(page);
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    await settle(page);
    const paused = await column(page, PRICE);
    await page.waitForTimeout(500);
    expect(await column(page, PRICE)).toEqual(paused);
});

test("a price that moves flashes up or down", async ({ page }) => {
    await openExample(page, "live-market");
    await expect(
        rows(page).locator('[data-flash="up"], [data-flash="down"]').first(),
    ).toBeAttached();
});

test("a click on Change sorts the rows by it, both ways", async ({ page }) => {
    await openExample(page, "live-market");
    await pause(page);
    await header(page, "Change").click();
    await expect(header(page, "Change")).toHaveAttribute(
        "aria-sort",
        "ascending",
    );
    await expect
        .poll(async () => {
            const changes = (await column(page, CHANGE)).map(percent);
            return changes.every(
                (value, index) =>
                    index === 0 || value >= (changes[index - 1] ?? 0),
            );
        })
        .toBe(true);
    await header(page, "Change").click();
    await expect(header(page, "Change")).toHaveAttribute(
        "aria-sort",
        "descending",
    );
    await expect
        .poll(async () => {
            const changes = (await column(page, CHANGE)).map(percent);
            return changes.every(
                (value, index) =>
                    index === 0 || value <= (changes[index - 1] ?? 0),
            );
        })
        .toBe(true);
});

test("the ticker stays at the start while the other columns scroll", async ({
    page,
}) => {
    await openExample(page, "live-market");
    const ticker = rows(page)
        .first()
        .locator(`[data-column-index="${TICKER}"]`);
    const before = await boxOf(ticker);
    await scrollTo(page, { left: 400 });
    const after = await boxOf(ticker);
    expect(Math.abs(after.x - before.x)).toBeLessThan(1);
    await expect(ticker).toHaveAttribute("data-pinned", "start");
});

test("the summary row adds the portfolio up", async ({ page }) => {
    await openExample(page, "live-market");
    const summary = part(page, "summary-row");
    await expect(summary).toHaveCount(1);
    await expect(summary).toContainText("Portfolio · 1,000 instruments");
    // the value column's total: a figure in the thousands at least
    await expect(summary).toContainText(/\d{1,3}(,\d{3})+\.\d{2}/);
});
