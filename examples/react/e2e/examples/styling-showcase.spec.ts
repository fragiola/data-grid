import { expect, type Page, test } from "@playwright/test";
import { openExample, THEMES } from "../helpers";
import { cell, settle } from "./helpers";

// The showcase restyles the same markup: checked on computed styles (verify by compiling, never by
// reading class names). Columns: 0 #, 1 Project, 2 Owner, 3 Status, 4 Health (heatmap).

const PRESETS = ["Spreadsheet", "Cards", "Neon"] as const;

/** The paint of an element, its ::before (Cards draws the card there) included. */
function paint(page: Page, selector: string) {
    return page
        .locator(selector)
        .first()
        .evaluate((element) => {
            const own = getComputedStyle(element);
            const before = getComputedStyle(element, "::before");
            return [
                own.backgroundColor,
                own.boxShadow,
                own.outlineStyle,
                own.outlineColor,
                before.backgroundColor,
                before.boxShadow,
            ].join(" | ");
        });
}

/** The first rendered row whose status cell reads `status`. */
async function rowWith(page: Page, status: string) {
    const index = await page
        .locator('[data-grid-part="row"]')
        .evaluateAll(
            (rows, wanted) =>
                rows
                    .find(
                        (row) =>
                            row.querySelector('[data-column-index="3"]')
                                ?.textContent === wanted,
                    )
                    ?.getAttribute("data-row-index"),
            status,
        );
    if (index == null) throw new Error(`no ${status} row in view`);
    return `[data-grid-part="row"][data-row-index="${index}"]`;
}

/** A rendered heatmap cell whose score is at least (or below) `limit`. */
async function heatCell(page: Page, high: boolean) {
    const index = await page
        .locator('[data-grid-part="cell"][data-column-index="4"]')
        .evaluateAll(
            (cells, high) =>
                cells
                    .find((cell) => {
                        const score = Number(cell.textContent);
                        return high ? score >= 80 : score < 20;
                    })
                    ?.getAttribute("data-row-index"),
            high,
        );
    if (index == null) throw new Error("no such heatmap cell in view");
    return `[data-grid-part="cell"][data-row-index="${index}"][data-column-index="4"]`;
}

async function signature(page: Page) {
    return {
        idColumn: await paint(
            page,
            '[data-grid-part="cell"][data-column-index="0"]',
        ),
        blocked: await paint(page, await rowWith(page, "Blocked")),
        onTrack: await paint(page, await rowWith(page, "On track")),
        heatHigh: await paint(page, await heatCell(page, true)),
        heatLow: await paint(page, await heatCell(page, false)),
        active: await paint(page, '[data-grid-part="cell"][data-active]'),
    };
}

test("each preset restyles columns, rows, cells and the active cell", async ({
    page,
}) => {
    await openExample(page, "styling-showcase");
    const seen: Awaited<ReturnType<typeof signature>>[] = [];
    for (const preset of PRESETS) {
        await page.getByRole("button", { name: preset, exact: true }).click();
        await expect(
            page.getByRole("button", { name: preset, exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await settle(page);
        const styles = await signature(page);
        // inside a preset: a blocked row looks unlike an on-track one, a hot cell unlike a cold one
        expect(styles.blocked, preset).not.toBe(styles.onTrack);
        expect(styles.heatHigh, preset).not.toBe(styles.heatLow);
        seen.push(styles);
    }
    // across presets: every part looks different
    for (const part of ["idColumn", "blocked", "heatHigh", "active"] as const) {
        expect(new Set(seen.map((styles) => styles[part])).size, part).toBe(
            PRESETS.length,
        );
    }
});

test("the same markup: switching a preset keeps the rows and the active cell", async ({
    page,
}) => {
    await openExample(page, "styling-showcase");
    await cell(page, 2, 2).click();
    const before = await page
        .locator('[data-grid-part="row"]')
        .evaluateAll((rows) =>
            rows.map((row) => row.getAttribute("data-row-index")),
        );
    await page.getByRole("button", { name: "Neon", exact: true }).click();
    await expect(cell(page, 2, 2)).toHaveAttribute("data-active", "");
    const after = await page
        .locator('[data-grid-part="row"]')
        .evaluateAll((rows) =>
            rows.map((row) => row.getAttribute("data-row-index")),
        );
    expect(after.slice(0, 5)).toEqual(before.slice(0, 5));
});

test("every preset renders in every theme", async ({ page }) => {
    for (const theme of THEMES) {
        await openExample(page, "styling-showcase", { theme: theme.name });
        for (const preset of PRESETS) {
            await page
                .getByRole("button", { name: preset, exact: true })
                .click();
            await expect(
                page.locator('[data-grid-part="cell"]').first(),
            ).toBeVisible();
        }
    }
});
