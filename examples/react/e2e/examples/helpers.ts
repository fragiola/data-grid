import { expect, type Locator, type Page } from "@playwright/test";

/** Two frames: a scroll, the render it caused and the engine's commit are done. */
export async function settle(page: Page) {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                ),
            ),
    );
}

/** The grid's scroll container. */
export function viewport(page: Page): Locator {
    return page.locator('[data-grid-part="root"]').first();
}

/** A native scroll (the thumb dragged): a fraction of the scrollable range, or pixels. */
export async function scrollTo(
    page: Page,
    position: { top?: number | `${number}%`; left?: number | `${number}%` },
) {
    await viewport(page).evaluate((element, { top, left }) => {
        const at = (value: number | string | undefined, max: number) =>
            typeof value === "string"
                ? (Number.parseFloat(value) / 100) * max
                : value;
        const y = at(top, element.scrollHeight - element.clientHeight);
        const x = at(left, element.scrollWidth - element.clientWidth);
        if (y !== undefined) element.scrollTop = y;
        if (x !== undefined) element.scrollLeft = x;
    }, position);
    await settle(page);
}

export function cell(
    page: Page,
    rowIndex: number,
    columnIndex: number,
): Locator {
    return page.locator(
        `[data-grid-part="cell"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
    );
}

/** The indexes of the rendered body rows, in order. */
export async function renderedRows(page: Page): Promise<number[]> {
    return page
        .locator('[data-grid-part="row"]')
        .evaluateAll((rows) =>
            rows.map((row) => Number(row.getAttribute("data-row-index"))),
        );
}

/** The body's visible box: the viewport below the sticky header. */
export async function expectInView(page: Page, target: Locator) {
    const body = await viewport(page).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const header = element.querySelector('[data-grid-part="header"]');
        // inside the border: clientTop is the top border's width
        const top = rect.top + element.clientTop;
        return {
            top: top + (header?.getBoundingClientRect().height ?? 0),
            bottom: top + element.clientHeight,
        };
    });
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.y ?? 0).toBeGreaterThanOrEqual(body.top - 0.5);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        body.bottom + 0.5,
    );
}
