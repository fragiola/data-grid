import { expect, type Locator, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, rows, scrollTo } from "./helpers";

// React Data Grid's Animation example: a new row height, and the rows ease into it (a CSS
// transition on the top and the height the grid gives each row, only while the change is in
// flight: a scroll never animates).

const height = (locator: Locator) =>
    locator.evaluate((element) => element.getBoundingClientRect().height);

/** The rows' running animations (a row's transition is one). */
const animations = (page: Page) =>
    page.evaluate(
        () =>
            document
                .getAnimations()
                .filter(
                    (animation) =>
                        animation.effect instanceof KeyframeEffect &&
                        animation.effect.target?.matches(
                            '[data-grid-part="row"]',
                        ),
                ).length,
    );

/**
 * Each rendered row's place, read right away: its top less the one before it (by index), which is
 * the row height when every row is where the grid put it.
 */
const steps = (page: Page) =>
    rows(page).evaluateAll((elements) =>
        elements
            .map((row) => ({
                index: Number(row.getAttribute("data-row-index")),
                top: row.getBoundingClientRect().top,
            }))
            .sort((a, b) => a.index - b.index)
            .flatMap((row, i, all) => {
                const before = all[i - 1];
                return before ? [row.top - before.top] : [];
            }),
    );

test("the rows grow to the height chosen, through a transition", async ({
    page,
}) => {
    await openExample(page, "animated-row-heights");
    const second = rows(page).nth(1);
    expect(await height(second)).toBeCloseTo(32, 0);
    const large = page.getByRole("button", { name: "Large" });
    await large.click();
    await expect(large).toHaveAttribute("aria-pressed", "true");
    // eased there: running at first, then over, every row at its new height and place
    expect(await animations(page)).toBeGreaterThan(0);
    await expect.poll(() => animations(page)).toBe(0);
    expect(await height(second)).toBeCloseTo(76, 0);
    for (const step of await steps(page)) expect(step).toBeCloseTo(76, 0);
    // the project, clipped at the small height, now fits inside its cell
    const project = cell(page, 1, 1).getByText("Project", { exact: false });
    const inside = await project.evaluate((span) => {
        const box = span.getBoundingClientRect();
        const cell = span.closest('[data-grid-part="cell"]');
        const bounds = cell?.getBoundingClientRect();
        return Boolean(
            bounds && box.top >= bounds.top && box.bottom <= bounds.bottom,
        );
    });
    expect(inside).toBe(true);
});

test("a scroll that renders other rows never animates them", async ({
    page,
}) => {
    await openExample(page, "animated-row-heights");
    // far past the rendered window, then a little more: new rows each time
    for (const top of [4_000, 4_200, 9_000]) {
        await scrollTo(page, { top });
        expect(await animations(page)).toBe(0);
        for (const step of await steps(page)) expect(step).toBeCloseTo(32, 0);
    }
});

test("with reduced motion, the rows take the new height at once", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openExample(page, "animated-row-heights");
    await page.getByRole("button", { name: "Medium" }).click();
    expect(await animations(page)).toBe(0);
    expect(await height(rows(page).first())).toBeCloseTo(52, 0);
});
