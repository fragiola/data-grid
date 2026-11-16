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

/**
 * Tab, with a button after the page's content to take the focus leaving: past a page's last
 * focusable element Chromium and WebKit hand focus to the browser, Firefox keeps it where it is.
 */
export async function pressTabOut(page: Page) {
    await page.evaluate(() => {
        if (document.querySelector("[data-tab-out]")) return;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "After the example";
        button.setAttribute("data-tab-out", "");
        document.body.append(button);
    });
    await page.keyboard.press("Tab");
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

/** A header cell by its text: a column's name, or a group's. */
export function header(page: Page, name: string): Locator {
    return page.getByRole("columnheader").filter({ hasText: name });
}

/** The rendered body rows (the header rows are `header-row` parts). */
export function rows(page: Page): Locator {
    return page.locator('[data-grid-part="row"]');
}

/** A column's rendered body values, in order. */
export function values(page: Page, columnIndex: number): Promise<string[]> {
    return page
        .locator(`[data-grid-part="cell"][data-column-index="${columnIndex}"]`)
        .allTextContents();
}

/** The indexes of the rendered body rows, in order. */
export async function renderedRows(page: Page): Promise<number[]> {
    return rows(page).evaluateAll((elements) =>
        elements.map((row) => Number(row.getAttribute("data-row-index"))),
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

/** An element's box on the page; it must be rendered. */
export async function boxOf(target: Locator) {
    const box = await target.boundingBox();
    if (!box) throw new Error("no box: the element is not rendered");
    return box;
}

/**
 * Presses the primary button on an element's centre (a column resizer, a header cell), or `at`
 * pixels from its left, moves the pointer by `dx` and, unless told to hold it, releases it.
 */
export async function dragBy(
    page: Page,
    target: Locator,
    dx: number,
    { hold = false, at }: { hold?: boolean; at?: number } = {},
) {
    const box = await boxOf(target);
    const x = box.x + (at ?? box.width / 2);
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y, { steps: 5 });
    await settle(page);
    if (!hold) {
        await page.mouse.up();
        await settle(page);
    }
}

/**
 * A drag by touch (Epic #89), as a browser hands it to the page: a touch's pointer events
 * (`pointerType` "touch"), pressed at `target`'s centre, moved by `dx`/`dy` one step a frame and
 * released there, each one at the pressed element (a touch's pointer is held by what it pressed).
 * Playwright drives a touchscreen only to tap: these are the page's own events, what a page reads
 * of a finger on an element with `touch-action: none`. Returns whether any of them was prevented.
 */
export async function touchDrag(
    page: Page,
    target: Locator,
    { dx = 0, dy = 0, steps = 6 }: { dx?: number; dy?: number; steps?: number },
): Promise<boolean> {
    const box = await boxOf(target);
    const prevented = await page.evaluate(
        async ({ x, y, dx, dy, steps }) => {
            const pressed = document.elementFromPoint(x, y);
            if (!pressed) throw new Error("nothing at the touch");
            let prevented = false;
            const send = (type: string, step: number) => {
                const event = new PointerEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    pointerId: 11,
                    pointerType: "touch",
                    isPrimary: true,
                    button: type === "pointermove" ? -1 : 0,
                    buttons: type === "pointerup" ? 0 : 1,
                    clientX: x + (dx * step) / steps,
                    clientY: y + (dy * step) / steps,
                    width: 20,
                    height: 20,
                });
                pressed.dispatchEvent(event);
                prevented ||= event.defaultPrevented;
            };
            const frame = () =>
                new Promise((resolve) => requestAnimationFrame(resolve));
            send("pointerdown", 0);
            for (let step = 1; step <= steps; step++) {
                await frame();
                send("pointermove", step);
            }
            await frame();
            send("pointerup", steps);
            return prevented;
        },
        {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
            dx,
            dy,
            steps,
        },
    );
    await settle(page);
    return prevented;
}

/**
 * The width a column's content takes (Epic #80, A3), worked out apart from the grid's own
 * measure: for each rendered cell of the column (its header cell, not a group's, and its loaded
 * body cells), its text set on one line in a box of its own inside it (inheriting its font,
 * spacing and transform), plus the cell's padding and border; the widest, rounded up.
 * Plain-text cells only: a cell holding an element other than a column resizer (out of the flow)
 * throws, its content's width being the element's.
 */
export function contentWidth(page: Page, columnIndex: number): Promise<number> {
    return page
        .locator(
            [
                `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]:not([data-group])`,
                `[data-grid-part="cell"][data-column-index="${columnIndex}"]:not([data-loading])`,
            ].join(", "),
        )
        .evaluateAll((cells) => {
            let widest = 0;
            for (const cell of cells) {
                const elements = [...cell.children].filter(
                    (child) => !child.hasAttribute("data-grid-column-resizer"),
                );
                if (elements.length > 0) {
                    throw new Error(
                        `contentWidth measures plain-text cells: this one holds <${elements[0]?.localName}>`,
                    );
                }
                const text = cell.ownerDocument.createElement("span");
                text.textContent = cell.textContent;
                text.style.position = "absolute";
                text.style.whiteSpace = "pre";
                cell.append(text);
                const style = getComputedStyle(cell);
                const width =
                    text.getBoundingClientRect().width +
                    Number.parseFloat(style.paddingLeft) +
                    Number.parseFloat(style.paddingRight) +
                    Number.parseFloat(style.borderLeftWidth) +
                    Number.parseFloat(style.borderRightWidth);
                text.remove();
                widest = Math.max(widest, width);
            }
            return Math.ceil(widest);
        });
}
