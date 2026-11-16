import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, header, renderedRows, settle, viewport } from "./helpers";

// Auto row heights (Epic #86, E2.2): a hundred thousand rows as tall as their notes, measured as
// they render; the view stays on what it shows while the rows above it are measured, and after a
// sort the rows are laid out end to end again.

/** The rendered rows' tops from the viewport's top and their heights, by index. */
function rowBoxes(page: Page) {
    return viewport(page).evaluate((element) => {
        const view = element.getBoundingClientRect();
        return [
            ...element.querySelectorAll<HTMLElement>('[data-grid-part="row"]'),
        ]
            .map((row) => {
                const box = row.getBoundingClientRect();
                return {
                    index: Number(row.getAttribute("data-row-index")),
                    top: box.top - view.top,
                    height: box.height,
                };
            })
            .sort((a, b) => a.index - b.index);
    });
}

async function expectEndToEnd(page: Page) {
    const boxes = await rowBoxes(page);
    for (const [at, box] of boxes.entries()) {
        const next = boxes[at + 1];
        if (next?.index === box.index + 1) {
            expect(Math.abs(box.top + box.height - next.top)).toBeLessThan(1);
        }
    }
    return boxes;
}

test("lays rows of many heights end to end, each as tall as its notes", async ({
    page,
}) => {
    await openExample(page, "auto-row-heights");
    const boxes = await expectEndToEnd(page);
    const heights = new Set(boxes.map((box) => Math.round(box.height)));
    expect(heights.size).toBeGreaterThan(2);
    // a row's cells share its height (its line below them, 1px, is the row's)
    for (const box of boxes.slice(0, 5)) {
        const notes = await cell(page, box.index, 2).boundingBox();
        const name = await cell(page, box.index, 0).boundingBox();
        expect(notes?.height).toBeCloseTo(name?.height ?? 0, 1);
        expect(box.height - (notes?.height ?? 0)).toBeGreaterThanOrEqual(0);
        expect(box.height - (notes?.height ?? 0)).toBeLessThan(2.5);
    }
});

test("keeps what it shows in place while the rows above are measured", async ({
    page,
}) => {
    await openExample(page, "auto-row-heights");
    await viewport(page).evaluate((element) => {
        element.scrollTop = element.scrollHeight / 2;
    });
    await settle(page);
    for (const delta of [-240, -240, -120]) {
        const boxes = await rowBoxes(page);
        const seen = boxes.find((box) => box.top > 150 && box.top < 300);
        if (!seen) throw new Error("no row in view");
        await viewport(page).evaluate((element, by) => {
            element.scrollTop += by;
        }, delta);
        await settle(page);
        const after = (await rowBoxes(page)).find(
            (box) => box.index === seen.index,
        );
        expect(Math.abs((after?.top ?? 0) - (seen.top - delta))).toBeLessThan(
            1,
        );
        await expectEndToEnd(page);
    }
});

test("moves the keys onto rows of their measured heights, and lays them out again after a sort", async ({
    page,
}) => {
    await openExample(page, "auto-row-heights");
    await cell(page, 0, 1).click();
    for (let step = 1; step <= 12; step++) {
        await page.keyboard.press("ArrowDown");
        await settle(page);
        await expect(cell(page, step, 1)).toBeFocused();
    }
    const box = await cell(page, 12, 1).boundingBox();
    const view = await viewport(page).boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        (view?.y ?? 0) + (view?.height ?? 0) + 1,
    );
    await header(page, "Name").click();
    await settle(page);
    await expectEndToEnd(page);
    expect((await renderedRows(page)).length).toBeGreaterThan(3);
});
