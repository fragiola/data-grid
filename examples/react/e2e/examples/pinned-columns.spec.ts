import { expect, type Locator, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, scrollTo, viewport } from "./helpers";

// Pinned columns (Epic #31): the Person group stays at the start while the months scroll under it.

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
