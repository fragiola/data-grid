import { expect, type Locator, type Page, test } from "@playwright/test";

// One spec, two structures (D5): every test runs against the same unstyled grid rendered as real
// table elements (fixtures/table-grid) and as divs (fixtures/div-grid), in Chromium and Firefox.

const KINDS = ["table", "div"] as const;
const OVERSCAN = { rows: 4, columns: 2 };

async function open(
    page: Page,
    kind: string,
    query: Record<string, string | number>,
) {
    const params = new URLSearchParams(
        Object.entries(query).map(([key, value]) => [key, String(value)]),
    );
    await page.goto(`/fixtures/${kind}-grid/?${params}`);
    await expect(page.locator('[data-grid-part="grid"]')).toBeVisible();
    await settle(page);
    return page.getByTestId("viewport");
}

/** Two frames: the scroll event, the render it caused and the engine's commit are done. */
async function settle(page: Page) {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                ),
            ),
    );
}

/** A native scroll (the thumb dragged): the engine did not cause it. */
async function scroll(
    page: Page,
    viewport: Locator,
    top: number | "end",
    left?: number | "end",
) {
    await viewport.evaluate(
        (element, [y, x]) => {
            if (y !== null) {
                element.scrollTop = y === "end" ? element.scrollHeight : y;
            }
            if (x !== null && x !== undefined) {
                element.scrollLeft = x === "end" ? element.scrollWidth : x;
            }
        },
        [top, left ?? null] as const,
    );
    await settle(page);
}

function cell(page: Page, rowIndex: number, columnIndex: number) {
    return page.locator(
        `[data-grid-part="cell"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
    );
}

function windows(page: Page) {
    return page.evaluate(() => {
        const engine = window.grid?.engine;
        if (!engine) throw new Error("no grid");
        return {
            rows: engine.get("row-window"),
            columns: engine.get("column-window"),
        };
    });
}

/** The body's visible area: the viewport below the sticky header. */
async function bodyBox(viewport: Locator) {
    const box = await viewport.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const header = element.querySelector('[data-grid-part="header"]');
        const headerHeight = header?.getBoundingClientRect().height ?? 0;
        return {
            top: rect.top + headerHeight,
            left: rect.left,
            bottom: rect.top + element.clientHeight,
            right: rect.left + element.clientWidth,
        };
    });
    return box;
}

async function expectFullyInBody(viewport: Locator, target: Locator) {
    const body = await bodyBox(viewport);
    const box = await target.boundingBox();
    if (!box) throw new Error("no box");
    expect(box.y).toBeGreaterThanOrEqual(body.top - 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(body.bottom + 0.5);
    expect(box.x).toBeGreaterThanOrEqual(body.left - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(body.right + 0.5);
}

async function active(page: Page) {
    return page.evaluate(() => window.grid?.model.get("active-position"));
}

async function focused(page: Page) {
    return page.evaluate(() => {
        const element = document.activeElement;
        return element
            ? {
                  row: element.getAttribute("data-row-index"),
                  column: element.getAttribute("data-column-index"),
                  testId: element.getAttribute("data-testid"),
              }
            : null;
    });
}

for (const kind of KINDS) {
    test.describe(`${kind} grid`, () => {
        test("renders a bounded number of cells at the top, the middle and the end", async ({
            page,
        }) => {
            const viewport = await open(page, kind, {
                rows: 1_000_000,
                columns: 1_000,
            });
            for (const at of [0, 0.5, "end"] as const) {
                if (at !== 0) {
                    await scroll(
                        page,
                        viewport,
                        at === "end" ? "end" : 16_000_000,
                        at === "end" ? "end" : 50_000,
                    );
                }
                const { rows, columns } = await windows(page);
                const visibleRows = rows.visible.end - rows.visible.start;
                const visibleColumns =
                    columns.visible.end - columns.visible.start;
                const bound =
                    (visibleRows + 2 * OVERSCAN.rows) *
                    (visibleColumns + 2 * OVERSCAN.columns);
                const count = await page
                    .locator('[data-grid-part="cell"]')
                    .count();
                expect(count, `at ${at}`).toBeGreaterThan(0);
                expect(count, `at ${at}`).toBeLessThanOrEqual(bound);
                const headers = await page
                    .locator('[data-grid-part="header-cell"]')
                    .count();
                expect(headers).toBeLessThanOrEqual(
                    visibleColumns + 2 * OVERSCAN.columns,
                );
            }
            // the end is the dataset's end
            await expect(cell(page, 999_999, 999)).toBeVisible();
        });

        test("keeps the header over its columns while scrolling sideways", async ({
            page,
        }) => {
            const viewport = await open(page, kind, {
                rows: 1_000,
                columns: 1_000,
            });
            await scroll(page, viewport, 3_000, 12_345);
            const { columns } = await windows(page);
            const columnIndex = columns.visible.start + 2;
            const header = page.locator(
                `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]`,
            );
            const body = page
                .locator(
                    `[data-grid-part="cell"][data-column-index="${columnIndex}"]`,
                )
                .first();
            const [h, b] = [
                await header.boundingBox(),
                await body.boundingBox(),
            ];
            expect(Math.abs((h?.x ?? 0) - (b?.x ?? 1))).toBeLessThan(1);
            expect(Math.abs((h?.width ?? 0) - (b?.width ?? 1))).toBeLessThan(1);
            // and the header stays at the viewport's top
            const top = (await viewport.boundingBox())?.y ?? 0;
            expect(
                Math.abs(((await header.boundingBox())?.y ?? 0) - top),
            ).toBeLessThan(1);
        });

        test("reaches the last of 100,000,000 rows by the scrollbar, and by Ctrl+End", async ({
            page,
        }) => {
            const viewport = await open(page, kind, {
                rows: 100_000_000,
                columns: 20,
            });
            const grid = page.locator('[data-grid-part="grid"]');
            // the sizer is capped, the dataset is not
            expect(
                Number.parseFloat(
                    (await grid.getAttribute("style"))?.match(
                        /height: ([\d.]+)px/,
                    )?.[1] ?? "0",
                ),
            ).toBeLessThan(11_000_000);
            await scroll(page, viewport, "end");
            const last = cell(page, 99_999_999, 0);
            await expect(last).toBeVisible();
            await expectFullyInBody(viewport, last);

            await scroll(page, viewport, 0);
            await cell(page, 2, 3).click();
            await page.keyboard.press("ControlOrMeta+End");
            await settle(page);
            expect(await active(page)).toEqual({
                rowIndex: 99_999_999,
                columnIndex: 19,
            });
            const end = cell(page, 99_999_999, 19);
            await expect(end).toBeFocused();
            await expectFullyInBody(viewport, end);
        });

        test("moves exactly one row per ArrowDown anywhere in 100,000,000 rows", async ({
            page,
        }) => {
            const viewport = await open(page, kind, {
                rows: 100_000_000,
                columns: 20,
            });
            for (const top of [3_333_333, 7_777_777]) {
                await scroll(page, viewport, top);
                const { rows } = await windows(page);
                const start = rows.visible.start + 2;
                await cell(page, start, 1).click();
                for (let step = 1; step <= 30; step++) {
                    await page.keyboard.press("ArrowDown");
                    await settle(page);
                    expect(await active(page)).toEqual({
                        rowIndex: start + step,
                        columnIndex: 1,
                    });
                    const target = cell(page, start + step, 1);
                    await expect(target).toBeFocused();
                    await expectFullyInBody(viewport, target);
                }
                // and the row above it touches it: positions are exact under scaling
                const above = await cell(page, start + 29, 1).boundingBox();
                const below = await cell(page, start + 30, 1).boundingBox();
                expect(
                    Math.abs(
                        (above?.y ?? 0) +
                            (above?.height ?? 0) -
                            (below?.y ?? 1),
                    ),
                ).toBeLessThan(1);
            }
        });

        test("scales the columns too: the last of 1,000,000 columns, and one column per ArrowRight", async ({
            page,
        }) => {
            const viewport = await open(page, kind, {
                rows: 100,
                columns: 1_000_000,
            });
            await scroll(page, viewport, 0, "end");
            const last = cell(page, 0, 999_999);
            await expect(last).toBeVisible();
            await expectFullyInBody(viewport, last);

            await scroll(page, viewport, 0, 5_000_000);
            const { columns } = await windows(page);
            const start = columns.visible.start + 1;
            await cell(page, 3, start).click();
            for (let step = 1; step <= 12; step++) {
                await page.keyboard.press("ArrowRight");
                await settle(page);
                expect(await active(page)).toEqual({
                    rowIndex: 3,
                    columnIndex: start + step,
                });
                await expectFullyInBody(viewport, cell(page, 3, start + step));
            }
        });

        test("has one tab stop, moves focus with the arrows, and lets Tab leave", async ({
            page,
        }) => {
            const viewport = await open(page, kind, {
                rows: 1_000,
                columns: 20,
            });
            await page.getByTestId("before").focus();
            await page.keyboard.press("Tab");
            await settle(page);
            // the grid takes focus and hands it to the first cell in view
            expect(await focused(page)).toMatchObject({
                row: "0",
                column: "0",
            });
            expect(
                await page
                    .locator('[data-grid-part="cell"][tabindex="0"]')
                    .count(),
            ).toBe(1);
            await page.keyboard.press("ArrowRight");
            await page.keyboard.press("ArrowDown");
            await settle(page);
            expect(await focused(page)).toMatchObject({
                row: "1",
                column: "1",
            });
            await page.keyboard.press("Tab");
            expect(await focused(page)).toMatchObject({ testId: "after" });
            await page.keyboard.press("Shift+Tab");
            expect(await focused(page)).toMatchObject({
                row: "1",
                column: "1",
            });

            // scrolled far away, the active cell stays rendered and focused
            await scroll(page, viewport, 20_000);
            expect(await focused(page)).toMatchObject({
                row: "1",
                column: "1",
            });
            await scroll(page, viewport, 0);
            expect(await focused(page)).toMatchObject({
                row: "1",
                column: "1",
            });
            // and the keys move on from it, scrolling it back into view
            await scroll(page, viewport, 20_000);
            await page.keyboard.press("ArrowDown");
            await settle(page);
            await expectFullyInBody(viewport, cell(page, 2, 1));
        });

        test("reports totals in ARIA, and 1-based indexes at any position", async ({
            page,
        }) => {
            const viewport = await open(page, kind, {
                rows: 1_000_000,
                columns: 300,
            });
            const grid = page.locator('[data-grid-part="grid"]');
            await expect(grid).toHaveAttribute("role", "grid");
            await expect(grid).toHaveAttribute("aria-rowcount", "1000001");
            await expect(grid).toHaveAttribute("aria-colcount", "300");
            await scroll(page, viewport, 12_000_000, 15_000);
            const { rows, columns } = await windows(page);
            const row = page.locator(
                `[data-grid-part="row"][data-row-index="${rows.visible.start}"]`,
            );
            await expect(row).toHaveAttribute(
                "aria-rowindex",
                String(rows.visible.start + 2),
            );
            await expect(
                row.locator(`[data-column-index="${columns.visible.start}"]`),
            ).toHaveAttribute(
                "aria-colindex",
                String(columns.visible.start + 1),
            );
            await expect(
                page.locator('[data-grid-part="header-row"]'),
            ).toHaveAttribute("aria-rowindex", "1");
        });

        test("does not render React while scrolling inside the overscan", async ({
            page,
        }) => {
            const viewport = await open(page, kind, {
                rows: 100_000,
                columns: 20,
            });
            // 3.2M px: no scroll scaling, so a native scroll moves the content 1:1
            await scroll(page, viewport, 32 * 1_000);
            const before = await page.evaluate(() => window.commits);
            // two rows down: inside the four rows of overscan
            await scroll(page, viewport, 32 * 1_002);
            expect(await page.evaluate(() => window.commits)).toBe(before);
            // twenty rows down: a new window renders
            await scroll(page, viewport, 32 * 1_020);
            expect(await page.evaluate(() => window.commits)).toBeGreaterThan(
                before,
            );
        });

        test("places variable-height rows exactly under scaling", async ({
            page,
        }) => {
            const viewport = await open(page, kind, {
                rows: 2_000_000,
                columns: 5,
                variable: 1,
            });
            expect(
                await page.evaluate(
                    () => window.grid?.engine.get("scroll-scaled").rows,
                ),
            ).toBe(true);
            await scroll(page, viewport, 6_543_210);
            const { rows } = await windows(page);
            for (
                let index = rows.visible.start;
                index < rows.visible.end - 1;
                index++
            ) {
                const a = await cell(page, index, 0).boundingBox();
                const b = await cell(page, index + 1, 0).boundingBox();
                expect(
                    Math.abs((a?.y ?? 0) + (a?.height ?? 0) - (b?.y ?? 1)),
                ).toBeLessThan(1);
                expect(a?.height).toBe(24 + ((index * 7) % 25));
            }
        });

        test("shows the empty state below the header, in view while scrolling sideways", async ({
            page,
        }) => {
            const viewport = await open(page, kind, { rows: 0, columns: 30 });
            const empty = page.locator('[data-grid-part="empty"]');
            await expect(empty).toBeVisible();
            await expect(empty).toContainText("No rows");
            for (const part of ["root", "grid"]) {
                await expect(
                    page.locator(`[data-grid-part="${part}"]`),
                ).toHaveAttribute("data-empty", "");
            }
            await expect(page.locator('[data-grid-part="row"]')).toHaveCount(0);
            /** the empty state's box, and its text's centre, relative to the visible area */
            const measure = () =>
                viewport.evaluate((element) => {
                    const port = element.getBoundingClientRect();
                    const inner = {
                        x: port.x + element.clientLeft,
                        y: port.y + element.clientTop,
                        width: element.clientWidth,
                        height: element.clientHeight,
                    };
                    const header = element
                        .querySelector('[data-grid-part="header"]')
                        ?.getBoundingClientRect();
                    const box = element
                        .querySelector('[data-grid-part="empty"]')
                        ?.getBoundingClientRect();
                    // the glyphs themselves: the text node, not an element around it
                    const walker = document.createTreeWalker(
                        element.querySelector('[data-grid-part="empty"]') ??
                            element,
                        NodeFilter.SHOW_TEXT,
                    );
                    let text: Node | null = walker.nextNode();
                    while (text && text.textContent?.trim() !== "No rows") {
                        text = walker.nextNode();
                    }
                    const range = document.createRange();
                    range.selectNodeContents(text ?? element);
                    const glyphs = range.getBoundingClientRect();
                    return {
                        top: (box?.y ?? 0) - (header?.bottom ?? 0),
                        left: (box?.x ?? 0) - inner.x,
                        right: inner.x + inner.width - (box?.right ?? 0),
                        bottom: inner.y + inner.height - (box?.bottom ?? 0),
                        textX:
                            glyphs.x +
                            glyphs.width / 2 -
                            (inner.x + inner.width / 2),
                        textY:
                            glyphs.y +
                            glyphs.height / 2 -
                            ((header?.bottom ?? 0) + (box?.bottom ?? 0)) / 2,
                    };
                });
            const check = async (when: string) => {
                const at = await measure();
                // it fills the visible body exactly, its content centred by the app's style
                for (const [edge, value] of Object.entries(at)) {
                    expect(Math.abs(value), `${when}: ${edge}`).toBeLessThan(
                        1.5,
                    );
                }
            };
            await check("at the start");
            await scroll(page, viewport, 0, 1_000);
            expect(
                await viewport.evaluate((element) => element.scrollLeft),
            ).toBeGreaterThan(0);
            await check("scrolled sideways");
        });

        test.describe("with column groups", () => {
            const GROUPS = { rows: 1_000, columns: 60, groups: 1 };

            test("aligns group cells over their columns while scrolling sideways, a cut group included", async ({
                page,
            }) => {
                const viewport = await open(page, kind, GROUPS);
                let cut = 0;
                for (const left of [0, 250, 1_730, 3_333, "end"] as const) {
                    if (left !== 0) await scroll(page, viewport, 0, left);
                    const groups = await page.evaluate(() => {
                        const box = (element: Element) =>
                            element.getBoundingClientRect();
                        const row = document.querySelector(
                            '[data-grid-part="row"]',
                        );
                        const bodyCell = (columnIndex: number) =>
                            row?.querySelector(
                                `[data-column-index="${columnIndex}"]`,
                            );
                        return [
                            ...document.querySelectorAll(
                                '[data-grid-part="header-cell"][data-group]',
                            ),
                        ].map((group) => {
                            const start = Number(
                                group.getAttribute("data-column-index"),
                            );
                            const span = Number(
                                group.getAttribute("aria-colspan"),
                            );
                            const first = bodyCell(start);
                            const last = bodyCell(start + span - 1);
                            const leaf = document.querySelector(
                                `[data-grid-part="header-cell"][data-row-index="-1"][data-column-index="${start}"]`,
                            );
                            const g = box(group);
                            return {
                                key: group.textContent,
                                left: first ? box(first).left - g.left : null,
                                right: last ? box(last).right - g.right : null,
                                // the group sits right above its columns' header cells
                                above: leaf ? box(leaf).top - g.bottom : null,
                            };
                        });
                    });
                    expect(groups.length, `at ${left}`).toBeGreaterThan(0);
                    for (const group of groups) {
                        if (group.left === null || group.right === null) cut++;
                        for (const edge of [
                            group.left,
                            group.right,
                            group.above,
                        ]) {
                            if (edge !== null) {
                                expect(
                                    Math.abs(edge),
                                    `${group.key} at ${left}`,
                                ).toBeLessThan(1);
                            }
                        }
                    }
                }
                // some group was cut by the column window on the way
                expect(cut).toBeGreaterThan(0);
            });

            test("moves up from a column to its group and back, and across header rows", async ({
                page,
            }) => {
                const viewport = await open(page, kind, GROUPS);
                await page
                    .locator(
                        '[data-grid-part="header-cell"][data-row-index="-1"][data-column-index="1"]',
                    )
                    .click();
                await page.keyboard.press("ArrowUp");
                expect(await focused(page)).toMatchObject({
                    row: "-2",
                    column: "1",
                });
                await page.keyboard.press("ArrowRight");
                expect(await focused(page)).toMatchObject({
                    row: "-2",
                    column: "5",
                });
                await page.keyboard.press("ArrowLeft");
                await page.keyboard.press("ArrowDown");
                expect(await focused(page)).toMatchObject({
                    row: "-1",
                    column: "1",
                });
                // C0 spans both header rows: reached from the body, on the columns' row
                await cell(page, 0, 0).click();
                await page.keyboard.press("ArrowUp");
                expect(await focused(page)).toMatchObject({
                    row: "-2",
                    column: "0",
                });
                expect(await active(page)).toEqual({
                    rowIndex: -1,
                    columnIndex: 0,
                });
                await page.keyboard.press("ArrowRight");
                expect(await focused(page)).toMatchObject({
                    row: "-1",
                    column: "1",
                });
                // a group in view stays in view: Up does not scroll to its first column, and Down
                // lands on its first column in view
                await scroll(page, viewport, 0, 1_000);
                await page
                    .locator(
                        '[data-grid-part="header-cell"][data-row-index="-1"][data-column-index="12"]',
                    )
                    .click();
                const before = await viewport.evaluate(
                    (element) => element.scrollLeft,
                );
                await page.keyboard.press("ArrowUp");
                expect(await focused(page)).toMatchObject({
                    row: "-2",
                    column: "5",
                });
                await page.keyboard.press("ArrowDown");
                expect(await focused(page)).toMatchObject({
                    row: "-1",
                    column: "10",
                });
                expect(
                    await viewport.evaluate((element) => element.scrollLeft),
                ).toBe(before);
            });

            test("takes a click anywhere on a column spanning header rows", async ({
                page,
            }) => {
                await open(page, kind, GROUPS);
                const spanning = page.locator(
                    '[data-grid-part="header-cell"][data-row-index="-2"][data-column-index="0"]',
                );
                const box = await spanning.boundingBox();
                if (!box) throw new Error("no box");
                // its lower half lies in the columns' row band: that row must not cover it
                await page.mouse.click(
                    box.x + box.width / 2,
                    box.y + box.height * 0.75,
                );
                expect(await focused(page)).toMatchObject({
                    row: "-2",
                    column: "0",
                });
                expect(await active(page)).toEqual({
                    rowIndex: -2,
                    columnIndex: 0,
                });
            });

            test("counts and spans header rows in ARIA, and spans table cells", async ({
                page,
            }) => {
                await open(page, kind, GROUPS);
                const grid = page.locator('[data-grid-part="grid"]');
                await expect(grid).toHaveAttribute("aria-rowcount", "1002");
                await expect(grid).toHaveAttribute("aria-colcount", "60");
                const rows = page.locator('[data-grid-part="header-row"]');
                await expect(rows).toHaveCount(2);
                expect(
                    await rows.evaluateAll((all) =>
                        all.map((row) => row.getAttribute("aria-rowindex")),
                    ),
                ).toEqual(["1", "2"]);
                const header = (row: number, column: number) =>
                    page.locator(
                        `[data-grid-part="header-cell"][data-row-index="${row}"][data-column-index="${column}"]`,
                    );
                const group = header(-2, 1);
                await expect(group).toHaveAttribute("aria-colindex", "2");
                await expect(group).toHaveAttribute("aria-colspan", "4");
                await expect(group).not.toHaveAttribute("aria-rowspan");
                await expect(group).toHaveAttribute("data-group", "");
                const spanning = header(-2, 0);
                await expect(spanning).toHaveAttribute("aria-colindex", "1");
                await expect(spanning).toHaveAttribute("aria-rowspan", "2");
                await expect(spanning).not.toHaveAttribute("data-group");
                const leaf = header(-1, 1);
                await expect(leaf).toHaveAttribute("aria-colindex", "2");
                await expect(leaf).not.toHaveAttribute("aria-colspan");
                await expect(
                    page.locator('[data-grid-part="row"]').first(),
                ).toHaveAttribute("aria-rowindex", "3");
                if (kind === "table") {
                    expect(
                        await group.evaluate((element) => element.tagName),
                    ).toBe("TH");
                    await expect(group).toHaveAttribute("colspan", "4");
                    await expect(spanning).toHaveAttribute("rowspan", "2");
                    await expect(leaf).not.toHaveAttribute("colspan");
                } else {
                    await expect(group).not.toHaveAttribute("colspan");
                }
            });

            test("does not render React while scrolling inside the overscan", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    ...GROUPS,
                    rows: 100_000,
                });
                await scroll(page, viewport, 32 * 1_000, 1_000);
                const before = await page.evaluate(() => window.commits);
                // two rows down and a column right: inside the overscan
                await scroll(page, viewport, 32 * 1_002, 1_100);
                expect(await page.evaluate(() => window.commits)).toBe(before);
                // far to the right: a new column window renders
                await scroll(page, viewport, 32 * 1_002, 3_000);
                expect(
                    await page.evaluate(() => window.commits),
                ).toBeGreaterThan(before);
            });
        });
    });
}
