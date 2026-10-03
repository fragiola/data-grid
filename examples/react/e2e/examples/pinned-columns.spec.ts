import { expect, type Locator, type Page, test } from "@playwright/test";
import { openExample, THEMES } from "../helpers";
import { cell, scrollTo, settle, viewport } from "./helpers";

// Pinned columns (Epic #31, Epic #38): the Person group stays at the start while the months scroll
// under it, on every frame the browser paints, in every theme.

async function leftInView(page: Page, target: Locator) {
    const view = await viewport(page).boundingBox();
    const box = await target.boundingBox();
    if (!view || !box) throw new Error("no box");
    return box.x - view.x;
}

const header = (page: Page, name: string) =>
    page.getByRole("columnheader").filter({ hasText: name }).first();

test("keeps the pinned group in place while the months scroll", async ({
    page,
}) => {
    await openExample(page, "pinned-columns");
    // the frame's border may offset the content by a pixel or two
    const nameAtStart = await leftInView(page, cell(page, 0, 0));
    const teamAtStart = await leftInView(page, cell(page, 0, 1));
    for (const left of ["50%", "100%"] as const) {
        await scrollTo(page, { left });
        expect(await leftInView(page, cell(page, 0, 0))).toBeCloseTo(
            nameAtStart,
            0,
        );
        expect(await leftInView(page, cell(page, 0, 1))).toBeCloseTo(
            teamAtStart,
            0,
        );
        expect(await leftInView(page, header(page, "Person"))).toBeCloseTo(
            nameAtStart,
            0,
        );
    }
    await expect(cell(page, 0, 1)).toHaveAttribute("data-pinned-edge", "");
    await expect(header(page, "Person")).toHaveAttribute(
        "data-pinned",
        "start",
    );
});

test("has the pinned group in place before the scroll event runs, in every theme", async ({
    page,
}) => {
    for (const theme of THEMES) {
        await openExample(page, "pinned-columns", { theme: theme.name });
        const selectors = [
            '[data-grid-part="cell"][data-row-index="0"][data-column-index="0"]',
            '[data-grid-part="cell"][data-row-index="0"][data-column-index="1"]',
            '[data-grid-part="header-cell"][data-pinned][data-group]',
        ];
        const lefts = () =>
            viewport(page).evaluate(
                (element, targets) =>
                    targets.map(
                        (selector) =>
                            (element
                                .querySelector(selector)
                                ?.getBoundingClientRect().left ?? Number.NaN) -
                            element.getBoundingClientRect().left,
                    ),
                selectors,
            );
        const atStart = await lefts();
        for (const step of [37, 120, -80]) {
            // the scroll and the measure in one task: what a frame painted before the grid's
            // JavaScript shows
            const { fired, moved } = await viewport(page).evaluate(
                (element, [by, targets]) => {
                    let fired = false;
                    const onScroll = () => {
                        fired = true;
                    };
                    element.addEventListener("scroll", onScroll);
                    element.scrollLeft += by;
                    const view = element.getBoundingClientRect().left;
                    const moved = targets.map(
                        (selector) =>
                            (element
                                .querySelector(selector)
                                ?.getBoundingClientRect().left ?? Number.NaN) -
                            view,
                    );
                    element.removeEventListener("scroll", onScroll);
                    return { fired, moved };
                },
                [step, selectors] as const,
            );
            expect(fired, theme.name).toBe(false);
            for (const [index, value] of moved.entries()) {
                expect(value, `${theme.name} ${selectors[index]}`).toBeCloseTo(
                    atStart[index] ?? Number.NaN,
                    0,
                );
            }
            await settle(page);
        }
    }
});

test("brings a month into view right of the pinned columns from the keyboard", async ({
    page,
}) => {
    await openExample(page, "pinned-columns");
    await scrollTo(page, { left: "100%" });
    await cell(page, 2, 1).click();
    await page.keyboard.press("ArrowRight");
    const month = cell(page, 2, 2);
    await expect(month).toBeFocused();
    const team = await cell(page, 2, 1).boundingBox();
    const box = await month.boundingBox();
    if (!team || !box) throw new Error("no box");
    // right of the pinned Team column, not under it
    expect(box.x).toBeGreaterThanOrEqual(team.x + team.width - 1);
});
