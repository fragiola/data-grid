import { expect, type Locator, type Page, test } from "@playwright/test";
import {
    boxOf,
    cell,
    contentWidth,
    dragBy,
    settle,
} from "../../../examples/react/e2e/examples/helpers.ts";

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

        test.describe("pinned columns", () => {
            /** A cell's left from the viewport's left edge. */
            async function leftInView(viewport: Locator, target: Locator) {
                const view = await viewport.boundingBox();
                const box = await target.boundingBox();
                if (!view || !box) throw new Error("no box");
                return box.x - view.x;
            }

            function headerCell(
                page: Page,
                rowIndex: number,
                columnIndex: number,
            ) {
                return page.locator(
                    `[data-grid-part="header-cell"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
                );
            }

            /**
             * Sets `scrollLeft` and reads the pinned cells' lefts from the viewport's left edge in
             * the same task, before any `scroll` listener runs: what a frame painted before the
             * engine's JavaScript shows. `fired` tells whether a scroll listener ran meanwhile.
             */
            function leftsBeforeTheScrollEvent(
                viewport: Locator,
                left: number,
                selectors: readonly string[],
            ) {
                return viewport.evaluate(
                    (element, [to, targets]) => {
                        let fired = false;
                        const onScroll = () => {
                            fired = true;
                        };
                        element.addEventListener("scroll", onScroll);
                        element.scrollLeft = to;
                        const view = element.getBoundingClientRect().left;
                        const lefts = targets.map((selector) => {
                            const target = element.querySelector(selector);
                            if (!target) throw new Error(`no ${selector}`);
                            return target.getBoundingClientRect().left - view;
                        });
                        element.removeEventListener("scroll", onScroll);
                        return { lefts, fired, scrolled: element.scrollLeft };
                    },
                    [left, selectors] as const,
                );
            }

            const PINNED_TARGETS = [
                '[data-grid-part="cell"][data-row-index="6"][data-column-index="0"]',
                '[data-grid-part="cell"][data-row-index="6"][data-column-index="1"]',
                '[data-grid-part="header-cell"][data-row-index="-1"][data-column-index="0"]',
                '[data-grid-part="header-cell"][data-row-index="-1"][data-column-index="1"]',
            ];

            test("has pinned cells in place before the scroll event runs", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    rows: 1_000,
                    columns: 60,
                    pinned: 2,
                });
                await scroll(page, viewport, 32 * 5, 1_000);
                // small moves both ways, and one past a column
                for (const left of [1_040, 1_000, 1_130]) {
                    const { lefts, fired, scrolled } =
                        await leftsBeforeTheScrollEvent(
                            viewport,
                            left,
                            PINNED_TARGETS,
                        );
                    expect(fired).toBe(false);
                    expect(scrolled).toBe(left);
                    for (const [index, value] of lefts.entries()) {
                        expect(
                            value,
                            `${PINNED_TARGETS[index]} at ${left}`,
                        ).toBeCloseTo((index % 2) * 100, 0);
                    }
                    await settle(page);
                }
            });

            test("has pinned cells in place before the scroll event runs, under scaled column scroll", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    rows: 100,
                    columns: 1_000_000,
                    maxScrollSize: 1_000_000,
                    pinned: 2,
                });
                await scroll(page, viewport, 32 * 5, 333_333);
                const start = await viewport.evaluate(
                    (element) => element.scrollLeft,
                );
                // small physical moves, which do not cross a scaled jump of the content
                for (const delta of [3, -2, 8]) {
                    const { lefts, fired } = await leftsBeforeTheScrollEvent(
                        viewport,
                        start + delta,
                        PINNED_TARGETS,
                    );
                    expect(fired).toBe(false);
                    for (const [index, value] of lefts.entries()) {
                        expect(
                            value,
                            `${PINNED_TARGETS[index]} at +${delta}`,
                        ).toBeCloseTo((index % 2) * 100, 0);
                    }
                    await settle(page);
                }
            });

            test("keeps pinned cells and header cells in place while scrolling sideways", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    rows: 1_000,
                    columns: 60,
                    pinned: 2,
                });
                for (const left of [0, 1_234, "end"] as const) {
                    await scroll(page, viewport, 32 * 5, left);
                    for (const columnIndex of [0, 1]) {
                        expect(
                            await leftInView(
                                viewport,
                                cell(page, 6, columnIndex),
                            ),
                            `cell ${columnIndex} at ${left}`,
                        ).toBeCloseTo(columnIndex * 100, 0);
                        expect(
                            await leftInView(
                                viewport,
                                headerCell(page, -1, columnIndex),
                            ),
                            `header ${columnIndex} at ${left}`,
                        ).toBeCloseTo(columnIndex * 100, 0);
                    }
                    await expect(cell(page, 6, 1)).toHaveAttribute(
                        "data-pinned-edge",
                        "",
                    );
                    await expect(cell(page, 6, 0)).toHaveAttribute(
                        "aria-colindex",
                        "1",
                    );
                }
            });

            test("keeps them in place under scaled column scroll", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    rows: 100,
                    columns: 1_000_000,
                    maxScrollSize: 1_000_000,
                    pinned: 1,
                });
                for (const left of [0, 333_333, "end"] as const) {
                    await scroll(page, viewport, 0, left);
                    expect(
                        await leftInView(viewport, cell(page, 0, 0)),
                    ).toBeCloseTo(0, 0);
                    expect(
                        await leftInView(viewport, headerCell(page, -1, 0)),
                    ).toBeCloseTo(0, 0);
                }
            });

            test("brings a cell into view right of the pinned columns, from the keyboard", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    rows: 1_000,
                    columns: 60,
                    pinned: 2,
                });
                await scroll(page, viewport, 0, 2_000);
                await cell(page, 3, 1).click();
                await page.keyboard.press("ArrowRight");
                await settle(page);
                await expect(cell(page, 3, 2)).toBeFocused();
                expect(
                    await leftInView(viewport, cell(page, 3, 2)),
                ).toBeGreaterThanOrEqual(200 - 0.5);
                await expectFullyInBody(viewport, cell(page, 3, 2));
                await page.keyboard.press("End");
                await settle(page);
                await expectFullyInBody(viewport, cell(page, 3, 59));
                await page.keyboard.press("ArrowLeft");
                await settle(page);
                expect(
                    await leftInView(viewport, cell(page, 3, 58)),
                ).toBeGreaterThanOrEqual(200 - 0.5);
                await page.keyboard.press("Home");
                await settle(page);
                await expect(cell(page, 3, 0)).toBeFocused();
                expect(
                    await leftInView(viewport, cell(page, 3, 0)),
                ).toBeCloseTo(0, 0);
            });

            test("keeps a pinned group over its columns", async ({ page }) => {
                const viewport = await open(page, kind, {
                    rows: 1_000,
                    columns: 60,
                    groups: 1,
                    pinned: 5,
                });
                await scroll(page, viewport, 0, 3_000);
                // G0 holds C1–C4, after C0
                expect(
                    await leftInView(viewport, headerCell(page, -2, 1)),
                ).toBeCloseTo(100, 0);
                await expect(headerCell(page, -2, 1)).toHaveAttribute(
                    "data-pinned-edge",
                    "",
                );
            });

            test("does not render React while scrolling sideways inside the overscan", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    rows: 1_000,
                    columns: 60,
                    pinned: 2,
                });
                await scroll(page, viewport, 0, 1_000);
                const before = await page.evaluate(() => window.commits);
                await scroll(page, viewport, 0, 1_040);
                expect(await page.evaluate(() => window.commits)).toBe(before);
                expect(
                    await leftInView(viewport, cell(page, 0, 1)),
                ).toBeCloseTo(100, 0);
            });
        });

        test.describe("row details", () => {
            const DETAILS = { rows: 1_000, columns: 40, details: 1 } as const;

            /** The outer grid's cell: an inner grid in a detail has cells at the same indexes. */
            function cell(page: Page, rowIndex: number, columnIndex: number) {
                return page
                    .locator(
                        `[data-grid-part="cell"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
                    )
                    .filter({ hasText: `${rowIndex}:${columnIndex}` });
            }

            function detail(page: Page, rowIndex: number) {
                return page.locator(
                    `[data-grid-part="row-detail"][data-row-index="${rowIndex}"]`,
                );
            }

            /** The detail's box from the viewport's left edge, its top from row's cells. */
            async function detailBox(viewport: Locator, rowIndex: number) {
                return viewport.evaluate((element, index) => {
                    const target = element.querySelector(
                        `[data-grid-part="row-detail"][data-row-index="${index}"]`,
                    );
                    if (!target) throw new Error("no detail");
                    const box = target.getBoundingClientRect();
                    const view = element.getBoundingClientRect();
                    return {
                        left: box.left - view.left,
                        top: box.top,
                        width: box.width,
                        height: box.height,
                        viewWidth: element.clientWidth,
                    };
                }, rowIndex);
            }

            test("expands and collapses a row: its detail below its cells, the rows after it moved down", async ({
                page,
            }) => {
                await open(page, kind, DETAILS);
                const expander = page.getByTestId("expand-2");
                await expect(expander).toHaveAttribute(
                    "aria-expanded",
                    "false",
                );
                const below = (await cell(page, 3, 1).boundingBox())?.y ?? 0;
                await expander.click();
                await settle(page);
                await expect(expander).toHaveAttribute("aria-expanded", "true");
                // the outer row: the inner grid's rows come after it
                const row = page
                    .locator('[data-grid-part="row"][data-row-index="2"]')
                    .first();
                await expect(row).toHaveAttribute("data-expanded", "");
                await expect(detail(page, 2)).toBeVisible();
                if (kind === "table") {
                    expect(
                        await detail(page, 2).evaluate((e) => e.tagName),
                    ).toBe("TD");
                }
                const cells = await cell(page, 2, 1).boundingBox();
                const box = await detail(page, 2).boundingBox();
                expect(box?.y).toBeCloseTo((cells?.y ?? 0) + 32, 0);
                expect(box?.height).toBeCloseTo(200, 0);
                expect((await cell(page, 3, 1).boundingBox())?.y).toBeCloseTo(
                    below + 200,
                    0,
                );
                await expander.click();
                await settle(page);
                await expect(detail(page, 2)).toHaveCount(0);
                await expect(row).not.toHaveAttribute("data-expanded");
                expect((await cell(page, 3, 1).boundingBox())?.y).toBeCloseTo(
                    below,
                    0,
                );
            });

            for (const pinned of [0, 2]) {
                test(`keeps a detail as wide as the view and in view sideways${pinned ? ", with pinned columns" : ""}`, async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, {
                        ...DETAILS,
                        pinned,
                    });
                    await page.getByTestId("expand-1").click();
                    await settle(page);
                    for (const left of [0, 1_234, 3_210, 450]) {
                        await scroll(page, viewport, 0, left);
                        const box = await detailBox(viewport, 1);
                        expect(box.left, `at ${left}`).toBeCloseTo(0, 0);
                        expect(box.width).toBeCloseTo(box.viewWidth, 0);
                    }
                    // and on the frame before the scroll event runs (sticky, no JavaScript)
                    const same = await viewport.evaluate((element) => {
                        let fired = false;
                        const onScroll = () => {
                            fired = true;
                        };
                        element.addEventListener("scroll", onScroll);
                        element.scrollLeft += 60;
                        const target = element.querySelector(
                            '[data-grid-part="row-detail"][data-row-index="1"]',
                        );
                        const left =
                            (target?.getBoundingClientRect().left ?? 1) -
                            element.getBoundingClientRect().left;
                        element.removeEventListener("scroll", onScroll);
                        return { left, fired };
                    });
                    expect(same.fired).toBe(false);
                    expect(same.left).toBeCloseTo(0, 0);
                });
            }

            test("keeps a detail as wide as the view in a grid narrower than the view", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    ...DETAILS,
                    columns: 3,
                    pinned: 1,
                });
                await page.getByTestId("expand-0").click();
                await settle(page);
                const box = await detailBox(viewport, 0);
                expect(box.left).toBeCloseTo(0, 0);
                expect(box.width).toBeCloseTo(box.viewWidth, 0);
                // painted to the view's end: nothing clips it at the last column
                const painted = await viewport.evaluate((element) => {
                    const target = element.querySelector(
                        '[data-grid-part="row-detail"][data-row-index="0"]',
                    );
                    const rect = target?.getBoundingClientRect();
                    if (!rect) return false;
                    const hit = document.elementFromPoint(
                        rect.right - 10,
                        rect.top + rect.height / 2,
                    );
                    return Boolean(hit && target?.contains(hit));
                });
                expect(painted).toBe(true);
            });

            test("moves between rows' cells with the arrows, never into a detail", async ({
                page,
            }) => {
                const viewport = await open(page, kind, DETAILS);
                await page.getByTestId("expand-2").click();
                await cell(page, 2, 1).click();
                await page.keyboard.press("ArrowDown");
                await settle(page);
                expect(await active(page)).toEqual({
                    rowIndex: 3,
                    columnIndex: 1,
                });
                await expect(cell(page, 3, 1)).toBeFocused();
                await expectFullyInBody(viewport, cell(page, 3, 1));
                await page.keyboard.press("ArrowUp");
                await settle(page);
                await expect(cell(page, 2, 1)).toBeFocused();
            });

            test("leaves a grid inside a detail its own active cell and keys", async ({
                page,
            }) => {
                await open(page, kind, DETAILS);
                await page.getByTestId("expand-1").click();
                await cell(page, 0, 2).click();
                await settle(page);
                const inner = page.getByTestId("inner-1");
                await inner
                    .locator(
                        '[data-grid-part="cell"][data-row-index="0"][data-column-index="0"]',
                    )
                    .click();
                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("ArrowRight");
                await settle(page);
                await expect(
                    inner.locator(
                        '[data-grid-part="cell"][data-row-index="1"][data-column-index="1"]',
                    ),
                ).toBeFocused();
                // the outer grid's active cell did not move
                expect(await active(page)).toEqual({
                    rowIndex: 0,
                    columnIndex: 2,
                });
                // a control in the detail is the app's: the arrows do nothing to the grid
                await page.getByTestId("detail-button-1").focus();
                await page.keyboard.press("ArrowDown");
                await settle(page);
                await expect(page.getByTestId("detail-button-1")).toBeFocused();
                expect(await active(page)).toEqual({
                    rowIndex: 0,
                    columnIndex: 2,
                });
            });

            test("keeps ARIA counts and indexes: a detail is a cell of its row", async ({
                page,
            }) => {
                await open(page, kind, DETAILS);
                const grid = page.locator('[data-grid-part="grid"]').first();
                const count = await grid.getAttribute("aria-rowcount");
                await page.getByTestId("expand-2").click();
                await settle(page);
                expect(await grid.getAttribute("aria-rowcount")).toBe(count);
                const outer = page.locator(
                    '[data-grid-part="row"][data-row-index="3"]',
                );
                await expect(outer.first()).toHaveAttribute(
                    "aria-rowindex",
                    "5",
                );
                await expect(detail(page, 2)).toHaveAttribute(
                    "role",
                    "gridcell",
                );
                await expect(detail(page, 2)).toHaveAttribute(
                    "aria-colindex",
                    "1",
                );
                await expect(detail(page, 2)).toHaveAttribute(
                    "aria-colspan",
                    "40",
                );
            });

            test("keeps the view where it is when a row above it expands", async ({
                page,
            }) => {
                const viewport = await open(page, kind, DETAILS);
                await scroll(page, viewport, 32 * 100 + 5);
                const before = (await cell(page, 101, 1).boundingBox())?.y;
                await page.evaluate(() =>
                    window.grid?.model.run("expanded-rows.toggle", {
                        rowIndex: 10,
                    }),
                );
                await settle(page);
                await settle(page);
                expect((await cell(page, 101, 1).boundingBox())?.y).toBeCloseTo(
                    before ?? 0,
                    0,
                );
                expect(
                    await viewport.evaluate((element) => element.scrollTop),
                ).toBeCloseTo(32 * 100 + 5 + 200, 0);
            });

            test("renders no React while scrolling inside the overscan, a detail on screen", async ({
                page,
            }) => {
                const viewport = await open(page, kind, DETAILS);
                await page.getByTestId("expand-3").click();
                await scroll(page, viewport, 32 * 2);
                const before = await page.evaluate(() => window.commits);
                await scroll(page, viewport, 32 * 3, 30);
                await scroll(page, viewport, 32 * 2 + 7, 60);
                expect(await page.evaluate(() => window.commits)).toBe(before);
            });

            test("places rows past a detail exactly under scroll scaling", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    ...DETAILS,
                    rows: 1_000_000,
                    maxScrollSize: 1_000_000,
                });
                await page.evaluate(() => {
                    window.grid?.model.run("expanded-rows.toggle", {
                        rowIndex: 500_000,
                    });
                    window.grid?.engine.run("scroll-to-cell", {
                        rowIndex: 500_000,
                        align: "start",
                    });
                });
                await settle(page);
                await settle(page);
                await expect(detail(page, 500_000)).toBeVisible();
                const cells = await cell(page, 500_000, 1).boundingBox();
                const box = await detail(page, 500_000).boundingBox();
                const next = await cell(page, 500_001, 1).boundingBox();
                expect(box?.y).toBeCloseTo((cells?.y ?? 0) + 32, 0);
                expect(next?.y).toBeCloseTo((cells?.y ?? 0) + 232, 0);
                await expectFullyInBody(viewport, cell(page, 500_000, 1));
            });
        });

        test.describe("interactive cells", () => {
            const CONTROLS = { rows: 1_000, columns: 20, controls: 1 };

            const focusedTestId = (page: Page) =>
                page.evaluate(
                    () =>
                        document.activeElement?.getAttribute("data-testid") ??
                        null,
                );

            test("is one tab stop however many controls its cells hold", async ({
                page,
            }) => {
                await open(page, kind, CONTROLS);
                await page.getByTestId("before").focus();
                await page.keyboard.press("Tab");
                // the grid's own stop: a cell, never a control inside one
                expect(await focused(page)).toMatchObject({ testId: null });
                expect(
                    await page.evaluate(() =>
                        document.activeElement?.hasAttribute("data-row-index"),
                    ),
                ).toBe(true);
                await page.keyboard.press("Tab");
                // the app's own tab stop (row 0's C4) is one
                expect(await focusedTestId(page)).toBe("kept");
                await page.keyboard.press("Tab");
                expect(await focusedTestId(page)).toBe("after");
            });

            test("Enter hands a cell's keys to its controls, Tab cycles them, Escape gives them back", async ({
                page,
            }) => {
                await open(page, kind, CONTROLS);
                await cell(page, 3, 2).click({ position: { x: 90, y: 5 } });
                await page.keyboard.press("Enter");
                expect(await focusedTestId(page)).toBe("edit-3");
                await expect(cell(page, 3, 2)).toHaveAttribute(
                    "data-interacting",
                    "",
                );
                await page.keyboard.press("Tab");
                expect(await focusedTestId(page)).toBe("open-3");
                await page.keyboard.press("Tab");
                expect(await focusedTestId(page)).toBe("edit-3");
                await page.keyboard.press("Shift+Tab");
                expect(await focusedTestId(page)).toBe("open-3");
                await page.keyboard.press("Escape");
                await expect(cell(page, 3, 2)).toBeFocused();
                await expect(cell(page, 3, 2)).not.toHaveAttribute(
                    "data-interacting",
                    /.*/,
                );
            });

            test("gives a field its keys, and a click on a control activates its cell", async ({
                page,
            }) => {
                await open(page, kind, CONTROLS);
                await page.getByTestId("field-4").click();
                await expect(cell(page, 4, 3)).toHaveAttribute(
                    "data-interacting",
                    "",
                );
                await page.keyboard.type("abc");
                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("Home");
                expect(await active(page)).toEqual({
                    rowIndex: 4,
                    columnIndex: 3,
                });
                await expect(page.getByTestId("field-4")).toHaveValue("abc");
                await page.keyboard.press("Escape");
                await expect(cell(page, 4, 3)).toBeFocused();
                await page.keyboard.press("ArrowDown");
                expect(await active(page)).toEqual({
                    rowIndex: 5,
                    columnIndex: 3,
                });
                await page.getByTestId("open-7").focus();
                expect(await active(page)).toEqual({
                    rowIndex: 7,
                    columnIndex: 2,
                });
            });

            test("enters a header cell that is not sortable on Enter", async ({
                page,
            }) => {
                await open(page, kind, CONTROLS);
                const header = page.locator(
                    '[data-grid-part="header-cell"][data-column-index="3"]',
                );
                await header.click({ position: { x: 5, y: 5 } });
                await page.keyboard.press("Enter");
                expect(await focusedTestId(page)).toBe("header-menu");
                await page.keyboard.press("Escape");
                await expect(header).toBeFocused();
            });
        });

        test.describe("row selection", () => {
            const SELECTION = {
                rows: 1_000,
                columns: 20,
                selection: "multiple",
            };

            const row = (page: Page, rowIndex: number) =>
                page.locator(
                    `[data-grid-part="row"][data-row-index="${rowIndex}"]`,
                );
            const selected = (page: Page) =>
                page.evaluate(
                    () => window.grid?.model.state.selectedRowKeys ?? [],
                );

            test("Shift+Space selects and clears the active row", async ({
                page,
            }) => {
                await open(page, kind, SELECTION);
                await expect(
                    page.locator('[data-grid-part="grid"]'),
                ).toHaveAttribute("aria-multiselectable", "true");
                await expect(row(page, 2)).toHaveAttribute(
                    "aria-selected",
                    "false",
                );
                await cell(page, 2, 0).click();
                await page.keyboard.press("Shift+Space");
                await expect(row(page, 2)).toHaveAttribute("data-selected", "");
                await expect(row(page, 2)).toHaveAttribute(
                    "aria-selected",
                    "true",
                );
                await expect(page.getByTestId("select-2")).toBeChecked();
                await page.keyboard.press("Shift+Space");
                await expect(row(page, 2)).not.toHaveAttribute(
                    "data-selected",
                    /.*/,
                );
                expect(await selected(page)).toEqual([]);
            });

            test("Shift+Down extends from the row it starts on, Ctrl+A selects every row", async ({
                page,
            }) => {
                await open(page, kind, SELECTION);
                await cell(page, 3, 0).click();
                await page.keyboard.press("Shift+ArrowDown");
                await page.keyboard.press("Shift+ArrowDown");
                expect(await active(page)).toEqual({
                    rowIndex: 5,
                    columnIndex: 0,
                });
                expect(await selected(page)).toEqual([3, 4, 5]);
                await page.keyboard.press("ControlOrMeta+a");
                expect((await selected(page)).length).toBe(1_000);
                await expect(row(page, 0)).toHaveAttribute("data-selected", "");
            });

            test("a row's checkbox toggles through the grid, Enter and Space included, and Shift+click extends", async ({
                page,
            }) => {
                await open(page, kind, SELECTION);
                await page.getByTestId("select-1").click();
                expect(await selected(page)).toEqual([1]);
                await page
                    .getByTestId("select-4")
                    .click({ modifiers: ["Shift"] });
                expect(await selected(page)).toEqual([1, 2, 3, 4]);
                await page.keyboard.press("Escape");
                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("Enter");
                await expect(page.getByTestId("select-5")).toBeFocused();
                await page.keyboard.press("Space");
                expect(await selected(page)).toEqual([1, 2, 3, 4, 5]);
                expect(
                    await page.evaluate(() => window.selectionChanges.length),
                ).toBe(3);
            });

            test("a row that cannot be selected carries no aria-selected, and a single selection no aria-multiselectable", async ({
                page,
            }) => {
                await open(page, kind, {
                    ...SELECTION,
                    selection: "single",
                    locked: 2,
                });
                await expect(
                    page.locator('[data-grid-part="grid"]'),
                ).not.toHaveAttribute("aria-multiselectable", /.*/);
                await expect(row(page, 2)).not.toHaveAttribute(
                    "aria-selected",
                    /.*/,
                );
                await cell(page, 3, 0).click();
                await page.keyboard.press("Shift+Space");
                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("Shift+Space");
                expect(await selected(page)).toEqual([4]);
            });
        });

        test.describe("sorting", () => {
            const SORT = { rows: 1_000, columns: 20, sort: 1 };

            function headerCell(page: Page, columnIndex: number) {
                return page.locator(
                    `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]`,
                );
            }

            /** Each of the first three header cells' sort, as its attributes show it. */
            function shown(page: Page) {
                return page.evaluate(() =>
                    [0, 1, 2].map((columnIndex) => {
                        const element = document.querySelector(
                            `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]`,
                        );
                        return [
                            element?.getAttribute("aria-sort") ?? null,
                            element?.getAttribute("data-sort") ?? null,
                            element?.getAttribute("data-sort-priority") ?? null,
                        ];
                    }),
                );
            }

            const changes = (page: Page) =>
                page.evaluate(() => window.sortChanges.length);

            test("toggles on a click, Ctrl or ⌘ adding a column, aria-sort on one header only", async ({
                page,
            }) => {
                await open(page, kind, SORT);
                await headerCell(page, 0).click();
                expect(await shown(page)).toEqual([
                    ["ascending", "ascending", "1"],
                    [null, null, null],
                    [null, null, null],
                ]);
                await headerCell(page, 1).click({
                    modifiers: ["ControlOrMeta"],
                    position: { x: 5, y: 5 },
                });
                expect(await shown(page)).toEqual([
                    ["ascending", "ascending", "1"],
                    [null, "ascending", "2"],
                    [null, null, null],
                ]);
                expect(await page.locator("[aria-sort]").count()).toBe(1);
                await headerCell(page, 0).click();
                expect(await shown(page)).toEqual([
                    ["descending", "descending", "1"],
                    [null, null, null],
                    [null, null, null],
                ]);
                if (kind === "table") {
                    expect(
                        await headerCell(page, 0).evaluate(
                            (element) => element.tagName,
                        ),
                    ).toBe("TH");
                }
            });

            test("toggles on Enter and Space on the active header cell", async ({
                page,
            }) => {
                await open(page, kind, SORT);
                await headerCell(page, 0).focus();
                await page.keyboard.press("Enter");
                expect((await shown(page))[0]?.[1]).toBe("ascending");
                await page.keyboard.press("Space");
                expect((await shown(page))[0]?.[1]).toBe("descending");
                // the arrows still move: Space sorted, it did not scroll
                await page.keyboard.press("ArrowDown");
                expect(await active(page)).toEqual({
                    rowIndex: 0,
                    columnIndex: 0,
                });
            });

            test("does not sort for a column that is not sortable, a button in a header cell, or a cancelled event", async ({
                page,
            }) => {
                await open(page, kind, SORT);
                await headerCell(page, 2).click();
                await page.getByTestId("menu").click();
                // the consumer's own handler, before the grid's: preventDefault cancels
                await headerCell(page, 0).evaluate((element) => {
                    const cancel = (event: Event) => event.preventDefault();
                    element.addEventListener("click", cancel);
                    element.addEventListener("keydown", cancel);
                });
                await headerCell(page, 0).click();
                await headerCell(page, 0).focus();
                await page.keyboard.press("Enter");
                expect(await changes(page)).toBe(0);
                expect(await shown(page)).toEqual([
                    [null, null, null],
                    [null, null, null],
                    [null, null, null],
                ]);
            });
        });

        test.describe("column resizing", () => {
            const RESIZE = { rows: 1_000, columns: 20, resize: 1 };

            /** A column's header cell (not a group's above it). */
            function headerCell(page: Page, columnIndex: number) {
                return page.locator(
                    `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]:not([data-group])`,
                );
            }

            const resizer = (page: Page, key: string) =>
                page.getByTestId(`resizer-${key}`);

            /** The widths on screen of a column's header cell and its first body cell. */
            async function widths(page: Page, columnIndex: number) {
                return [
                    (await boxOf(headerCell(page, columnIndex))).width,
                    (await boxOf(cell(page, 0, columnIndex))).width,
                ];
            }

            /** Drags a resizer by `dx` and, unless told to hold it, releases it. */
            const drag = (
                page: Page,
                key: string,
                dx: number,
                options?: { hold?: boolean },
            ) => dragBy(page, resizer(page, key), dx, options);

            const lastWidths = (page: Page) =>
                page.evaluate(() => window.widthChanges.at(-1));

            /** C1's content: wider than its minimum, narrower than its 100px. */
            async function fittedC1(page: Page) {
                const width = await contentWidth(page, 1);
                expect(width).toBeGreaterThan(40);
                expect(width).toBeLessThan(100);
                return width;
            }

            test("resizes a column live as its resizer is dragged", async ({
                page,
            }) => {
                await open(page, kind, RESIZE);
                await expect(headerCell(page, 0)).toHaveAttribute(
                    "data-resizable",
                    "",
                );
                await expect(headerCell(page, 4)).not.toHaveAttribute(
                    "data-resizable",
                );
                await drag(page, "c0", 60, { hold: true });
                // before the release: the header cell, the body cells and the next column follow
                expect(await widths(page, 0)).toEqual([160, 160]);
                expect((await boxOf(cell(page, 0, 1))).x).toBe(
                    (await boxOf(cell(page, 0, 0))).x + 160,
                );
                expect((await boxOf(headerCell(page, 1))).x).toBe(
                    (await boxOf(cell(page, 0, 1))).x,
                );
                await expect(headerCell(page, 0)).toHaveAttribute(
                    "data-resizing",
                    "",
                );
                await expect(resizer(page, "c0")).toHaveAttribute(
                    "data-resizing",
                    "",
                );
                await expect(resizer(page, "c0")).toHaveAttribute(
                    "aria-valuenow",
                    "160",
                );
                await page.mouse.up();
                await settle(page);
                await expect(headerCell(page, 0)).not.toHaveAttribute(
                    "data-resizing",
                );
                expect(await widths(page, 0)).toEqual([160, 160]);
                expect(await lastWidths(page)).toEqual({ c0: 160 });
            });

            test("holds a column within its minimum and its maximum", async ({
                page,
            }) => {
                await open(page, kind, RESIZE);
                await expect(resizer(page, "c2")).toHaveAttribute(
                    "aria-valuemin",
                    "60",
                );
                await expect(resizer(page, "c2")).toHaveAttribute(
                    "aria-valuemax",
                    "200",
                );
                await drag(page, "c2", -80);
                expect(await widths(page, 2)).toEqual([60, 60]);
                await drag(page, "c2", 300);
                expect(await widths(page, 2)).toEqual([200, 200]);
                // the default minimum
                await drag(page, "c0", -90);
                expect(await widths(page, 0)).toEqual([40, 40]);
            });

            test("restores the width on Escape during a drag, and fits it to its content on a double click", async ({
                page,
            }) => {
                await open(page, kind, RESIZE);
                await drag(page, "c1", 50, { hold: true });
                expect(await widths(page, 1)).toEqual([150, 150]);
                await page.keyboard.press("Escape");
                await settle(page);
                expect(await widths(page, 1)).toEqual([100, 100]);
                await expect(headerCell(page, 1)).not.toHaveAttribute(
                    "data-resizing",
                );
                // the release after Escape changes nothing
                await page.mouse.move(400, 10);
                await page.mouse.up();
                await settle(page);
                expect(await widths(page, 1)).toEqual([100, 100]);
                await drag(page, "c1", 70);
                expect(await widths(page, 1)).toEqual([170, 170]);
                await resizer(page, "c1").dblclick();
                await settle(page);
                // it fits its content (Epic #80, A4)
                const fitted = await fittedC1(page);
                expect(await widths(page, 1)).toEqual([fitted, fitted]);
                expect(await lastWidths(page)).toEqual({ c1: fitted });
            });

            test("resizes with the keys from inside its header cell, aria-valuenow following", async ({
                page,
            }) => {
                const viewport = await open(page, kind, RESIZE);
                await headerCell(page, 0).click({ position: { x: 5, y: 5 } });
                await page.keyboard.press("F2");
                await expect(resizer(page, "c0")).toBeFocused();
                const valueNow = resizer(page, "c0");
                await page.keyboard.press("ArrowRight");
                await expect(valueNow).toHaveAttribute("aria-valuenow", "110");
                await page.keyboard.press("Shift+ArrowRight");
                await expect(valueNow).toHaveAttribute("aria-valuenow", "160");
                await page.keyboard.press("ArrowLeft");
                await expect(valueNow).toHaveAttribute("aria-valuenow", "150");
                expect(await widths(page, 0)).toEqual([150, 150]);
                // no maximum: End goes to the one it reports, the view's width
                await page.keyboard.press("End");
                const valueMax = await valueNow.getAttribute("aria-valuemax");
                expect(Number(valueMax)).toBeGreaterThan(600);
                await expect(valueNow).toHaveAttribute(
                    "aria-valuenow",
                    String(valueMax),
                );
                // Space and PageDown page nothing on it
                await page.keyboard.press(" ");
                await page.keyboard.press("PageDown");
                await settle(page);
                expect(await viewport.evaluate((el) => el.scrollTop)).toBe(0);
                await expect(valueNow).toHaveAttribute(
                    "aria-valuenow",
                    String(valueMax),
                );
                await page.keyboard.press("Home");
                await expect(valueNow).toHaveAttribute("aria-valuenow", "40");
                // Escape gives the keys back; the width stays
                await page.keyboard.press("ArrowRight");
                await page.keyboard.press("Escape");
                await expect(headerCell(page, 0)).toBeFocused();
                expect(await widths(page, 0)).toEqual([50, 50]);
                // Enter on a header cell that does not sort reaches it too
                await page.keyboard.press("ArrowRight");
                await page.keyboard.press("ArrowRight");
                await page.keyboard.press("Enter");
                await expect(resizer(page, "c2")).toBeFocused();
                await page.keyboard.press("End");
                await expect(resizer(page, "c2")).toHaveAttribute(
                    "aria-valuenow",
                    "200",
                );
                expect(await widths(page, 2)).toEqual([200, 200]);
            });

            test("resizes a group's columns together with its resizer", async ({
                page,
            }) => {
                await open(page, kind, { ...RESIZE, groups: 1 });
                const group = page.locator(
                    '[data-grid-part="header-cell"][data-group]',
                    { hasText: "G0" },
                );
                await expect(group).toHaveAttribute("data-resizable", "");
                await expect(resizer(page, "G0")).toHaveAttribute(
                    "aria-valuenow",
                    "400",
                );
                // G0 holds C1–C4: the three resizable ones share the 60px
                await drag(page, "G0", 60);
                expect((await boxOf(group)).width).toBe(460);
                for (const columnIndex of [1, 2, 3]) {
                    expect(await widths(page, columnIndex)).toEqual([120, 120]);
                }
                expect(await widths(page, 4)).toEqual([100, 100]);
                await expect(resizer(page, "G0")).toHaveAttribute(
                    "aria-valuenow",
                    "460",
                );
                // a column spanning both header rows has its resizer too
                await drag(page, "c0", 20);
                expect(await widths(page, 0)).toEqual([120, 120]);
            });

            test("resizes a pinned column, which stays pinned", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    ...RESIZE,
                    pinned: 2,
                });
                await drag(page, "c1", 50);
                expect(await widths(page, 1)).toEqual([150, 150]);
                await scroll(page, viewport, 0, 400);
                const left = (await boxOf(viewport)).x;
                for (const target of [headerCell(page, 1), cell(page, 0, 1)]) {
                    const box = await boxOf(target);
                    expect(box.x).toBe(left + 100);
                    expect(box.width).toBe(150);
                }
                await expect(headerCell(page, 1)).toHaveAttribute(
                    "data-pinned-edge",
                    "",
                );
            });

            test("resizes controlled widths live, restores them on Escape and fits them on a double click", async ({
                page,
            }) => {
                await open(page, kind, { ...RESIZE, resize: "controlled" });
                // each frame asks the fixture, which follows: the column follows the pointer
                await drag(page, "c1", 50, { hold: true });
                expect(await widths(page, 1)).toEqual([150, 150]);
                await expect(resizer(page, "c1")).toHaveAttribute(
                    "aria-valuenow",
                    "150",
                );
                expect(await lastWidths(page)).toEqual({ c1: 150 });
                await page.keyboard.press("Escape");
                await settle(page);
                expect(await widths(page, 1)).toEqual([100, 100]);
                expect(await lastWidths(page)).toEqual({});
                await page.mouse.up();
                await settle(page);
                expect(await widths(page, 1)).toEqual([100, 100]);
                await drag(page, "c1", 70);
                expect(await widths(page, 1)).toEqual([170, 170]);
                expect(await lastWidths(page)).toEqual({ c1: 170 });
                await resizer(page, "c1").dblclick();
                await settle(page);
                // it fits its content (Epic #80, A4)
                const fitted = await fittedC1(page);
                expect(await widths(page, 1)).toEqual([fitted, fitted]);
                expect(await lastWidths(page)).toEqual({ c1: fitted });
            });

            test("does not sort on a press, a drag or a double click on a sortable header's resizer", async ({
                page,
            }) => {
                await open(page, kind, { ...RESIZE, sort: 1 });
                await drag(page, "c0", 40);
                await resizer(page, "c0").click();
                await resizer(page, "c1").dblclick();
                await settle(page);
                expect(await widths(page, 0)).toEqual([140, 140]);
                expect(
                    await page.evaluate(() => window.sortChanges.length),
                ).toBe(0);
                expect(await page.locator("[aria-sort]").count()).toBe(0);
            });

            test.describe("automatic widths", () => {
                // Epic #80: in an 800px view, C1 flexes one part and C2 two (60–300px); C0, C3
                // and C4 are 100px. C3 fits itself with `autosize`
                const FLEX = {
                    rows: 1_000,
                    columns: 5,
                    width: 800,
                    flex: 1,
                    resize: 1,
                };

                const viewWidth = (viewport: Locator) =>
                    viewport.evaluate((element) => element.clientWidth);

                /** The viewport's width, set as an app's layout would (its style). */
                async function setWidth(
                    page: Page,
                    viewport: Locator,
                    width: number,
                ) {
                    await viewport.evaluate((element, value) => {
                        element.style.width = `${value}px`;
                    }, width);
                    await settle(page);
                    return viewWidth(viewport);
                }

                /** The header cells' widths of the first `count` columns, in order. */
                function columnWidths(page: Page, count: number) {
                    return page
                        .locator(
                            '[data-grid-part="header-cell"]:not([data-group])',
                        )
                        .evaluateAll((cells, length) => {
                            const all = Array.from({ length }, () => 0);
                            for (const element of cells) {
                                const index = Number(
                                    element.getAttribute("data-column-index"),
                                );
                                if (index < length) {
                                    all[index] =
                                        element.getBoundingClientRect().width;
                                }
                            }
                            return all;
                        }, count);
                }

                const total = (all: number[]) =>
                    all.reduce((sum, width) => sum + width, 0);

                /**
                 * C1's and C2's widths on screen: their body cells as wide as their header
                 * cells, their handles' `aria-valuenow` the same.
                 */
                async function flexWidths(page: Page) {
                    const shown: number[] = [];
                    for (const columnIndex of [1, 2]) {
                        const [width = 0, body] = await widths(
                            page,
                            columnIndex,
                        );
                        expect(body).toBe(width);
                        await expect(
                            resizer(page, `c${columnIndex}`),
                        ).toHaveAttribute("aria-valuenow", String(width));
                        shown.push(width);
                    }
                    return shown;
                }

                test("flex columns fill the view and follow its width, never reported", async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, FLEX);
                    let view = await viewWidth(viewport);
                    // C2 stops at its 300px, C1 takes the rest
                    expect(await flexWidths(page)).toEqual([view - 600, 300]);
                    expect(total(await columnWidths(page, 5))).toBe(view);
                    view = await setWidth(page, viewport, 1_000);
                    expect(await flexWidths(page)).toEqual([view - 600, 300]);
                    expect(total(await columnWidths(page, 5))).toBe(view);
                    // narrower, still filled: a part and two, C2 under its maximum
                    view = await setWidth(page, viewport, 700);
                    const [c1 = 0, c2 = 0] = await flexWidths(page);
                    expect(c1 + c2).toBe(view - 300);
                    expect(Math.abs(c2 - 2 * c1)).toBeLessThanOrEqual(1);
                    expect(c2).toBeLessThan(300);
                    expect(total(await columnWidths(page, 5))).toBe(view);
                    // nothing left: each one its own width, and the grid scrolls
                    view = await setWidth(page, viewport, 400);
                    expect(await flexWidths(page)).toEqual([100, 100]);
                    expect(await columnWidths(page, 5)).toEqual([
                        100, 100, 100, 100, 100,
                    ]);
                    expect(
                        await viewport.evaluate(
                            (element) => element.scrollWidth,
                        ),
                    ).toBeGreaterThan(view);
                    expect(
                        await page.evaluate(() => window.widthChanges),
                    ).toEqual([]);
                });

                test("resizing a flex column makes it fixed, and a reset makes it flex again", async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, FLEX);
                    let view = await viewWidth(viewport);
                    expect(await flexWidths(page)).toEqual([view - 600, 300]);
                    await drag(page, "c1", -50);
                    expect(await flexWidths(page)).toEqual([view - 650, 300]);
                    expect(await lastWidths(page)).toEqual({ c1: view - 650 });
                    // fixed: a wider view leaves it as it is (C2 is at its maximum)
                    await setWidth(page, viewport, 1_000);
                    expect(await flexWidths(page)).toEqual([view - 650, 300]);
                    await page.evaluate(() =>
                        window.grid?.model.run("column-widths.reset", {}),
                    );
                    await settle(page);
                    view = await viewWidth(viewport);
                    expect(await flexWidths(page)).toEqual([view - 600, 300]);
                    expect(total(await columnWidths(page, 5))).toBe(view);
                    expect(await lastWidths(page)).toEqual({});
                });

                test("fits a column to its content with Enter on its focused resizer", async ({
                    page,
                }) => {
                    await open(page, kind, RESIZE);
                    await headerCell(page, 1).click({
                        position: { x: 5, y: 5 },
                    });
                    await page.keyboard.press("F2");
                    await expect(resizer(page, "c1")).toBeFocused();
                    await page.keyboard.press("Enter");
                    await settle(page);
                    const fitted = await fittedC1(page);
                    expect(await widths(page, 1)).toEqual([fitted, fitted]);
                    await expect(resizer(page, "c1")).toHaveAttribute(
                        "aria-valuenow",
                        String(fitted),
                    );
                    await expect(resizer(page, "c1")).toBeFocused();
                    expect(
                        await page.evaluate(() => window.widthChanges),
                    ).toEqual([{ c1: fitted }]);
                });

                test("fits the columns an action names, and every rendered resizable one from the app's button, each in one change", async ({
                    page,
                }) => {
                    await open(page, kind, RESIZE);
                    const fitted = await fittedC1(page);
                    // the premise: C0's and C3's content is narrower than their 40px, C2's
                    // than its 60px
                    expect(await contentWidth(page, 0)).toBeLessThan(40);
                    expect(await contentWidth(page, 2)).toBeLessThan(60);
                    expect(await contentWidth(page, 3)).toBeLessThan(40);
                    await page.evaluate(() =>
                        window.grid?.engine.run("fit-columns", {
                            columnKeys: ["c1"],
                        }),
                    );
                    await settle(page);
                    expect(await columnWidths(page, 5)).toEqual([
                        100,
                        fitted,
                        100,
                        100,
                        100,
                    ]);
                    expect(
                        await page.evaluate(() => window.widthChanges),
                    ).toEqual([{ c1: fitted }]);
                    await page.getByTestId("fit-all").click();
                    await settle(page);
                    // C4 does not resize
                    expect(await columnWidths(page, 5)).toEqual([
                        40,
                        fitted,
                        60,
                        40,
                        100,
                    ]);
                    expect(
                        await page.evaluate(() => window.widthChanges),
                    ).toEqual([
                        { c1: fitted },
                        { c0: 40, c1: fitted, c2: 60, c3: 40 },
                    ]);
                });

                test("an autoSize column fits its content at the start, and a reset gives that width back", async ({
                    page,
                }) => {
                    await open(page, kind, {
                        rows: 1_000,
                        columns: 20,
                        autosize: 1,
                        resize: 1,
                    });
                    const fitted = await contentWidth(page, 3);
                    expect(fitted).toBeGreaterThan(100);
                    expect(await widths(page, 3)).toEqual([fitted, fitted]);
                    await expect(resizer(page, "c3")).toHaveAttribute(
                        "aria-valuenow",
                        String(fitted),
                    );
                    // the grid's own width: never reported
                    expect(
                        await page.evaluate(() => window.widthChanges),
                    ).toEqual([]);
                    expect(
                        await page.evaluate(() =>
                            window.grid?.engine.get("column-auto-widths"),
                        ),
                    ).toEqual({ c3: fitted });
                    await drag(page, "c3", 40);
                    expect(await widths(page, 3)).toEqual([
                        fitted + 40,
                        fitted + 40,
                    ]);
                    await expect(resizer(page, "c3")).toHaveAttribute(
                        "aria-valuenow",
                        String(fitted + 40),
                    );
                    expect(await lastWidths(page)).toEqual({ c3: fitted + 40 });
                    await page.evaluate(() =>
                        window.grid?.model.run("column-widths.reset", {}),
                    );
                    await settle(page);
                    expect(await widths(page, 3)).toEqual([fitted, fitted]);
                    await expect(resizer(page, "c3")).toHaveAttribute(
                        "aria-valuenow",
                        String(fitted),
                    );
                    expect(await lastWidths(page)).toEqual({});
                });
            });
        });

        test.describe("column reordering", () => {
            const REORDER = { rows: 1_000, columns: 20, reorder: 1 };

            /** A column's header cell at a place (not a group's above it). */
            function headerCell(page: Page, columnIndex: number) {
                return page.locator(
                    `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]:not([data-group])`,
                );
            }

            const group = (page: Page, name: string) =>
                page.locator('[data-grid-part="header-cell"][data-group]', {
                    hasText: name,
                });

            /**
             * Which column (its declared index, from its name and its cells' values) is at each of
             * the first `count` places, in the header and in the first row.
             */
            function placed(page: Page, count: number) {
                return page.evaluate((count) => {
                    const at = (part: string, columnIndex: number) =>
                        document.querySelector(
                            `[data-grid-part="${part}"][data-column-index="${columnIndex}"]:not([data-group])${part === "cell" ? '[data-row-index="0"]' : ""}`,
                        )?.textContent ?? "";
                    const places = Array.from({ length: count }, (_, i) => i);
                    return {
                        header: places.map((i) =>
                            Number(/C(\d+)/.exec(at("header-cell", i))?.[1]),
                        ),
                        body: places.map((i) =>
                            Number(at("cell", i).split(":")[1]),
                        ),
                    };
                }, count);
            }

            /** Expects the columns at the first places, header and body alike. */
            async function expectPlaced(page: Page, columns: number[]) {
                expect(await placed(page, columns.length)).toEqual({
                    header: columns,
                    body: columns,
                });
            }

            const orderChanges = (page: Page) =>
                page.evaluate(() => window.orderChanges);

            test("moves a column dragged over another on release, the drop target marked meanwhile", async ({
                page,
            }) => {
                await open(page, kind, REORDER);
                await expect(headerCell(page, 1)).toHaveAttribute(
                    "data-reorderable",
                    "",
                );
                for (const columnIndex of [0, 6]) {
                    await expect(
                        headerCell(page, columnIndex),
                    ).not.toHaveAttribute("data-reorderable");
                }
                // C1's middle (150) to C3's second half (380): after C3
                await dragBy(page, headerCell(page, 1), 230, { hold: true });
                await expect(headerCell(page, 1)).toHaveAttribute(
                    "data-dragging",
                    "",
                );
                await expect(headerCell(page, 3)).toHaveAttribute(
                    "data-drop-target",
                    "after",
                );
                // the fixture's own CSS draws it
                await expect(headerCell(page, 3)).toHaveCSS(
                    "box-shadow",
                    /inset/,
                );
                // nothing moves before the release
                await expectPlaced(page, [0, 1, 2, 3, 4]);
                await page.mouse.up();
                await settle(page);
                await expectPlaced(page, [0, 2, 3, 1, 4]);
                expect(
                    await page
                        .locator("[data-dragging], [data-drop-target]")
                        .count(),
                ).toBe(0);
                const changes = await orderChanges(page);
                expect(changes).toHaveLength(1);
                expect(changes[0]?.slice(0, 5)).toEqual([
                    "c0",
                    "c2",
                    "c3",
                    "c1",
                    "c4",
                ]);
            });

            test("still sorts on a click, and never on a drag", async ({
                page,
            }) => {
                await open(page, kind, { ...REORDER, sort: 1 });
                await headerCell(page, 1).click({ position: { x: 5, y: 5 } });
                await expect(headerCell(page, 1)).toHaveAttribute(
                    "data-sort",
                    "ascending",
                );
                // pressed beside its button (a control never drags): from 105 to 365, after C3
                await dragBy(page, headerCell(page, 1), 260, { at: 5 });
                await expectPlaced(page, [0, 2, 3, 1, 4]);
                // the sort went with its column, and the drag's click sorted nothing
                await expect(headerCell(page, 3)).toHaveAttribute(
                    "data-sort",
                    "ascending",
                );
                expect(
                    await page.evaluate(() => window.sortChanges.length),
                ).toBe(1);
            });

            test("cancels a drag on Escape: nothing moves", async ({
                page,
            }) => {
                await open(page, kind, REORDER);
                await dragBy(page, headerCell(page, 1), 230, { hold: true });
                await expect(headerCell(page, 3)).toHaveAttribute(
                    "data-drop-target",
                    "after",
                );
                await page.keyboard.press("Escape");
                await settle(page);
                await expect(headerCell(page, 1)).not.toHaveAttribute(
                    "data-dragging",
                );
                await expect(headerCell(page, 3)).not.toHaveAttribute(
                    "data-drop-target",
                );
                // the release after Escape moves nothing
                await page.mouse.up();
                await settle(page);
                await expectPlaced(page, [0, 1, 2, 3, 4]);
                expect(await orderChanges(page)).toEqual([]);
            });

            test("moves a group as a whole, and a column only inside its group", async ({
                page,
            }) => {
                await open(page, kind, { ...REORDER, groups: 1 });
                await expect(group(page, "G0")).toHaveAttribute(
                    "data-reorderable",
                    "",
                );
                // G0 (C1–C4) from its middle (300) to C0's first half (40): before C0
                await dragBy(page, group(page, "G0"), -260);
                await expectPlaced(page, [1, 2, 3, 4, 0, 5]);
                await expect(group(page, "G0")).toHaveAttribute(
                    "data-column-index",
                    "0",
                );
                // C2 dragged far right, over G1: it stays in G0, after its last column
                await dragBy(page, headerCell(page, 1), 500);
                await expectPlaced(page, [1, 3, 4, 2, 0, 5]);
                expect(await orderChanges(page)).toHaveLength(2);
            });

            test("moves a pinned column only among the pinned ones", async ({
                page,
            }) => {
                await open(page, kind, { ...REORDER, pinned: 2 });
                await expect(headerCell(page, 0)).toHaveAttribute(
                    "data-reorderable",
                    "",
                );
                // C0 dragged far right: after C1, the last pinned one
                await dragBy(page, headerCell(page, 0), 400);
                await expectPlaced(page, [1, 0, 2, 3]);
                await expect(headerCell(page, 1)).toHaveAttribute(
                    "data-pinned-edge",
                    "",
                );
                // C2 dragged over the pinned ones: it lands nowhere among them
                await dragBy(page, headerCell(page, 2), -200);
                await expectPlaced(page, [1, 0, 2, 3]);
                expect(await orderChanges(page)).toHaveLength(1);
            });

            test("scrolls to a far column while held at the view's edge", async ({
                page,
            }) => {
                const viewport = await open(page, kind, REORDER);
                await dragBy(page, headerCell(page, 1), 100, { hold: true });
                const box = await boxOf(viewport);
                const clientWidth = await viewport.evaluate(
                    (element) => element.clientWidth,
                );
                const end = await viewport.evaluate(
                    (element) => element.scrollWidth - element.clientWidth,
                );
                await page.mouse.move(box.x + clientWidth - 5, box.y + 10, {
                    steps: 5,
                });
                await expect
                    .poll(() =>
                        viewport.evaluate((element) => element.scrollLeft),
                    )
                    .toBe(end);
                await expect(headerCell(page, 19)).toHaveAttribute(
                    "data-drop-target",
                    "after",
                );
                await page.mouse.up();
                await settle(page);
                expect((await orderChanges(page)).at(-1)?.at(-1)).toBe("c1");
                await expect(cell(page, 0, 19)).toHaveText("0:1");
                await expect(headerCell(page, 19)).toHaveText("C1");
            });

            test("moves the active header cell's column with Ctrl/⌘+Shift+←/→, focus following", async ({
                page,
            }) => {
                await open(page, kind, REORDER);
                await headerCell(page, 2).focus();
                await page.keyboard.press("ControlOrMeta+Shift+ArrowRight");
                await settle(page);
                await expectPlaced(page, [0, 1, 3, 2, 4]);
                expect(await focused(page)).toMatchObject({
                    row: "-1",
                    column: "3",
                });
                expect(await active(page)).toEqual({
                    rowIndex: -1,
                    columnIndex: 3,
                });
                await page.keyboard.press("ControlOrMeta+Shift+ArrowLeft");
                await page.keyboard.press("ControlOrMeta+Shift+ArrowLeft");
                await settle(page);
                await expectPlaced(page, [0, 2, 1, 3, 4]);
                expect(await focused(page)).toMatchObject({
                    row: "-1",
                    column: "1",
                });
                expect(await orderChanges(page)).toHaveLength(3);
            });

            test("moves a controlled order, by a drag and by the keys", async ({
                page,
            }) => {
                await open(page, kind, { ...REORDER, reorder: "controlled" });
                await dragBy(page, headerCell(page, 1), 230);
                await expectPlaced(page, [0, 2, 3, 1, 4]);
                // the pressed header cell is the active one: it followed its column
                await expect(headerCell(page, 3)).toBeFocused();
                await page.keyboard.press("ControlOrMeta+Shift+ArrowRight");
                await settle(page);
                await expectPlaced(page, [0, 2, 3, 4, 1]);
                await expect(headerCell(page, 4)).toBeFocused();
                const changes = await orderChanges(page);
                expect(changes).toHaveLength(2);
                expect(changes[1]?.slice(0, 5)).toEqual([
                    "c0",
                    "c2",
                    "c3",
                    "c4",
                    "c1",
                ]);
            });
        });

        // Epic #85 (E1.1): columns pinned at the end, and the grid right to left. Offsets are
        // inline: from the view's start, its left edge, or right to left its right edge
        test.describe("pinned end columns and direction", () => {
            /** The viewport's content box: its inline edges, inside the border and a scrollbar. */
            function viewEdges(viewport: Locator) {
                return viewport.evaluate((element) => {
                    const left =
                        element.getBoundingClientRect().left +
                        element.clientLeft;
                    return {
                        left,
                        right: left + element.clientWidth,
                        width: element.clientWidth,
                    };
                });
            }

            /** An element's start from the view's start, and its width. */
            async function inlineBox(
                viewport: Locator,
                target: Locator,
                rtl: boolean,
            ) {
                const view = await viewEdges(viewport);
                const box = await boxOf(target);
                return {
                    start: rtl
                        ? view.right - (box.x + box.width)
                        : box.x - view.left,
                    width: box.width,
                };
            }

            const startOf = async (
                viewport: Locator,
                target: Locator,
                rtl: boolean,
            ) => (await inlineBox(viewport, target, rtl)).start;

            /** A native scroll from the start (negative `scrollLeft` right to left). */
            async function scrollInline(
                page: Page,
                viewport: Locator,
                inline: number | "end",
                rtl: boolean,
                top = 0,
            ) {
                await viewport.evaluate(
                    (element, [x, y, mirrored]) => {
                        const to = x === "end" ? element.scrollWidth : x;
                        element.scrollTop = y;
                        element.scrollLeft = mirrored ? -to : to;
                    },
                    [inline, top, rtl] as const,
                );
                await settle(page);
            }

            const scrollFromStart = (viewport: Locator, rtl: boolean) =>
                viewport.evaluate(
                    // + 0: a scroll of 0 right to left reads -0
                    (element, mirrored) =>
                        (mirrored ? -1 : 1) * element.scrollLeft + 0,
                    rtl,
                );

            function headerCell(
                page: Page,
                rowIndex: number,
                columnIndex: number,
            ) {
                return page.locator(
                    `[data-grid-part="header-cell"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
                );
            }

            /** A column's header cell (not a group's above it). */
            function columnHeader(page: Page, columnIndex: number) {
                return page.locator(
                    `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]:not([data-group])`,
                );
            }

            /**
             * Scrolls by `delta` from where the view is and reads the elements' starts in the same
             * task, before any `scroll` listener runs: what a frame painted before the engine's
             * JavaScript shows. `fired` tells whether a scroll listener ran meanwhile.
             */
            function startsBeforeTheScrollEvent(
                viewport: Locator,
                delta: number,
                selectors: readonly string[],
                rtl: boolean,
            ) {
                return viewport.evaluate(
                    (element, [by, targets, mirrored]) => {
                        let fired = false;
                        const onScroll = () => {
                            fired = true;
                        };
                        element.addEventListener("scroll", onScroll);
                        element.scrollLeft += mirrored ? -by : by;
                        const rect = element.getBoundingClientRect();
                        const left = rect.left + element.clientLeft;
                        const right = left + element.clientWidth;
                        const starts = targets.map((selector) => {
                            const target = element.querySelector(selector);
                            if (!target) throw new Error(`no ${selector}`);
                            const box = target.getBoundingClientRect();
                            return mirrored
                                ? right - box.right
                                : box.left - left;
                        });
                        element.removeEventListener("scroll", onScroll);
                        return { starts, fired };
                    },
                    [delta, selectors, rtl] as const,
                );
            }

            const BOTH = {
                rows: 1_000,
                columns: 60,
                pinned: 2,
                pinnedEnd: 2,
            } as const;

            for (const dir of ["ltr", "rtl"] as const) {
                const rtl = dir === "rtl";
                const suffix = rtl ? ", right to left" : "";
                const open2 = (
                    page: Page,
                    query: Record<string, string | number>,
                ) => open(page, kind, rtl ? { ...query, dir } : query);

                test(`keeps both pinned parts and their header cells in place while scrolling sideways${suffix}`, async ({
                    page,
                }) => {
                    const viewport = await open2(page, BOTH);
                    const { width } = await viewEdges(viewport);
                    if (rtl) {
                        await expect(viewport).toHaveAttribute("dir", "rtl");
                    }
                    for (const inline of [0, 1_234, "end"] as const) {
                        await scrollInline(page, viewport, inline, rtl, 32 * 5);
                        const at = {
                            0: 0,
                            1: 100,
                            58: width - 200,
                            59: width - 100,
                        } as const;
                        for (const [columnIndex, start] of Object.entries(at)) {
                            const index = Number(columnIndex);
                            expect(
                                await startOf(
                                    viewport,
                                    cell(page, 6, index),
                                    rtl,
                                ),
                                `cell ${index} at ${inline}`,
                            ).toBeCloseTo(start, 0);
                            expect(
                                await startOf(
                                    viewport,
                                    headerCell(page, -1, index),
                                    rtl,
                                ),
                                `header ${index} at ${inline}`,
                            ).toBeCloseTo(start, 0);
                        }
                    }
                    // the last column that scrolls ends where the end part starts
                    const last = await inlineBox(
                        viewport,
                        cell(page, 6, 57),
                        rtl,
                    );
                    expect(last.start + last.width).toBeCloseTo(width - 200, 0);
                    await expect(cell(page, 6, 58)).toHaveAttribute(
                        "data-pinned",
                        "end",
                    );
                    await expect(cell(page, 6, 58)).toHaveAttribute(
                        "data-pinned-edge",
                        "",
                    );
                    await expect(cell(page, 6, 59)).not.toHaveAttribute(
                        "data-pinned-edge",
                    );
                    await expect(cell(page, 6, 0)).toHaveAttribute(
                        "data-pinned",
                        "start",
                    );
                    await expect(cell(page, 6, 59)).toHaveAttribute(
                        "aria-colindex",
                        "60",
                    );
                });

                const TARGETS = [0, 58, 59].flatMap((columnIndex) => [
                    `[data-grid-part="cell"][data-row-index="6"][data-column-index="${columnIndex}"]`,
                    `[data-grid-part="header-cell"][data-row-index="-1"][data-column-index="${columnIndex}"]`,
                ]);

                test(`has both pinned parts in place before the scroll event runs${suffix}`, async ({
                    page,
                }) => {
                    const viewport = await open2(page, BOTH);
                    const { width } = await viewEdges(viewport);
                    await scrollInline(page, viewport, 1_000, rtl, 32 * 5);
                    const expected = [
                        0,
                        0,
                        width - 200,
                        width - 200,
                        width - 100,
                        width - 100,
                    ];
                    // small moves both ways, and one past a column
                    for (const delta of [40, -40, 130]) {
                        const { starts, fired } =
                            await startsBeforeTheScrollEvent(
                                viewport,
                                delta,
                                TARGETS,
                                rtl,
                            );
                        expect(fired).toBe(false);
                        for (const [index, value] of starts.entries()) {
                            expect(
                                value,
                                `${TARGETS[index]} by ${delta}`,
                            ).toBeCloseTo(expected[index] ?? 0, 0);
                        }
                        await settle(page);
                    }
                });

                test(`keeps both pinned parts in place under scaled column scroll${suffix}`, async ({
                    page,
                }) => {
                    const viewport = await open2(page, {
                        rows: 100,
                        columns: 1_000_000,
                        maxScrollSize: 1_000_000,
                        pinned: 1,
                        pinnedEnd: 1,
                    });
                    const { width } = await viewEdges(viewport);
                    for (const inline of [0, 333_333, "end"] as const) {
                        await scrollInline(page, viewport, inline, rtl);
                        expect(
                            await startOf(viewport, cell(page, 0, 0), rtl),
                        ).toBeCloseTo(0, 0);
                        expect(
                            await startOf(
                                viewport,
                                cell(page, 0, 999_999),
                                rtl,
                            ),
                        ).toBeCloseTo(width - 100, 0);
                        expect(
                            await startOf(
                                viewport,
                                headerCell(page, -1, 999_999),
                                rtl,
                            ),
                        ).toBeCloseTo(width - 100, 0);
                    }
                    // small physical moves, before the scroll event
                    const { starts, fired } = await startsBeforeTheScrollEvent(
                        viewport,
                        -3,
                        [
                            '[data-grid-part="cell"][data-row-index="0"][data-column-index="0"]',
                            '[data-grid-part="cell"][data-row-index="0"][data-column-index="999999"]',
                        ],
                        rtl,
                    );
                    expect(fired).toBe(false);
                    expect(starts[0]).toBeCloseTo(0, 0);
                    expect(starts[1]).toBeCloseTo(width - 100, 0);
                });

                test(`brings a cell into view between the pinned parts, from the keyboard${suffix}`, async ({
                    page,
                }) => {
                    const viewport = await open2(page, BOTH);
                    const { width } = await viewEdges(viewport);
                    const [next, previous] = rtl
                        ? ["ArrowLeft", "ArrowRight"]
                        : ["ArrowRight", "ArrowLeft"];
                    await cell(page, 3, 1).click();
                    await page.keyboard.press(next);
                    await settle(page);
                    await expect(cell(page, 3, 2)).toBeFocused();
                    expect(
                        await startOf(viewport, cell(page, 3, 2), rtl),
                    ).toBeCloseTo(200, 0);
                    await page.keyboard.press("End");
                    await settle(page);
                    await expect(cell(page, 3, 59)).toBeFocused();
                    expect(
                        await startOf(viewport, cell(page, 3, 59), rtl),
                    ).toBeCloseTo(width - 100, 0);
                    await page.keyboard.press(previous);
                    await page.keyboard.press(previous);
                    await settle(page);
                    await expect(cell(page, 3, 57)).toBeFocused();
                    // the last column that scrolls, whole, before the end part
                    const box = await inlineBox(
                        viewport,
                        cell(page, 3, 57),
                        rtl,
                    );
                    expect(box.start + box.width).toBeLessThanOrEqual(
                        width - 200 + 0.5,
                    );
                    expect(box.start).toBeGreaterThanOrEqual(200 - 0.5);
                    await page.keyboard.press("Home");
                    await settle(page);
                    await expect(cell(page, 3, 0)).toBeFocused();
                    expect(
                        await startOf(viewport, cell(page, 3, 0), rtl),
                    ).toBeCloseTo(0, 0);
                });

                test(`keeps a group pinned at the end over its columns${suffix}`, async ({
                    page,
                }) => {
                    // 20 columns: C0, G0 (C1–C4), G1 (C5–C16), G2 (C17–C19) pinned at the end
                    const viewport = await open2(page, {
                        rows: 1_000,
                        columns: 20,
                        groups: 1,
                        pinnedEnd: 3,
                    });
                    const { width } = await viewEdges(viewport);
                    await scrollInline(page, viewport, 700, rtl);
                    const group = await inlineBox(
                        viewport,
                        headerCell(page, -2, 17),
                        rtl,
                    );
                    expect(group.start).toBeCloseTo(width - 300, 0);
                    expect(group.width).toBeCloseTo(300, 0);
                    await expect(headerCell(page, -2, 17)).toHaveAttribute(
                        "data-pinned-edge",
                        "",
                    );
                    expect(
                        await startOf(viewport, columnHeader(page, 19), rtl),
                    ).toBeCloseTo(width - 100, 0);
                });

                test(`does not render React while scrolling sideways inside the overscan, with both pinned parts${suffix}`, async ({
                    page,
                }) => {
                    const viewport = await open2(page, BOTH);
                    const { width } = await viewEdges(viewport);
                    await scrollInline(page, viewport, 1_000, rtl);
                    const before = await page.evaluate(() => window.commits);
                    await scrollInline(page, viewport, 1_040, rtl);
                    expect(await page.evaluate(() => window.commits)).toBe(
                        before,
                    );
                    expect(
                        await startOf(viewport, cell(page, 0, 59), rtl),
                    ).toBeCloseTo(width - 100, 0);
                });

                for (const [name, query] of [
                    ["at the end", { columns: 3, pinnedEnd: 3 }],
                    ["at both ends", { columns: 4, pinned: 2, pinnedEnd: 2 }],
                ] as const) {
                    test(`lays every column out where it is, all of them pinned ${name}${suffix}`, async ({
                        page,
                    }) => {
                        const viewport = await open2(page, {
                            rows: 100,
                            ...query,
                        });
                        for (let i = 0; i < query.columns; i++) {
                            expect(
                                await startOf(viewport, cell(page, 2, i), rtl),
                                `cell ${i}`,
                            ).toBeCloseTo(i * 100, 0);
                            expect(
                                await startOf(
                                    viewport,
                                    columnHeader(page, i),
                                    rtl,
                                ),
                                `header ${i}`,
                            ).toBeCloseTo(i * 100, 0);
                        }
                        await expect(
                            cell(page, 2, query.columns - 1),
                        ).toHaveAttribute("data-pinned", "end");
                    });
                }

                test(`shows the columns pinned at the end where the columns end in a narrower grid${suffix}`, async ({
                    page,
                }) => {
                    const viewport = await open2(page, {
                        rows: 100,
                        columns: 5,
                        pinnedEnd: 1,
                    });
                    expect(
                        await startOf(viewport, cell(page, 0, 4), rtl),
                    ).toBeCloseTo(400, 0);
                    expect(
                        await startOf(viewport, columnHeader(page, 4), rtl),
                    ).toBeCloseTo(400, 0);
                });

                test(`resizes and reorders the columns pinned at the end, among themselves${suffix}`, async ({
                    page,
                }) => {
                    const viewport = await open2(page, {
                        rows: 1_000,
                        columns: 20,
                        pinnedEnd: 2,
                        resize: 1,
                        reorder: 1,
                    });
                    const { width } = await viewEdges(viewport);
                    // its handle is at its start edge, the boundary with the columns that
                    // scroll: dragged toward the start, it grows, the edge under the pointer
                    const handle = page.getByTestId("resizer-c18");
                    expect(await startOf(viewport, handle, rtl)).toBeCloseTo(
                        width - 200,
                        0,
                    );
                    await dragBy(page, handle, rtl ? 40 : -40);
                    const resized = await inlineBox(
                        viewport,
                        columnHeader(page, 18),
                        rtl,
                    );
                    expect(resized.width).toBeCloseTo(140, 0);
                    expect(resized.start).toBeCloseTo(width - 240, 0);
                    expect(await startOf(viewport, handle, rtl)).toBeCloseTo(
                        width - 240,
                        0,
                    );
                    expect(
                        await startOf(viewport, cell(page, 0, 19), rtl),
                    ).toBeCloseTo(width - 100, 0);
                    expect(
                        await page.evaluate(() => window.widthChanges.at(-1)),
                    ).toEqual({ c18: 140 });
                    // a double click fits it to its content, within its minimum
                    const fitted = Math.max(40, await contentWidth(page, 18));
                    await page.getByTestId("resizer-c18").dblclick();
                    await settle(page);
                    expect(
                        (await inlineBox(viewport, columnHeader(page, 18), rtl))
                            .width,
                    ).toBeCloseTo(fitted, 0);
                    expect(
                        await startOf(viewport, cell(page, 0, 19), rtl),
                    ).toBeCloseTo(width - 100, 0);
                    // C19 dropped before C18: they swap
                    await dragBy(
                        page,
                        columnHeader(page, 19),
                        rtl ? 130 : -130,
                    );
                    await expect(columnHeader(page, 18)).toHaveText("C19");
                    await expect(cell(page, 0, 18)).toHaveText("0:19");
                    // and a column of the end part held over one that scrolls lands nowhere
                    const changes = (
                        await page.evaluate(() => window.orderChanges)
                    ).length;
                    await dragBy(
                        page,
                        columnHeader(page, 18),
                        rtl ? 300 : -300,
                    );
                    expect(
                        (await page.evaluate(() => window.orderChanges)).length,
                    ).toBe(changes);
                    await expect(columnHeader(page, 18)).toHaveText("C19");
                });

                test(`keeps a detail as wide as the view with both pinned parts${suffix}`, async ({
                    page,
                }) => {
                    const viewport = await open2(page, {
                        rows: 1_000,
                        columns: 40,
                        details: 1,
                        pinned: 2,
                        pinnedEnd: 2,
                    });
                    const { width } = await viewEdges(viewport);
                    await page.getByTestId("expand-1").click();
                    await settle(page);
                    const detail = page.locator(
                        '[data-grid-part="row-detail"][data-row-index="1"]',
                    );
                    for (const inline of [0, 1_234, "end", 450] as const) {
                        await scrollInline(page, viewport, inline, rtl);
                        const box = await inlineBox(viewport, detail, rtl);
                        expect(box.start, `at ${inline}`).toBeCloseTo(0, 0);
                        expect(box.width).toBeCloseTo(width, 0);
                        expect(
                            await startOf(
                                viewport,
                                page
                                    .locator(
                                        '[data-grid-part="cell"][data-row-index="1"][data-column-index="39"]',
                                    )
                                    .filter({ hasText: "1:39" }),
                                rtl,
                            ),
                        ).toBeCloseTo(width - 100, 0);
                    }
                });
            }

            test.describe("right to left", () => {
                const RTL = { dir: "rtl" } as const;

                test("takes the page's direction without one of its own, adding no dir", async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, {
                        rows: 1_000,
                        columns: 60,
                        pinned: 1,
                        pinnedEnd: 1,
                        pageDir: "rtl",
                    });
                    const { width } = await viewEdges(viewport);
                    await expect(viewport).not.toHaveAttribute("dir");
                    expect(
                        await startOf(viewport, cell(page, 0, 0), true),
                    ).toBeCloseTo(0, 0);
                    expect(
                        await startOf(viewport, cell(page, 0, 59), true),
                    ).toBeCloseTo(width - 100, 0);
                    await scrollInline(page, viewport, 1_000, true);
                    expect(
                        await page.evaluate(
                            () =>
                                window.grid?.engine.get("scroll-position").left,
                        ),
                    ).toBe(1_000);
                    // the arrows mirrored: from the pinned C0, ArrowLeft to C1, into view
                    await cell(page, 3, 0).click();
                    await page.keyboard.press("ArrowLeft");
                    await expect(cell(page, 3, 1)).toBeFocused();
                    await settle(page);
                    expect(
                        await startOf(viewport, cell(page, 3, 1), true),
                    ).toBeCloseTo(100, 0);
                });

                test("lays the grid out from the right edge, its ARIA unchanged, its scroll negative", async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, {
                        rows: 1_000,
                        columns: 60,
                        ...RTL,
                    });
                    await expect(viewport).toHaveAttribute("dir", "rtl");
                    expect(
                        await startOf(viewport, cell(page, 0, 0), true),
                    ).toBeCloseTo(0, 0);
                    expect(
                        await startOf(viewport, columnHeader(page, 1), true),
                    ).toBeCloseTo(100, 0);
                    await expect(cell(page, 0, 1)).toHaveAttribute(
                        "aria-colindex",
                        "2",
                    );
                    await scrollInline(page, viewport, 1_000, true);
                    expect(
                        await viewport.evaluate(
                            (element) => element.scrollLeft,
                        ),
                    ).toBe(-1_000);
                    const { columns } = await windows(page);
                    expect(columns.visible.start).toBe(10);
                    expect(
                        await startOf(viewport, cell(page, 0, 12), true),
                    ).toBeCloseTo(200, 0);
                    expect(
                        await page.evaluate(
                            () =>
                                window.grid?.engine.get("scroll-position").left,
                        ),
                    ).toBe(1_000);
                });

                test("reaches the far end and back under scaled column scroll", async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, {
                        rows: 100,
                        columns: 1_000_000,
                        maxScrollSize: 1_000_000,
                        ...RTL,
                    });
                    const { width } = await viewEdges(viewport);
                    await scrollInline(page, viewport, "end", true);
                    // the last column at the view's left end
                    const last = await inlineBox(
                        viewport,
                        cell(page, 0, 999_999),
                        true,
                    );
                    expect(last.start + last.width).toBeCloseTo(width, 0);
                    await expect(cell(page, 0, 999_999)).toHaveAttribute(
                        "aria-colindex",
                        "1000000",
                    );
                    await cell(page, 0, 999_999).click();
                    await page.keyboard.press("ArrowRight");
                    await settle(page);
                    await expect(cell(page, 0, 999_998)).toBeFocused();
                    await page.keyboard.press("Control+Home");
                    await settle(page);
                    expect(await scrollFromStart(viewport, true)).toBe(0);
                    expect(
                        await startOf(viewport, cell(page, 0, 0), true),
                    ).toBeCloseTo(0, 0);
                    // a small move by the wheel moves the content by exactly its delta
                    await page.mouse.move(400, 300);
                    await page.mouse.wheel(-120, 0);
                    await settle(page);
                    expect(
                        await page.evaluate(
                            () =>
                                window.grid?.engine.get("scroll-position").left,
                        ),
                    ).toBe(120);
                    expect(
                        await startOf(viewport, cell(page, 0, 2), true),
                    ).toBeCloseTo(80, 0);
                });

                test("moves with the arrows mirrored: ArrowLeft to the next column", async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, {
                        rows: 1_000,
                        columns: 20,
                        ...RTL,
                    });
                    await cell(page, 3, 1).click();
                    await page.keyboard.press("ArrowLeft");
                    await expect(cell(page, 3, 2)).toBeFocused();
                    await page.keyboard.press("ArrowRight");
                    await page.keyboard.press("ArrowRight");
                    await expect(cell(page, 3, 0)).toBeFocused();
                    await page.keyboard.press("End");
                    await settle(page);
                    await expect(cell(page, 3, 19)).toBeFocused();
                    await expectFullyInBody(viewport, cell(page, 3, 19));
                    expect(
                        await scrollFromStart(viewport, true),
                    ).toBeGreaterThan(0);
                    await page.keyboard.press("Home");
                    await settle(page);
                    await expect(cell(page, 3, 0)).toBeFocused();
                    expect(await scrollFromStart(viewport, true)).toBe(0);
                });

                test("resizes a column dragged toward the end, to the left", async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, {
                        rows: 1_000,
                        columns: 20,
                        resize: 1,
                        ...RTL,
                    });
                    await dragBy(page, page.getByTestId("resizer-c0"), -60, {
                        hold: true,
                    });
                    const c0 = await inlineBox(
                        viewport,
                        columnHeader(page, 0),
                        true,
                    );
                    expect(c0.width).toBeCloseTo(160, 0);
                    expect(
                        await startOf(viewport, cell(page, 0, 1), true),
                    ).toBeCloseTo(160, 0);
                    await page.mouse.up();
                    await settle(page);
                    expect(
                        await page.evaluate(() => window.widthChanges.at(-1)),
                    ).toEqual({ c0: 160 });
                    // the arrows on its focused handle: ArrowLeft grows it
                    await page.getByTestId("resizer-c0").focus();
                    await page.keyboard.press("ArrowLeft");
                    await settle(page);
                    expect(
                        await page.evaluate(() => window.widthChanges.at(-1)),
                    ).toEqual({ c0: 170 });
                });

                test("moves a column dropped toward the end, and scrolls held at the left edge", async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, {
                        rows: 1_000,
                        columns: 20,
                        reorder: 1,
                        ...RTL,
                    });
                    // C1's middle (150 from the right) to C3's second half (380): after C3
                    await dragBy(page, columnHeader(page, 1), -230, {
                        hold: true,
                    });
                    await expect(columnHeader(page, 3)).toHaveAttribute(
                        "data-drop-target",
                        "after",
                    );
                    await page.mouse.up();
                    await settle(page);
                    await expect(columnHeader(page, 3)).toHaveText("C1");
                    await expect(cell(page, 0, 1)).toHaveText("0:2");
                    // held near the left edge, the columns scroll toward the end
                    await dragBy(page, columnHeader(page, 2), -50, {
                        hold: true,
                    });
                    const view = await viewEdges(viewport);
                    const box = await boxOf(viewport);
                    await page.mouse.move(view.left + 5, box.y + 10, {
                        steps: 5,
                    });
                    await expect
                        .poll(() => scrollFromStart(viewport, true))
                        .toBeGreaterThan(500);
                    await page.mouse.up();
                    await settle(page);
                });

                test("fills the view with flex columns and fits one to its content", async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, {
                        rows: 1_000,
                        columns: 5,
                        width: 800,
                        flex: 1,
                        resize: 1,
                        ...RTL,
                    });
                    const { width } = await viewEdges(viewport);
                    const c2 = await inlineBox(
                        viewport,
                        columnHeader(page, 2),
                        true,
                    );
                    expect(c2.width).toBeCloseTo(300, 0);
                    // the last column ends at the view's left end
                    const c4 = await inlineBox(
                        viewport,
                        columnHeader(page, 4),
                        true,
                    );
                    expect(c4.start + c4.width).toBeCloseTo(width, 0);
                    // within its minimum (40 by default)
                    const fitted = Math.max(40, await contentWidth(page, 0));
                    await page.getByTestId("resizer-c0").dblclick();
                    await settle(page);
                    expect(
                        (await inlineBox(viewport, columnHeader(page, 0), true))
                            .width,
                    ).toBeCloseTo(fitted, 0);
                });

                test("lays column groups over their columns, from the right", async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, {
                        rows: 1_000,
                        columns: 40,
                        groups: 1,
                        ...RTL,
                    });
                    const g0 = await inlineBox(
                        viewport,
                        headerCell(page, -2, 1),
                        true,
                    );
                    expect(g0.start).toBeCloseTo(100, 0);
                    expect(g0.width).toBeCloseTo(400, 0);
                    // a group cut by the view keeps its columns under it
                    await scrollInline(page, viewport, 900, true);
                    const g1 = await inlineBox(
                        viewport,
                        headerCell(page, -2, 5),
                        true,
                    );
                    expect(g1.start + g1.width).toBeCloseTo(
                        (await startOf(
                            viewport,
                            columnHeader(page, 16),
                            true,
                        )) + 100,
                        0,
                    );
                    await columnHeader(page, 10).click();
                    await page.keyboard.press("ArrowUp");
                    await expect(headerCell(page, -2, 5)).toBeFocused();
                });
            });
        });

        test.describe("column spans", () => {
            const SPAN = { rows: 1_000, columns: 20, span: 1 } as const;

            /** An element's start from the view's inline start (its right edge right to left), and its width. */
            async function inlineBox(
                viewport: Locator,
                target: Locator,
                rtl = false,
            ) {
                const view = await viewport.evaluate((element) => {
                    const left =
                        element.getBoundingClientRect().left +
                        element.clientLeft;
                    return { left, right: left + element.clientWidth };
                });
                const box = await boxOf(target);
                return {
                    start: rtl
                        ? view.right - (box.x + box.width)
                        : box.x - view.left,
                    width: box.width,
                };
            }

            function columnHeader(page: Page, columnIndex: number) {
                return page.locator(
                    `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]`,
                );
            }

            for (const dir of ["ltr", "rtl"] as const) {
                const rtl = dir === "rtl";
                test(`renders a span as wide as its columns, without the cells it covers${rtl ? ", right to left" : ""}`, async ({
                    page,
                }) => {
                    const viewport = await open(
                        page,
                        kind,
                        rtl ? { ...SPAN, dir } : SPAN,
                    );
                    const span = cell(page, 0, 1);
                    await expect(span).toHaveAttribute("aria-colspan", "3");
                    await expect(span).toHaveAttribute("aria-colindex", "2");
                    if (kind === "table") {
                        await expect(span).toHaveAttribute("colspan", "3");
                    }
                    const box = await inlineBox(viewport, span, rtl);
                    expect(box.start).toBeCloseTo(100, 0);
                    expect(box.width).toBeCloseTo(300, 0);
                    await expect(cell(page, 0, 2)).toHaveCount(0);
                    await expect(cell(page, 0, 3)).toHaveCount(0);
                    expect(
                        (await inlineBox(viewport, cell(page, 0, 4), rtl))
                            .start,
                    ).toBeCloseTo(400, 0);
                    // the next row spans nothing
                    await expect(cell(page, 1, 2)).toHaveCount(1);
                    await expect(cell(page, 1, 1)).not.toHaveAttribute(
                        "aria-colspan",
                    );
                    // C5's header cell covers C6's
                    const c5 = columnHeader(page, 5);
                    await expect(c5).toHaveAttribute("aria-colspan", "2");
                    if (kind === "table") {
                        await expect(c5).toHaveAttribute("colspan", "2");
                    }
                    expect(
                        (await inlineBox(viewport, c5, rtl)).width,
                    ).toBeCloseTo(200, 0);
                    await expect(columnHeader(page, 6)).toHaveCount(0);
                });
            }

            test("renders a span that starts left of the rendered columns", async ({
                page,
            }) => {
                const viewport = await open(page, kind, SPAN);
                // C5 at the view's start: C3 and C4 rendered before it (the overscan), C1 not
                await scroll(page, viewport, 0, 500);
                const { columns } = await windows(page);
                expect(columns.rendered.start).toBe(3);
                await expect(cell(page, 1, 1)).toHaveCount(0);
                const span = cell(page, 0, 1);
                await expect(span).toHaveCount(1);
                const box = await boxOf(span);
                const c4 = await boxOf(cell(page, 1, 4));
                expect(box.x + box.width).toBeCloseTo(c4.x, 0);
                expect(box.width).toBeCloseTo(300, 0);
            });

            test("lands on a span with the keys, leaves it from its edge, and snaps to its first column", async ({
                page,
            }) => {
                await open(page, kind, SPAN);
                await cell(page, 0, 0).click();
                await page.keyboard.press("ArrowRight");
                await expect(cell(page, 0, 1)).toBeFocused();
                expect(await active(page)).toEqual({
                    rowIndex: 0,
                    columnIndex: 1,
                });
                await page.keyboard.press("ArrowRight");
                await expect(cell(page, 0, 4)).toBeFocused();
                await page.keyboard.press("ArrowLeft");
                await expect(cell(page, 0, 1)).toBeFocused();
                await page.keyboard.press("ArrowDown");
                await expect(cell(page, 1, 1)).toBeFocused();
                await cell(page, 1, 3).click();
                await page.keyboard.press("ArrowUp");
                await expect(cell(page, 0, 1)).toBeFocused();
                // a covered position is the span's
                await page.evaluate(() =>
                    window.grid?.model.run("active-position.set", {
                        rowIndex: 5,
                        columnIndex: 3,
                    }),
                );
                expect(await active(page)).toEqual({
                    rowIndex: 5,
                    columnIndex: 1,
                });
                await expect(cell(page, 5, 1)).toHaveAttribute(
                    "data-active",
                    "",
                );
                await expect(cell(page, 5, 1)).toHaveAttribute("tabindex", "0");
                // the header: C6 is C5's cell
                await page.evaluate(() =>
                    window.grid?.model.run("active-position.set", {
                        rowIndex: -1,
                        columnIndex: 6,
                    }),
                );
                await expect(columnHeader(page, 5)).toBeFocused();
                await page.keyboard.press("ArrowRight");
                await expect(columnHeader(page, 7)).toBeFocused();
            });

            test("keeps a span inside its pinned part", async ({ page }) => {
                // C0–C2 pinned at the start: C1 covers C2 only; the last column pinned at the
                // end: C18 covers nothing
                const viewport = await open(page, kind, {
                    ...SPAN,
                    pinned: 3,
                    pinnedEnd: 1,
                });
                const span = cell(page, 0, 1);
                await expect(span).toHaveAttribute("aria-colspan", "2");
                await expect(span).toHaveAttribute("data-pinned", "start");
                await expect(span).toHaveAttribute("data-pinned-edge", "");
                expect((await boxOf(span)).width).toBeCloseTo(200, 0);
                await expect(cell(page, 0, 3)).toHaveCount(1);
                await scroll(page, viewport, 0, "end");
                await expect(cell(page, 0, 18)).not.toHaveAttribute(
                    "aria-colspan",
                );
                await expect(cell(page, 0, 19)).toHaveAttribute(
                    "data-pinned",
                    "end",
                );
                // both pinned at the end: C18 covers C19, at the view's end
                await open(page, kind, { ...SPAN, pinnedEnd: 2 });
                const end = cell(page, 0, 18);
                await expect(end).toHaveAttribute("aria-colspan", "2");
                await expect(end).toHaveAttribute("data-pinned", "end");
                const box = await inlineBox(viewport, end);
                expect(box.width).toBeCloseTo(200, 0);
                expect(box.start + box.width).toBeCloseTo(
                    await viewport.evaluate((element) => element.clientWidth),
                    0,
                );
                // sideways, it stays there
                await scroll(page, viewport, 0, 700);
                const moved = await inlineBox(viewport, end);
                expect(moved.start).toBeCloseTo(box.start, 0);
            });
        });

        test.describe("collapsible groups and sticky labels", () => {
            // 60 columns under groups: G1 (C5–C16) collapses to C5 and C16, expanded C5–C15
            const COLLAPSIBLE = {
                rows: 1_000,
                columns: 60,
                groups: 1,
                collapsible: 1,
            } as const;
            const LABELS = { ...COLLAPSIBLE, stickyLabels: 1 } as const;

            const groupCell = (page: Page, columnIndex: number) =>
                page.locator(
                    `[data-grid-part="header-cell"][data-group][data-column-index="${columnIndex}"]`,
                );
            const columnHeader = (page: Page, columnIndex: number) =>
                page.locator(
                    `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]:not([data-group])`,
                );
            const toggleG1 = (page: Page) =>
                page.evaluate(() =>
                    window.grid?.model.run("column-groups.toggle", {
                        groupKey: "G1",
                    }),
                );

            test("toggles a group from its toggle and by command, its columns following", async ({
                page,
            }) => {
                await open(page, kind, COLLAPSIBLE);
                const g1 = groupCell(page, 5);
                await expect(g1).toHaveAttribute("data-collapsible", "");
                await expect(g1).not.toHaveAttribute("data-collapsed");
                await expect(g1).toHaveAttribute("aria-colspan", "11");
                await expect(columnHeader(page, 6)).toHaveText("C6");
                await expect(page.getByRole("grid")).toHaveAttribute(
                    "aria-colcount",
                    "56",
                );
                const toggle = page.getByTestId("toggle-G1");
                await expect(toggle).toHaveAttribute("aria-expanded", "true");
                // a table centres it in its 1,100px cell: the click scrolls it into view first
                await toggle.click();
                await expect(g1).toHaveAttribute("data-collapsed", "");
                await expect(g1).toHaveAttribute("aria-colspan", "2");
                if (kind === "table") {
                    await expect(g1).toHaveAttribute("colspan", "2");
                }
                await expect(toggle).toHaveAttribute("aria-expanded", "false");
                await expect(columnHeader(page, 6)).toHaveText("C16");
                await expect(cell(page, 0, 6)).toHaveText("0:16");
                await expect(cell(page, 0, 7)).toHaveText("0:17");
                await expect(page.getByRole("grid")).toHaveAttribute(
                    "aria-colcount",
                    "47",
                );
                // the header keeps its two rows
                await expect(
                    page.locator('[data-grid-part="header-row"]'),
                ).toHaveCount(2);
                expect(
                    await page.evaluate(() => window.collapseChanges),
                ).toEqual([["G1"]]);
                // a group that does not collapse says nothing, and has no toggle
                await expect(groupCell(page, 1)).not.toHaveAttribute(
                    "data-collapsible",
                );
                await expect(page.getByTestId("toggle-G0")).toHaveCount(0);
                await toggleG1(page);
                await expect(g1).not.toHaveAttribute("data-collapsed");
                await expect(columnHeader(page, 6)).toHaveText("C6");
            });

            test("keeps the active cell, the widths and the order by key", async ({
                page,
            }) => {
                const viewport = await open(page, kind, COLLAPSIBLE);
                // C17: 16 expanded, 7 collapsed (the view keeps G1 at its start, C11 hidden)
                await scroll(page, viewport, 0, 1_000);
                await cell(page, 2, 16).click();
                await toggleG1(page);
                expect(await active(page)).toEqual({
                    rowIndex: 2,
                    columnIndex: 7,
                });
                await expect(cell(page, 2, 7)).toBeFocused();
                await toggleG1(page);
                expect(await active(page)).toEqual({
                    rowIndex: 2,
                    columnIndex: 16,
                });
                // C8, hidden by the collapse: the nearest column G1 shows, C5
                await scroll(page, viewport, 0, 0);
                await cell(page, 2, 8).click();
                await toggleG1(page);
                expect(await active(page)).toEqual({
                    rowIndex: 2,
                    columnIndex: 5,
                });
                await expect(cell(page, 2, 5)).toBeFocused();
                await toggleG1(page);
                // a width kept while its column is hidden
                await page.evaluate(() =>
                    window.grid?.model.run("column-widths.resize", {
                        columnKey: "c6",
                        width: 150,
                    }),
                );
                await settle(page);
                expect((await boxOf(columnHeader(page, 6))).width).toBeCloseTo(
                    150,
                    0,
                );
                await toggleG1(page);
                await toggleG1(page);
                await settle(page);
                expect((await boxOf(columnHeader(page, 6))).width).toBeCloseTo(
                    150,
                    0,
                );
                // an order: the hidden C16 keeps its place in it
                await page.evaluate(() =>
                    window.grid?.model.run("column-order.set", {
                        columnOrder: ["c16", "c5"],
                    }),
                );
                await expect(columnHeader(page, 5)).toHaveText("C6");
                await expect(columnHeader(page, 15)).toHaveText("C5");
                await toggleG1(page);
                await expect(columnHeader(page, 5)).toHaveText("C16");
                await expect(columnHeader(page, 6)).toHaveText("C5");
            });

            test("keeps the view on the column it shows first, or a hidden one's group at its start", async ({
                page,
            }) => {
                const viewport = await open(page, kind, COLLAPSIBLE);
                const left = () =>
                    page.evaluate(() => ({
                        engine: window.grid?.engine.get("scroll-position").left,
                        scroll: document.querySelector(
                            '[data-testid="viewport"]',
                        )?.scrollLeft,
                    }));
                // C18 first, 30px into it
                await scroll(page, viewport, 0, 1_730);
                await toggleG1(page);
                await settle(page);
                expect(await left()).toEqual({ engine: 830, scroll: 830 });
                await toggleG1(page);
                await settle(page);
                // C6 first: hidden, G1 starts the view
                await scroll(page, viewport, 0, 650);
                await toggleG1(page);
                await settle(page);
                expect(await left()).toEqual({ engine: 500, scroll: 500 });
            });

            /**
             * Every rendered group label's start from the start of the view's columns that scroll
             * (right of `pinned` pixels pinned at the start), and where sticky should hold it: at
             * its header cell's start, moved to the view's (`pinned`) while its group is scrolled
             * out there, never past its cell's end; a pinned group's at its place. With `by`, the
             * view scrolls by that many pixels first and they are read in the same task, before
             * any `scroll` listener runs (`fired` tells whether one did).
             */
            function labelPlaces(
                viewport: Locator,
                rtl: boolean,
                pinned: number,
                by: number | null = null,
            ) {
                return viewport.evaluate(
                    (element, [mirrored, pinnedWidth, delta]) => {
                        let fired = false;
                        const onScroll = () => {
                            fired = true;
                        };
                        element.addEventListener("scroll", onScroll);
                        if (delta !== null) {
                            element.scrollLeft += mirrored ? -delta : delta;
                        }
                        const rect = element.getBoundingClientRect();
                        const left = rect.left + element.clientLeft;
                        const right = left + element.clientWidth;
                        const start = (box: DOMRect) =>
                            mirrored ? right - box.right : box.left - left;
                        const places = [
                            ...element.querySelectorAll(
                                '[data-grid-part="group-label"]',
                            ),
                        ].map((label) => {
                            const cell = label.closest(
                                '[data-grid-part="header-cell"]',
                            );
                            if (!cell)
                                throw new Error("a label out of its cell");
                            const box = label.getBoundingClientRect();
                            const cellBox = cell.getBoundingClientRect();
                            const cellStart = start(cellBox);
                            const expected = cell.hasAttribute("data-pinned")
                                ? cellStart
                                : Math.min(
                                      Math.max(cellStart, pinnedWidth),
                                      cellStart + cellBox.width - box.width,
                                  );
                            return {
                                key: label.getAttribute(
                                    "data-grid-group-label",
                                ),
                                actual: start(box),
                                expected,
                            };
                        });
                        element.removeEventListener("scroll", onScroll);
                        return { places, fired };
                    },
                    [rtl, pinned, by] as const,
                );
            }

            function expectPlaced(
                places: Awaited<ReturnType<typeof labelPlaces>>["places"],
                at: string,
            ) {
                expect(places.length, at).toBeGreaterThan(0);
                for (const place of places) {
                    expect(
                        Math.abs(place.actual - place.expected),
                        `${place.key} ${at}: ${place.actual} for ${place.expected}`,
                    ).toBeLessThan(1.5);
                }
            }

            for (const dir of ["ltr", "rtl"] as const) {
                const rtl = dir === "rtl";
                const suffix = rtl ? ", right to left" : "";
                const query = (extra: Record<string, string | number> = {}) =>
                    rtl
                        ? { ...LABELS, ...extra, dir }
                        : { ...LABELS, ...extra };

                test(`keeps a group's label at the view's start while its group scrolls out, within its group${suffix}`, async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, query());
                    for (const left of [0, 700, 1_480, 1_590, 2_345, 4_000]) {
                        await scroll(page, viewport, 0, rtl ? -left : left);
                        const { places } = await labelPlaces(viewport, rtl, 0);
                        expectPlaced(places, `at ${left}`);
                        if (left === 700) {
                            // G1 (500–1,600) is scrolled out at the start: its label at the view's
                            const g1 = places.find(
                                (place) => place.key === "G1",
                            );
                            expect(g1?.actual).toBeCloseTo(0, 0);
                        }
                    }
                    // in place in the frames painted before the scroll event, React rendering
                    // nothing inside the overscan
                    await scroll(page, viewport, 0, rtl ? -700 : 700);
                    await page.evaluate(() => {
                        window.commits = 0;
                    });
                    for (const by of [13, -7, 40]) {
                        const { places, fired } = await labelPlaces(
                            viewport,
                            rtl,
                            0,
                            by,
                        );
                        expect(fired).toBe(false);
                        expectPlaced(places, `by ${by}`);
                        await settle(page);
                    }
                    expect(await page.evaluate(() => window.commits)).toBe(0);
                    // collapsed, G1's label is in its narrower cell
                    await page.getByTestId("toggle-G1").click();
                    await settle(page);
                    expectPlaced(
                        (await labelPlaces(viewport, rtl, 0)).places,
                        "collapsed",
                    );
                });

                test(`keeps a label right of the columns pinned at the start, and a pinned group's in place${suffix}`, async ({
                    page,
                }) => {
                    // C0 and G0 pinned: 500px
                    const viewport = await open(
                        page,
                        kind,
                        query({ pinned: 5 }),
                    );
                    for (const left of [0, 300, 1_000, 2_600]) {
                        await scroll(page, viewport, 0, rtl ? -left : left);
                        const { places } = await labelPlaces(
                            viewport,
                            rtl,
                            500,
                        );
                        expectPlaced(places, `at ${left}`);
                        if (left === 300) {
                            const g1 = places.find(
                                (place) => place.key === "G1",
                            );
                            expect(g1?.actual).toBeCloseTo(500, 0);
                        }
                    }
                });

                test(`keeps a label in view under scaled column scroll, a cut group's too${suffix}`, async ({
                    page,
                }) => {
                    const viewport = await open(
                        page,
                        kind,
                        query({
                            rows: 100,
                            columns: 2_000,
                            maxScrollSize: 50_000,
                        }),
                    );
                    expect(
                        await page.evaluate(
                            () =>
                                window.grid?.engine.get("scroll-scaled")
                                    .columns,
                        ),
                    ).toBe(true);
                    for (const left of [20_000, 20_003, 33_333]) {
                        await scroll(page, viewport, 0, rtl ? -left : left);
                        expectPlaced(
                            (await labelPlaces(viewport, rtl, 0)).places,
                            `at ${left}`,
                        );
                    }
                    // small physical moves, before the scroll event
                    for (const by of [3, -2, 8]) {
                        const { places, fired } = await labelPlaces(
                            viewport,
                            rtl,
                            0,
                            by,
                        );
                        expect(fired).toBe(false);
                        expectPlaced(places, `by ${by}`);
                        await settle(page);
                    }
                });
            }
        });

        test.describe("summary rows", () => {
            // a 35px header, a 35px summary row above the body and one at the bottom edge
            const SUMMARY = {
                rows: 1_000,
                columns: 60,
                summaryTop: 1,
                summaryBottom: 1,
            } as const;
            /** the top summary row's index: before the header's row (-1) */
            const TOP = -2;

            function summaryCell(
                page: Page,
                rowIndex: number,
                columnIndex: number,
            ) {
                return page.locator(
                    `[data-grid-part="summary-cell"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
                );
            }

            /** An element's box from the viewport's top left, inside its border. */
            async function boxInView(viewport: Locator, target: Locator) {
                const view = await viewport.evaluate((element) => {
                    const rect = element.getBoundingClientRect();
                    return {
                        x: rect.left + element.clientLeft,
                        y: rect.top + element.clientTop,
                        height: element.clientHeight,
                    };
                });
                const box = await boxOf(target);
                return {
                    x: box.x - view.x,
                    y: box.y - view.y,
                    width: box.width,
                    height: box.height,
                    viewHeight: view.height,
                };
            }

            /** The top summary row under the header, the bottom one at the view's bottom edge. */
            async function expectSticky(
                page: Page,
                viewport: Locator,
                columnIndex: number,
                rowCount: number = SUMMARY.rows,
            ) {
                const top = await boxInView(
                    viewport,
                    summaryCell(page, TOP, columnIndex),
                );
                expect(top.y).toBeCloseTo(35, 0);
                expect(top.height).toBeCloseTo(35, 0);
                const bottom = await boxInView(
                    viewport,
                    summaryCell(page, rowCount, columnIndex),
                );
                expect(bottom.y + bottom.height).toBeCloseTo(
                    bottom.viewHeight,
                    0,
                );
            }

            /** A summary cell sits over its column's body cells. */
            async function expectOverColumn(
                page: Page,
                viewport: Locator,
                rowIndex: number,
                columnIndex: number,
            ) {
                const { rows } = await windows(page);
                const body = await boxInView(
                    viewport,
                    cell(page, rows.visible.start + 1, columnIndex),
                );
                const summary = await boxInView(
                    viewport,
                    summaryCell(page, rowIndex, columnIndex),
                );
                expect(summary.x).toBeCloseTo(body.x, 0);
                expect(summary.width).toBeCloseTo(body.width, 0);
            }

            test("stays under the header and at the bottom edge through vertical and horizontal scrolls", async ({
                page,
            }) => {
                const viewport = await open(page, kind, SUMMARY);
                await expect(summaryCell(page, TOP, 3)).toHaveText("top0:3");
                await expect(summaryCell(page, 1_000, 3)).toHaveText(
                    "bottom0:3",
                );
                await expectSticky(page, viewport, 3);
                await scroll(page, viewport, 32 * 400, 1_234);
                const { columns } = await windows(page);
                const columnIndex = columns.visible.start + 2;
                await expectSticky(page, viewport, columnIndex);
                await expectOverColumn(page, viewport, TOP, columnIndex);
                await expectOverColumn(page, viewport, 1_000, columnIndex);
                // the last row scrolls above the bottom summary row, never under it
                await scroll(page, viewport, "end");
                const last = await boxInView(
                    viewport,
                    cell(page, 999, columnIndex),
                );
                const bottom = await boxInView(
                    viewport,
                    summaryCell(page, 1_000, columnIndex),
                );
                expect(last.y + last.height).toBeCloseTo(bottom.y, 0);
            });

            test("stays in place under scroll scaling on both axes", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    ...SUMMARY,
                    rows: 100_000_000,
                    columns: 1_000_000,
                    maxScrollSize: 1_000_000,
                });
                for (const at of [0.5, "end"] as const) {
                    await viewport.evaluate((element, to) => {
                        const y = element.scrollHeight - element.clientHeight;
                        const x = element.scrollWidth - element.clientWidth;
                        element.scrollTop = to === "end" ? y : y * to;
                        element.scrollLeft = to === "end" ? x : x * to;
                    }, at);
                    await settle(page);
                    const { columns } = await windows(page);
                    const columnIndex = columns.visible.start + 1;
                    await expectSticky(
                        page,
                        viewport,
                        columnIndex,
                        100_000_000,
                    );
                    await expectOverColumn(page, viewport, TOP, columnIndex);
                    await expectOverColumn(
                        page,
                        viewport,
                        100_000_000,
                        columnIndex,
                    );
                }
            });

            test("sits right after the last row in a grid shorter than the view", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    ...SUMMARY,
                    rows: 3,
                });
                const last = await boxInView(viewport, cell(page, 2, 0));
                const bottom = await boxInView(
                    viewport,
                    summaryCell(page, 3, 0),
                );
                expect(bottom.y).toBeCloseTo(last.y + last.height, 0);
                const top = await boxInView(
                    viewport,
                    summaryCell(page, TOP, 0),
                );
                expect(top.y).toBeCloseTo(35, 0);
                expect(
                    (await boxInView(viewport, cell(page, 0, 0))).y,
                ).toBeCloseTo(70, 0);
            });

            for (const dir of ["ltr", "rtl"] as const) {
                test(`pins its cells with the body's, at both ends${dir === "rtl" ? ", right to left" : ""}`, async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, {
                        ...SUMMARY,
                        pinned: 2,
                        pinnedEnd: 1,
                        dir,
                    });
                    for (const left of [0, 1_000, "end"] as const) {
                        if (left !== 0) {
                            // from the inline start: negative right to left
                            await viewport.evaluate(
                                (element, [x, mirrored]) => {
                                    const to =
                                        x === "end" ? element.scrollWidth : x;
                                    element.scrollTop = 32 * 3;
                                    element.scrollLeft = mirrored ? -to : to;
                                },
                                [left, dir === "rtl"] as const,
                            );
                            await settle(page);
                        }
                        const { columns } = await windows(page);
                        for (const columnIndex of [
                            0,
                            1,
                            columns.visible.start + 1,
                            59,
                        ]) {
                            for (const rowIndex of [TOP, 1_000]) {
                                if (columnIndex < 2 || columnIndex === 59) {
                                    await expect(
                                        summaryCell(
                                            page,
                                            rowIndex,
                                            columnIndex,
                                        ),
                                    ).toHaveAttribute(
                                        "data-pinned",
                                        columnIndex === 59 ? "end" : "start",
                                    );
                                }
                                await expectOverColumn(
                                    page,
                                    viewport,
                                    rowIndex,
                                    columnIndex,
                                );
                            }
                        }
                    }
                    await expect(summaryCell(page, TOP, 1)).toHaveAttribute(
                        "data-pinned-edge",
                        "",
                    );
                });
            }

            test("follows the columns a collapsed group shows", async ({
                page,
            }) => {
                await open(page, kind, {
                    ...SUMMARY,
                    groups: 1,
                    collapsible: 1,
                });
                // with groups, the header has two rows: the top summary row is before them
                const top = -3;
                const keys = () =>
                    page
                        .locator(
                            `[data-grid-part="summary-cell"][data-row-index="${top}"]`,
                        )
                        .allTextContents();
                expect(await keys()).toContain("top0:6");
                await page.getByTestId("toggle-G1").click();
                await settle(page);
                // collapsed, G1 shows its first and last columns (C5 and C16): C6 is gone
                const shown = await keys();
                expect(shown).not.toContain("top0:6");
                expect(shown).toContain("top0:5");
                await expect(
                    page.locator(
                        `[data-grid-part="summary-row"][data-row-index="${top}"]`,
                    ),
                ).toHaveAttribute("aria-rowindex", "3");
            });

            test("spans its cells with the columns' colSpan", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    ...SUMMARY,
                    span: 1,
                });
                for (const rowIndex of [TOP, 1_000]) {
                    const span = summaryCell(page, rowIndex, 1);
                    await expect(span).toHaveAttribute("aria-colspan", "2");
                    if (kind === "table") {
                        await expect(span).toHaveAttribute("colspan", "2");
                    }
                    expect((await boxInView(viewport, span)).width).toBeCloseTo(
                        200,
                        0,
                    );
                    await expect(summaryCell(page, rowIndex, 2)).toHaveCount(0);
                }
                // an arrow into the covered column lands on the span
                await summaryCell(page, TOP, 3).click();
                await page.keyboard.press("ArrowLeft");
                expect(await active(page)).toEqual({
                    rowIndex: TOP,
                    columnIndex: 1,
                });
            });

            test("moves the keys through the header, the summary rows and the body", async ({
                page,
            }) => {
                const viewport = await open(page, kind, SUMMARY);
                await cell(page, 0, 3).click();
                await page.keyboard.press("ArrowUp");
                expect(await active(page)).toEqual({
                    rowIndex: TOP,
                    columnIndex: 3,
                });
                await expect(summaryCell(page, TOP, 3)).toBeFocused();
                await expect(
                    page.locator(
                        `[data-grid-part="summary-row"][data-row-index="${TOP}"]`,
                    ),
                ).toHaveAttribute("data-active", "");
                await page.keyboard.press("ArrowUp");
                expect(await active(page)).toEqual({
                    rowIndex: -1,
                    columnIndex: 3,
                });
                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("ArrowDown");
                expect(await active(page)).toEqual({
                    rowIndex: 0,
                    columnIndex: 3,
                });
                // Ctrl+End: the last bottom summary row's last cell
                await page.keyboard.press("Control+End");
                await settle(page);
                expect(await active(page)).toEqual({
                    rowIndex: 1_000,
                    columnIndex: 59,
                });
                await expect(summaryCell(page, 1_000, 59)).toBeFocused();
                // up into the body, its last row in view above the summary row
                await page.keyboard.press("ArrowUp");
                await settle(page);
                expect(await active(page)).toEqual({
                    rowIndex: 999,
                    columnIndex: 59,
                });
                const last = await boxInView(viewport, cell(page, 999, 59));
                const bottom = await boxInView(
                    viewport,
                    summaryCell(page, 1_000, 59),
                );
                expect(last.y + last.height).toBeLessThanOrEqual(
                    bottom.y + 0.5,
                );
                // a page stays in the body: the summary rows are the arrows'
                await page.keyboard.press("PageDown");
                expect(await active(page)).toEqual({
                    rowIndex: 999,
                    columnIndex: 59,
                });
                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("PageUp");
                await settle(page);
                const moved = await active(page);
                expect(moved?.rowIndex).toBeLessThan(999);
                expect(moved?.rowIndex).toBeGreaterThanOrEqual(0);
            });

            test("hands a summary cell's keys to its controls", async ({
                page,
            }) => {
                await open(page, kind, { ...SUMMARY, controls: 1 });
                await summaryCell(page, 1_000, 3).click();
                await page.keyboard.press("ArrowLeft");
                await expect(summaryCell(page, 1_000, 2)).toBeFocused();
                await page.keyboard.press("Enter");
                await expect(page.getByTestId("summary-bottom0")).toBeFocused();
                await expect(summaryCell(page, 1_000, 2)).toHaveAttribute(
                    "data-interacting",
                    "",
                );
                await page.keyboard.press("Escape");
                await expect(summaryCell(page, 1_000, 2)).toBeFocused();
            });

            test("counts the summary rows in ARIA, after the header and after the body", async ({
                page,
            }) => {
                await open(page, kind, SUMMARY);
                const grid = page.locator('[data-grid-part="grid"]');
                await expect(grid).toHaveAttribute("aria-rowcount", "1003");
                await expect(
                    page.locator('[data-grid-part="header-row"]'),
                ).toHaveAttribute("aria-rowindex", "1");
                for (const [position, rowIndex, ariaRowIndex] of [
                    ["top", TOP, "2"],
                    ["bottom", 1_000, "1003"],
                ] as const) {
                    const row = page.locator(
                        `[data-grid-part="summary-row"][data-row-index="${rowIndex}"]`,
                    );
                    await expect(row).toHaveAttribute("role", "row");
                    await expect(row).toHaveAttribute(
                        "aria-rowindex",
                        ariaRowIndex,
                    );
                    await expect(row).toHaveAttribute("data-summary", position);
                    const own = summaryCell(page, rowIndex, 4);
                    await expect(own).toHaveAttribute("role", "gridcell");
                    await expect(own).toHaveAttribute("aria-colindex", "5");
                    await expect(own).toHaveAttribute("data-summary", position);
                    await expect(
                        page.locator(
                            `[data-grid-part="summary"][data-summary="${position}"]`,
                        ),
                    ).toHaveAttribute("role", "rowgroup");
                }
                await expect(
                    page.locator('[data-grid-part="row"][data-row-index="0"]'),
                ).toHaveAttribute("aria-rowindex", "3");
            });

            test("follows a resize of the view without rendering React", async ({
                page,
            }) => {
                const viewport = await open(page, kind, SUMMARY);
                await scroll(page, viewport, 32 * 100);
                const before = await page.evaluate(() => window.commits);
                await viewport.evaluate((element) => {
                    element.style.height = "590px";
                });
                await settle(page);
                expect(await page.evaluate(() => window.commits)).toBe(before);
                await expectSticky(page, viewport, 0);
            });

            test("does not render React while scrolling inside the overscan", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    ...SUMMARY,
                    rows: 100_000,
                    columns: 20,
                });
                await scroll(page, viewport, 32 * 1_000);
                const before = await page.evaluate(() => window.commits);
                await scroll(page, viewport, 32 * 1_002);
                expect(await page.evaluate(() => window.commits)).toBe(before);
                await expectSticky(page, viewport, 0, 100_000);
            });
        });

        test.describe("measured heights", () => {
            const AUTO = {
                rows: 100_000,
                columns: 8,
                rowHeight: "auto",
            } as const;

            /** How many lines the fixture's C1 holds in a row (`lines` in the fixture). */
            const lines = (index: number) => 1 + ((index * 7) % 4);

            /**
             * The rendered body rows, by index: their top from the viewport's top, their height,
             * and their cells' (an inner grid's rows left out).
             */
            async function rowBoxes(viewport: Locator) {
                return viewport.evaluate((element) => {
                    const view = element.getBoundingClientRect();
                    return [
                        ...element.querySelectorAll<HTMLElement>(
                            '[data-grid-part="row"]',
                        ),
                    ]
                        .filter(
                            (row) =>
                                row.closest('[data-grid-part="root"]') ===
                                element,
                        )
                        .map((row) => {
                            const box = row.getBoundingClientRect();
                            return {
                                index: Number(
                                    row.getAttribute("data-row-index"),
                                ),
                                top: box.top - view.top,
                                height: box.height,
                                cells: [
                                    ...row.querySelectorAll(
                                        ':scope > [data-grid-part="cell"]',
                                    ),
                                ].map((cell) => {
                                    const own = cell.getBoundingClientRect();
                                    return {
                                        column: Number(
                                            cell.getAttribute(
                                                "data-column-index",
                                            ),
                                        ),
                                        left: own.left - view.left,
                                        right: view.right - own.right,
                                        top: own.top - view.top,
                                        height: own.height,
                                    };
                                }),
                            };
                        })
                        .sort((a, b) => a.index - b.index);
                });
            }

            /** A row's top from the viewport's top. */
            async function rowTop(viewport: Locator, rowIndex: number) {
                return viewport.evaluate((element, index) => {
                    const row = element.querySelector(
                        `[data-grid-part="row"][data-row-index="${index}"]`,
                    );
                    if (!row) throw new Error(`row ${index} is not rendered`);
                    return (
                        row.getBoundingClientRect().top -
                        element.getBoundingClientRect().top
                    );
                }, rowIndex);
            }

            /** The first row whose top is in the middle of the body. */
            async function rowInView(viewport: Locator) {
                const boxes = await rowBoxes(viewport);
                const row = boxes.find((box) => box.top > 180 && box.top < 360);
                if (!row) throw new Error("no row in view");
                return row;
            }

            /** Collects the page's errors (an observer's loop reported among them). */
            function errorsOf(page: Page) {
                const errors: string[] = [];
                page.on("pageerror", (error) => errors.push(String(error)));
                page.on("console", (message) => {
                    if (message.type() === "error") errors.push(message.text());
                });
                return errors;
            }

            /** Every rendered row ends where the next one starts, its cells as tall as it. */
            function expectEndToEnd(
                boxes: Awaited<ReturnType<typeof rowBoxes>>,
            ) {
                for (const [at, box] of boxes.entries()) {
                    const next = boxes[at + 1];
                    if (next && next.index === box.index + 1) {
                        expect(
                            Math.abs(box.top + box.height - next.top),
                            `row ${box.index}`,
                        ).toBeLessThan(0.6);
                    }
                    for (const cell of box.cells) {
                        expect(
                            Math.abs(cell.top - box.top),
                            `row ${box.index}`,
                        ).toBeLessThan(0.6);
                        expect(
                            Math.abs(cell.height - box.height),
                            `row ${box.index}, column ${cell.column}`,
                        ).toBeLessThan(0.6);
                    }
                }
            }

            test("lays rows out at their content's height, end to end, the axis holding what was measured", async ({
                page,
            }) => {
                const errors = errorsOf(page);
                const viewport = await open(page, kind, AUTO);
                const boxes = await rowBoxes(viewport);
                expect(boxes.length).toBeGreaterThan(8);
                expectEndToEnd(boxes);
                // a row grows with its lines: four are taller than three, and so on
                const byLines = new Map<number, number>();
                for (const box of boxes) {
                    byLines.set(lines(box.index), box.height);
                    // the row's element carries no height of its own
                    expect(
                        await page
                            .locator(
                                `[data-grid-part="row"][data-row-index="${box.index}"]`,
                            )
                            .evaluate(
                                (row) => (row as HTMLElement).style.height,
                            ),
                    ).toBe("");
                }
                for (let count = 2; count <= 4; count++) {
                    expect(byLines.get(count)).toBeGreaterThan(
                        byLines.get(count - 1) ?? 0,
                    );
                }
                const sizes = await page.evaluate(
                    (indexes) => {
                        const axis =
                            window.grid?.engine.adapter.getView().rowAxis;
                        return indexes.map((index) => axis?.sizeOf(index));
                    },
                    [boxes[0]?.index ?? 0, 50_000],
                );
                // what was measured, and the estimate for a row never rendered
                expect(sizes[0]).toBeCloseTo(boxes[0]?.height ?? 0, 1);
                expect(sizes[1]).toBe(35);
                expect(errors).toEqual([]);
            });

            test("keeps what a scroll shows where it put it while the rows it brings into view are measured", async ({
                page,
            }) => {
                const errors = errorsOf(page);
                const viewport = await open(page, kind, AUTO);
                await scroll(page, viewport, 1_750_000);
                expectEndToEnd(await rowBoxes(viewport));
                for (const delta of [-250, -250, -150, 250, -200]) {
                    const seen = await rowInView(viewport);
                    await scroll(
                        page,
                        viewport,
                        (await viewport.evaluate((e) => e.scrollTop)) + delta,
                    );
                    expect(
                        Math.abs(
                            (await rowTop(viewport, seen.index)) -
                                (seen.top - delta),
                        ),
                        `row ${seen.index} after ${delta}`,
                    ).toBeLessThan(1);
                    expectEndToEnd(await rowBoxes(viewport));
                }
                expect(errors).toEqual([]);
            });

            test("keeps the view anchored under scroll scaling: the wheel moves what it shows by its delta", async ({
                page,
            }) => {
                const errors = errorsOf(page);
                const viewport = await open(page, kind, {
                    ...AUTO,
                    maxScrollSize: 500_000,
                });
                expect(
                    await page.evaluate(
                        () => window.grid?.engine.get("scroll-scaled").rows,
                    ),
                ).toBe(true);
                await scroll(page, viewport, 250_000);
                expectEndToEnd(await rowBoxes(viewport));
                const box = await boxOf(viewport);
                await page.mouse.move(box.x + 200, box.y + 300);
                for (const delta of [-250, -250, 200, -150]) {
                    const seen = await rowInView(viewport);
                    await page.mouse.wheel(0, delta);
                    await settle(page);
                    await settle(page);
                    expect(
                        Math.abs(
                            (await rowTop(viewport, seen.index)) -
                                (seen.top - delta),
                        ),
                        `row ${seen.index} after ${delta}`,
                    ).toBeLessThan(1);
                    expectEndToEnd(await rowBoxes(viewport));
                }
                expect(errors).toEqual([]);
            });

            test("lands the keys and scroll-to-cell on rows as tall as their content", async ({
                page,
            }) => {
                const viewport = await open(page, kind, AUTO);
                await cell(page, 2, 1).click();
                for (let step = 1; step <= 20; step++) {
                    await page.keyboard.press("ArrowDown");
                    await settle(page);
                    const target = cell(page, 2 + step, 1);
                    await expect(target).toBeFocused();
                    await expectFullyInBody(viewport, target);
                }
                await page.keyboard.press("PageDown");
                await settle(page);
                const paged = (await active(page))?.rowIndex ?? 0;
                expect(paged).toBeGreaterThan(22);
                await expectFullyInBody(viewport, cell(page, paged, 1));
                await page.evaluate(() =>
                    window.grid?.engine.run("scroll-to-cell", {
                        rowIndex: 60_000,
                        columnIndex: 1,
                    }),
                );
                await settle(page);
                await settle(page);
                await expectFullyInBody(viewport, cell(page, 60_000, 1));
                await page.keyboard.press("ControlOrMeta+End");
                await settle(page);
                await settle(page);
                const last = cell(page, 99_999, 7);
                await expect(last).toBeFocused();
                await expectFullyInBody(viewport, last);
            });

            for (const [rowHeight, pinned] of [
                [32, 0],
                [32, 1],
                ["auto", 0],
                ["auto", 1],
            ] as const) {
                test(`measures a detail at its content's height (rows ${rowHeight}, ${pinned} pinned)`, async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, {
                        rows: 1_000,
                        columns: 8,
                        details: 1,
                        detailHeight: "auto",
                        rowHeight,
                        pinned,
                    });
                    const measured = async (rowIndex: number) =>
                        viewport.evaluate((element, index) => {
                            const target = element.querySelector(
                                `[data-grid-part="row-detail"][data-row-index="${index}"]`,
                            );
                            // the grid's own row: the inner grid's come first
                            const next = [
                                ...element.querySelectorAll(
                                    `[data-grid-part="row"][data-row-index="${index + 1}"]`,
                                ),
                            ].find(
                                (row) =>
                                    row.closest('[data-grid-part="root"]') ===
                                    element,
                            );
                            const spacer = element.querySelector(
                                `[data-testid="detail-spacer-${index}"]`,
                            );
                            if (!target || !next || !spacer) {
                                throw new Error("no detail");
                            }
                            const box = target.getBoundingClientRect();
                            return {
                                top: box.top,
                                height: box.height,
                                // its content: from its top to its last block's end
                                content:
                                    spacer.getBoundingClientRect().bottom -
                                    box.top +
                                    Number.parseFloat(
                                        getComputedStyle(target).paddingBottom,
                                    ),
                                next: next.getBoundingClientRect().top,
                                extra: window.grid?.engine.adapter
                                    .getView()
                                    .rowAxis.extraSizeOf(index),
                            };
                        }, rowIndex);
                    await page.getByTestId("expand-2").click();
                    await settle(page);
                    await page.getByTestId("expand-4").click();
                    await settle(page);
                    const two = await measured(2);
                    const four = await measured(4);
                    for (const detail of [two, four]) {
                        expect(detail.height).toBeCloseTo(detail.content, 0);
                        expect(detail.extra).toBeCloseTo(detail.height, 1);
                        // the next row right after it
                        expect(
                            Math.abs(detail.top + detail.height - detail.next),
                        ).toBeLessThan(0.6);
                    }
                    // row 2's block is 80px tall, row 4's 40px
                    expect(two.height - four.height).toBeCloseTo(40, 0);
                    expectEndToEnd(
                        (await rowBoxes(viewport)).filter(
                            (box) => box.index !== 2 && box.index !== 4,
                        ),
                    );
                });
            }

            for (const direction of ["ltr", "rtl"] as const) {
                test(`keeps pinned and spanning cells aligned with measured rows (${direction})`, async ({
                    page,
                }) => {
                    const viewport = await open(page, kind, {
                        ...AUTO,
                        columns: 30,
                        pinned: 1,
                        pinnedEnd: 1,
                        span: 1,
                        ...(direction === "rtl" ? { dir: "rtl" } : {}),
                    });
                    // a spanning cell (every fifth row) is as tall as its row
                    const spanning = page.locator(
                        '[data-grid-part="cell"][aria-colspan="3"]',
                    );
                    expect(await spanning.count()).toBeGreaterThan(0);
                    expectEndToEnd(await rowBoxes(viewport));
                    await viewport.evaluate((element, rtl) => {
                        element.scrollLeft = rtl ? -900 : 900;
                    }, direction === "rtl");
                    await settle(page);
                    const boxes = await rowBoxes(viewport);
                    expectEndToEnd(boxes);
                    for (const box of boxes) {
                        const first = box.cells.find((c) => c.column === 0);
                        const last = box.cells.find((c) => c.column === 29);
                        // the pinned ones at the view's start and end
                        const start =
                            direction === "rtl" ? first?.right : first?.left;
                        const end =
                            direction === "rtl" ? last?.left : last?.right;
                        expect(
                            Math.abs(start ?? 99),
                            `row ${box.index}`,
                        ).toBeLessThan(1);
                        expect(
                            Math.abs(end ?? 99),
                            `row ${box.index}`,
                        ).toBeLessThan(1);
                    }
                });
            }

            test("does not render React while scrolling inside the overscan", async ({
                page,
            }) => {
                const viewport = await open(page, kind, AUTO);
                await scroll(page, viewport, 35 * 1_000);
                await scroll(page, viewport, 35 * 1_000 + 10);
                const before = await page.evaluate(() => window.commits);
                await scroll(page, viewport, 35 * 1_000 + 40);
                expect(await page.evaluate(() => window.commits)).toBe(before);
                await scroll(page, viewport, 35 * 1_000 + 2_000);
                expect(
                    await page.evaluate(() => window.commits),
                ).toBeGreaterThan(before);
            });
        });

        test.describe("row reordering", () => {
            const ROWS = { rows: 100, columns: 8, rowReorder: 1 };

            /** A row's drag handle, by the row's id (its index before any move). */
            const handle = (page: Page, id: number) =>
                page.getByTestId(`handle-${id}`);

            /** A rendered body row of the grid at an index (a grid in a detail's left out). */
            const row = (page: Page, rowIndex: number) =>
                page.locator(
                    `[data-testid="viewport"] > [data-grid-part="grid"] > [data-grid-part="body"] > [data-grid-part="row"][data-row-index="${rowIndex}"]`,
                );

            /** A body cell of the grid's own (`cell`, a grid in a detail's left out). */
            const own = (page: Page, rowIndex: number, columnIndex: number) =>
                row(page, rowIndex).locator(
                    `:scope > [data-grid-part="cell"][data-column-index="${columnIndex}"]`,
                );

            /** The ids of the rows at the first `count` indexes, from C1's values. */
            async function ids(page: Page, count: number) {
                const values = await Promise.all(
                    Array.from({ length: count }, (_, rowIndex) =>
                        own(page, rowIndex, 1).textContent(),
                    ),
                );
                return values.map((value) => Number(value?.split(":")[0]));
            }

            const rowMoves = (page: Page) =>
                page.evaluate(() => window.rowMoves);

            /**
             * Presses a handle, moves the pointer to `y` (a page y) through the slop and, unless
             * told to hold it, releases it there.
             */
            async function dragTo(
                page: Page,
                target: Locator,
                y: number,
                { hold = false } = {},
            ) {
                const box = await boxOf(target);
                const x = box.x + box.width / 2;
                await page.mouse.move(x, box.y + box.height / 2);
                await page.mouse.down();
                await page.mouse.move(x, y, { steps: 6 });
                await settle(page);
                if (!hold) {
                    await page.mouse.up();
                    await settle(page);
                }
            }

            /** A page y at `fraction` of a row's cells' height (its first cell's box). */
            async function yIn(page: Page, rowIndex: number, fraction: number) {
                const box = await boxOf(own(page, rowIndex, 1));
                return box.y + box.height * fraction;
            }

            test("moves a row dropped on another, the drop target marked meanwhile, once per drop", async ({
                page,
            }) => {
                await open(page, kind, ROWS);
                await expect(handle(page, 1)).toHaveAttribute(
                    "data-reorderable",
                    "",
                );
                await expect(handle(page, 1)).toHaveAttribute(
                    "aria-hidden",
                    "true",
                );
                // row 3's lower half: after it
                await dragTo(page, handle(page, 1), await yIn(page, 3, 0.75), {
                    hold: true,
                });
                await expect(row(page, 1)).toHaveAttribute("data-dragging", "");
                await expect(row(page, 3)).toHaveAttribute(
                    "data-drop-target",
                    "after",
                );
                // the fixture's own CSS draws it
                await expect(row(page, 3)).toHaveCSS("box-shadow", /inset/);
                // nothing moves before the release
                expect(await ids(page, 5)).toEqual([0, 1, 2, 3, 4]);
                await page.mouse.up();
                await settle(page);
                expect(await ids(page, 5)).toEqual([0, 2, 3, 1, 4]);
                expect(await rowMoves(page)).toEqual([
                    { fromIndex: 1, toIndex: 3, rowKey: 1 },
                ]);
                expect(
                    await page
                        .locator(
                            '[data-grid-part="row"][data-dragging], [data-grid-part="row"][data-drop-target]',
                        )
                        .count(),
                ).toBe(0);
                // its cell, pressed, is the active one, at its new index; the click sorted nothing
                expect(await active(page)).toEqual({
                    rowIndex: 3,
                    columnIndex: 0,
                });
                await expect(own(page, 3, 0)).toBeFocused();
                // up again, before row 0
                await dragTo(page, handle(page, 1), await yIn(page, 0, 0.25));
                expect(await ids(page, 5)).toEqual([1, 0, 2, 3, 4]);
                expect(await rowMoves(page)).toHaveLength(2);
            });

            test("cancels a drag on Escape, and moves nothing dropped where it is", async ({
                page,
            }) => {
                await open(page, kind, ROWS);
                await dragTo(page, handle(page, 1), await yIn(page, 4, 0.75), {
                    hold: true,
                });
                await expect(row(page, 4)).toHaveAttribute(
                    "data-drop-target",
                    "after",
                );
                await page.keyboard.press("Escape");
                await settle(page);
                await expect(row(page, 1)).not.toHaveAttribute("data-dragging");
                await page.mouse.up();
                await settle(page);
                // beside itself: nowhere
                await dragTo(page, handle(page, 1), await yIn(page, 2, 0.25));
                expect(await ids(page, 5)).toEqual([0, 1, 2, 3, 4]);
                expect(await rowMoves(page)).toEqual([]);
            });

            test("scrolls near the body's bottom edge to a far row", async ({
                page,
            }) => {
                const viewport = await open(page, kind, ROWS);
                const view = await boxOf(viewport);
                // held just inside the bottom edge: the rows scroll to the last one
                await dragTo(page, handle(page, 1), view.y + view.height - 5, {
                    hold: true,
                });
                await expect
                    .poll(() =>
                        viewport.evaluate(
                            (element) =>
                                element.scrollHeight -
                                element.clientHeight -
                                element.scrollTop,
                        ),
                    )
                    .toBeLessThan(1);
                await expect(row(page, 99)).toHaveAttribute(
                    "data-drop-target",
                    "after",
                );
                // the dragged row is still rendered (the active one)
                await expect(row(page, 1)).toHaveAttribute("data-dragging", "");
                await page.mouse.up();
                await settle(page);
                expect(await rowMoves(page)).toEqual([
                    { fromIndex: 1, toIndex: 99, rowKey: 1 },
                ]);
                await expect(own(page, 99, 1)).toHaveText("1:1");
            });

            test("moves the active cell's row with Ctrl+Shift+arrows, focus following it", async ({
                page,
            }) => {
                await open(page, kind, ROWS);
                await own(page, 2, 1).click();
                await page.keyboard.press("ControlOrMeta+Shift+ArrowDown");
                await settle(page);
                expect(await ids(page, 5)).toEqual([0, 1, 3, 2, 4]);
                expect(await active(page)).toEqual({
                    rowIndex: 3,
                    columnIndex: 1,
                });
                await expect(own(page, 3, 1)).toBeFocused();
                await page.keyboard.press("ControlOrMeta+Shift+ArrowDown");
                await page.keyboard.press("ControlOrMeta+Shift+ArrowUp");
                await page.keyboard.press("ControlOrMeta+Shift+ArrowUp");
                await page.keyboard.press("ControlOrMeta+Shift+ArrowUp");
                await settle(page);
                expect(await ids(page, 5)).toEqual([0, 2, 1, 3, 4]);
                await expect(own(page, 1, 1)).toBeFocused();
                expect(await rowMoves(page)).toHaveLength(5);
                // the first row up: handled, nothing moves, the page does not scroll
                await own(page, 0, 1).click();
                await page.keyboard.press("ControlOrMeta+Shift+ArrowUp");
                await settle(page);
                expect(await rowMoves(page)).toHaveLength(5);
                await expect(own(page, 0, 1)).toBeFocused();
            });

            test("refuses a move while the grid is sorted", async ({
                page,
            }) => {
                await open(page, kind, { ...ROWS, sort: 1 });
                await page
                    .locator(
                        '[data-grid-part="header-cell"][data-column-index="0"]',
                    )
                    .click({ position: { x: 5, y: 5 } });
                await expect(handle(page, 1)).not.toHaveAttribute(
                    "data-reorderable",
                );
                await dragTo(page, handle(page, 1), await yIn(page, 4, 0.75));
                await expect(
                    page.locator('[data-grid-part="row"][data-drop-target]'),
                ).toHaveCount(0);
                await own(page, 2, 1).click();
                await page.keyboard.press("ControlOrMeta+Shift+ArrowDown");
                await settle(page);
                expect(await rowMoves(page)).toEqual([]);
                await expect(own(page, 2, 1)).toBeFocused();
            });

            test("targets measured rows and details by their heights", async ({
                page,
            }) => {
                await open(page, kind, {
                    ...ROWS,
                    rowHeight: "auto",
                    details: 1,
                    detailHeight: 120,
                });
                // (the rows after it hold a grid of their own in its detail: none is read)
                await page.getByTestId("expand-2").click();
                await settle(page);
                const detail = await boxOf(
                    page
                        .locator('[data-grid-part="row-detail"]')
                        .filter({ has: page.getByTestId("detail-button-2") }),
                );
                const x = (await boxOf(handle(page, 0))).x + 2;
                // over row 2's detail: after row 2
                await dragTo(page, handle(page, 0), detail.y + 60, {
                    hold: true,
                });
                await expect(row(page, 2)).toHaveAttribute(
                    "data-drop-target",
                    "after",
                );
                // row 1 is two lines tall (`lines(1)`): its lower half, after it
                await page.mouse.move(x, await yIn(page, 1, 0.8), { steps: 3 });
                await settle(page);
                await expect(row(page, 1)).toHaveAttribute(
                    "data-drop-target",
                    "after",
                );
                // row 0's lower half: beside itself, nowhere
                await page.mouse.move(x, await yIn(page, 0, 0.8), { steps: 3 });
                await settle(page);
                await expect(
                    page.locator('[data-grid-part="row"][data-drop-target]'),
                ).toHaveCount(0);
                await page.mouse.move(x, detail.y + 60, { steps: 3 });
                await page.mouse.up();
                await settle(page);
                expect(await rowMoves(page)).toEqual([
                    { fromIndex: 0, toIndex: 2, rowKey: 0 },
                ]);
                expect(await ids(page, 3)).toEqual([1, 2, 0]);
            });

            test("drags the same right to left", async ({ page }) => {
                await open(page, kind, { ...ROWS, dir: "rtl" });
                await dragTo(page, handle(page, 1), await yIn(page, 3, 0.75));
                expect(await ids(page, 5)).toEqual([0, 2, 3, 1, 4]);
                await own(page, 3, 1).click();
                await page.keyboard.press("ControlOrMeta+Shift+ArrowUp");
                await settle(page);
                expect(await ids(page, 5)).toEqual([0, 2, 1, 3, 4]);
                await expect(own(page, 2, 1)).toBeFocused();
            });
        });

        test.describe("row groups", () => {
            // 1,000 rows in memory grouped by C2 (`g<index % 5>`: 200 rows each), C4 their
            // indexes' sum; a group row's C0 holds its toggle and `<value> (<count>)`
            const GROUPED = { rows: 1_000, columns: 20, groupBy: 1 } as const;

            function row(page: Page, rowIndex: number) {
                return page.locator(
                    `[data-grid-part="row"][data-row-index="${rowIndex}"]`,
                );
            }

            /** The grid's element: its role and its counts. */
            function gridPart(page: Page) {
                return page.locator('[data-grid-part="grid"]');
            }

            /** A group row's C0, clicked beside its toggle: the cell is active, in navigation. */
            async function activate(
                page: Page,
                rowIndex: number,
                columnIndex = 0,
            ) {
                const target = cell(page, rowIndex, columnIndex);
                const box = await boxOf(target);
                await page.mouse.click(box.x + box.width - 4, box.y + 4);
                await settle(page);
                await expect(target).toBeFocused();
            }

            test("makes a treegrid of group rows, with counts and aggregates", async ({
                page,
            }) => {
                await open(page, kind, { rows: 1_000 });
                await expect(gridPart(page)).toHaveAttribute("role", "grid");
                await expect(row(page, 0)).not.toHaveAttribute("aria-level");
                await open(page, kind, GROUPED);
                await expect(gridPart(page)).toHaveAttribute(
                    "role",
                    "treegrid",
                );
                // the header's row and the five group rows
                await expect(gridPart(page)).toHaveAttribute(
                    "aria-rowcount",
                    "6",
                );
                await expect(
                    page.locator('[data-grid-part="row"]'),
                ).toHaveCount(5);
                const first = row(page, 0);
                await expect(first).toHaveAttribute("data-group-row", "");
                await expect(first).toHaveAttribute("aria-level", "1");
                await expect(first).toHaveAttribute("aria-expanded", "false");
                await expect(first).toHaveAttribute("aria-setsize", "5");
                await expect(first).toHaveAttribute("aria-posinset", "1");
                await expect(first).not.toHaveAttribute("data-loading");
                await expect(cell(page, 0, 0)).toHaveText("+ g0 (200)");
                await expect(cell(page, 0, 2)).toHaveText("g0");
                // 0 + 5 + … + 995
                await expect(cell(page, 0, 4)).toHaveText("99500");
                await expect(cell(page, 4, 0)).toHaveText("+ g4 (200)");
            });

            test("expands and collapses a group by its toggle", async ({
                page,
            }) => {
                await open(page, kind, GROUPED);
                await page.getByTestId("group-toggle-1").click();
                await settle(page);
                await expect(gridPart(page)).toHaveAttribute(
                    "aria-rowcount",
                    "206",
                );
                await expect(row(page, 1)).toHaveAttribute(
                    "aria-expanded",
                    "true",
                );
                await expect(row(page, 1)).toHaveAttribute(
                    "data-group-expanded",
                    "",
                );
                await expect(
                    page.getByTestId("group-toggle-1"),
                ).toHaveAttribute("aria-expanded", "true");
                // its rows under it, a level down
                await expect(row(page, 2)).toHaveAttribute("aria-level", "2");
                await expect(row(page, 2)).not.toHaveAttribute(
                    "data-group-row",
                );
                await expect(cell(page, 2, 0)).toHaveText("1:0");
                await expect(cell(page, 3, 0)).toHaveText("6:0");
                await expect(cell(page, 2, 2)).toHaveText("g1");
                expect(
                    await page.evaluate(() => window.groupChanges.length),
                ).toBe(1);
                await page.getByTestId("group-toggle-1").click();
                await settle(page);
                await expect(gridPart(page)).toHaveAttribute(
                    "aria-rowcount",
                    "6",
                );
                await expect(cell(page, 2, 0)).toHaveText("+ g2 (200)");
            });

            test("expands, collapses and goes up the tree with the keys", async ({
                page,
            }) => {
                await open(page, kind, GROUPED);
                await activate(page, 1, 1);
                // Enter and Space toggle a group row
                await page.keyboard.press("Enter");
                await settle(page);
                await expect(row(page, 1)).toHaveAttribute(
                    "aria-expanded",
                    "true",
                );
                await page.keyboard.press(" ");
                await settle(page);
                await expect(row(page, 1)).toHaveAttribute(
                    "aria-expanded",
                    "false",
                );
                // on the first column, → expands, then moves
                await page.keyboard.press("ArrowLeft");
                await page.keyboard.press("ArrowRight");
                await settle(page);
                await expect(row(page, 1)).toHaveAttribute(
                    "aria-expanded",
                    "true",
                );
                await expect(cell(page, 1, 0)).toBeFocused();
                // down into its rows, ← goes back up to it, and ← there collapses it
                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("ArrowDown");
                await settle(page);
                await expect(cell(page, 3, 0)).toBeFocused();
                await page.keyboard.press("ArrowLeft");
                await settle(page);
                await expect(cell(page, 1, 0)).toBeFocused();
                await page.keyboard.press("ArrowLeft");
                await settle(page);
                await expect(row(page, 1)).toHaveAttribute(
                    "aria-expanded",
                    "false",
                );
                await expect(cell(page, 1, 0)).toBeFocused();
            });

            test("nests by two columns", async ({ page }) => {
                await open(page, kind, { ...GROUPED, groupBy: 2 });
                await page.getByTestId("group-toggle-0").click();
                await settle(page);
                await expect(cell(page, 1, 0)).toHaveText("+ h0 (100)");
                await expect(row(page, 1)).toHaveAttribute("aria-level", "2");
                await expect(row(page, 1)).toHaveAttribute("aria-setsize", "2");
                await page.getByTestId("group-toggle-1").click();
                await settle(page);
                await expect(row(page, 2)).toHaveAttribute("aria-level", "3");
                await expect(cell(page, 2, 0)).toHaveText("0:0");
                // ← from a row three levels down goes to its group
                await cell(page, 4, 0).click();
                await page.keyboard.press("ArrowLeft");
                await settle(page);
                await expect(cell(page, 1, 0)).toBeFocused();
            });

            test("selects a group's rows", async ({ page }) => {
                await open(page, kind, {
                    ...GROUPED,
                    selection: "multiple",
                });
                await expect(row(page, 0)).toHaveAttribute(
                    "aria-selected",
                    "false",
                );
                await page.getByTestId("select-0").click();
                await settle(page);
                await expect(row(page, 0)).toHaveAttribute(
                    "aria-selected",
                    "true",
                );
                const keys = await page.evaluate(
                    () => window.selectionChanges.at(-1) ?? [],
                );
                expect(keys).toHaveLength(200);
                expect(keys.slice(0, 2)).toEqual([0, 5]);
                await page.getByTestId("group-toggle-0").click();
                await settle(page);
                await expect(row(page, 1)).toHaveAttribute(
                    "aria-selected",
                    "true",
                );
                // a row cleared: its group no longer all selected
                await page.getByTestId("select-1").click();
                await settle(page);
                await expect(row(page, 0)).toHaveAttribute(
                    "aria-selected",
                    "false",
                );
                // Shift+Space on a group row selects its rows again
                await activate(page, 0, 2);
                await page.keyboard.press("Shift+Space");
                await settle(page);
                await expect(row(page, 0)).toHaveAttribute(
                    "aria-selected",
                    "true",
                );
                await expect(row(page, 1)).toHaveAttribute(
                    "aria-selected",
                    "true",
                );
                // Ctrl/⌘+A selects every row, the collapsed groups' too
                await page.keyboard.press("ControlOrMeta+a");
                await settle(page);
                expect(
                    await page.evaluate(
                        () => window.selectionChanges.at(-1)?.length,
                    ),
                ).toBe(1_000);
                // the collapsed group g1 (row 201, below the view) holds every one of its rows
                expect(
                    await page.evaluate(() =>
                        window.grid?.model.is("row-selected", {
                            rowIndex: 201,
                        }),
                    ),
                ).toBe(true);
            });

            test("sorts inside the groups", async ({ page }) => {
                await open(page, kind, { ...GROUPED, sort: 1 });
                await page.getByTestId("group-toggle-0").click();
                await settle(page);
                await expect(cell(page, 1, 0)).toHaveText("0:0");
                const header = page.locator(
                    '[data-grid-part="header-cell"][data-column-index="0"]',
                );
                await header.click();
                await header.click();
                await settle(page);
                // descending: the group stays first (it sorts by C2), its rows reversed
                await expect(cell(page, 0, 0)).toHaveText("- g0 (200)");
                await expect(cell(page, 1, 0)).toHaveText("995:0");
            });

            test("keeps a pinned group cell in view and its rows under the summary rows", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    ...GROUPED,
                    pinned: 1,
                    summaryTop: 1,
                    summaryBottom: 1,
                });
                // header, top summary row, then the first group row
                await expect(row(page, 0)).toHaveAttribute(
                    "aria-rowindex",
                    "3",
                );
                await expect(cell(page, 0, 0)).toHaveAttribute(
                    "data-pinned",
                    "start",
                );
                const before = await boxOf(cell(page, 0, 0));
                await scroll(page, viewport, 0, 600);
                const after = await boxOf(cell(page, 0, 0));
                expect(after.x).toBeCloseTo(before.x, 0);
                await expect(cell(page, 0, 0)).toHaveText("+ g0 (200)");
                await page.getByTestId("group-toggle-0").click();
                await settle(page);
                await expect(gridPart(page)).toHaveAttribute(
                    "aria-rowcount",
                    "208",
                );
                await expect(
                    page.locator(
                        '[data-grid-part="summary-row"][data-row-index="205"]',
                    ),
                ).toHaveAttribute("aria-rowindex", "208");
            });

            test("scales with many rows, groups expanded", async ({ page }) => {
                const viewport = await open(page, kind, {
                    rows: 200_000,
                    columns: 20,
                    groupBy: 1,
                    maxScrollSize: 500_000,
                });
                await page.getByTestId("group-toggle-0").click();
                await settle(page);
                await expect(gridPart(page)).toHaveAttribute(
                    "aria-rowcount",
                    "40006",
                );
                const scaled = await page.evaluate(
                    () => window.grid?.engine.get("scroll-scaled").rows,
                );
                expect(scaled).toBe(true);
                await scroll(page, viewport, "end");
                // the last group row, in view
                const last = cell(page, 40_004, 0);
                await expect(last).toHaveText("+ g4 (40000)");
                await expectFullyInBody(viewport, last);
                await last.click({ position: { x: 90, y: 4 } });
                await page.keyboard.press("ArrowUp");
                await settle(page);
                await expect(cell(page, 40_003, 0)).toBeFocused();
                await page.keyboard.press("Control+Home");
                await settle(page);
                await expect(
                    page.locator(
                        '[data-grid-part="header-cell"][data-column-index="0"]',
                    ),
                ).toBeFocused();
            });
        });

        test.describe("cell ranges", () => {
            const CELLS = { rows: 1_000, columns: 20, cells: 1 } as const;

            const selectedRange = (page: Page) =>
                page.evaluate(() => window.grid?.model.get("selected-range"));

            const range = (
                anchor: [number, number],
                focus: [number, number],
            ) => ({
                anchor: { rowIndex: anchor[0], columnIndex: anchor[1] },
                focus: { rowIndex: focus[0], columnIndex: focus[1] },
            });

            /** A cell's centre on the page. */
            async function centreOf(target: Locator) {
                const box = await boxOf(target);
                return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
            }

            /** Presses `from`'s centre and moves through the slop to `to` (a point), held. */
            async function pressAndMove(
                page: Page,
                from: Locator,
                to: { x: number; y: number },
            ) {
                const start = await centreOf(from);
                await page.mouse.move(start.x, start.y);
                await page.mouse.down();
                await page.mouse.move(to.x, to.y, { steps: 6 });
                await settle(page);
            }

            test("Shift with the keys extends from the active cell, marked by state attributes", async ({
                page,
            }) => {
                await open(page, kind, CELLS);
                await cell(page, 2, 1).click();
                await page.keyboard.press("Shift+ArrowDown");
                await page.keyboard.press("Shift+ArrowDown");
                await page.keyboard.press("Shift+ArrowRight");
                await settle(page);
                expect(await selectedRange(page)).toEqual(
                    range([2, 1], [4, 2]),
                );
                // the active cell stays, focused
                await expect(cell(page, 2, 1)).toBeFocused();
                expect(await active(page)).toEqual({
                    rowIndex: 2,
                    columnIndex: 1,
                });
                await expect(cell(page, 2, 1)).toHaveAttribute(
                    "data-range-edge",
                    "top start",
                );
                await expect(cell(page, 3, 2)).toHaveAttribute(
                    "data-range-edge",
                    "end",
                );
                await expect(cell(page, 4, 2)).toHaveAttribute(
                    "data-range-edge",
                    "bottom end",
                );
                await expect(cell(page, 3, 1)).toHaveAttribute(
                    "data-selected-cell",
                    "",
                );
                await expect(cell(page, 3, 1)).toHaveAttribute(
                    "aria-selected",
                    "true",
                );
                await expect(cell(page, 5, 1)).toHaveAttribute(
                    "aria-selected",
                    "false",
                );
                await expect(
                    page.locator('[data-grid-part="grid"]'),
                ).toHaveAttribute("aria-multiselectable", "true");
                // the fixture's own CSS draws the edges
                await expect(cell(page, 2, 1)).toHaveCSS(
                    "border-top-width",
                    "2px",
                );
                // PageDown pages the focus, scrolled into view
                await page.keyboard.press("Shift+PageDown");
                await settle(page);
                const paged = await selectedRange(page);
                expect(paged?.focus.rowIndex).toBeGreaterThan(15);
                await expectFullyInBody(
                    page.getByTestId("viewport"),
                    cell(page, paged?.focus.rowIndex ?? 0, 2),
                );
                // Escape clears; a plain move clears and moves
                await page.keyboard.press("Escape");
                await settle(page);
                expect(await selectedRange(page)).toBeNull();
                await expect(page.locator("[data-selected-cell]")).toHaveCount(
                    0,
                );
                await page.keyboard.press("Shift+ArrowRight");
                await page.keyboard.press("ArrowLeft");
                await settle(page);
                expect(await selectedRange(page)).toBeNull();
                expect(await active(page)).toEqual({
                    rowIndex: 2,
                    columnIndex: 0,
                });
                expect(
                    await page.evaluate(() => window.rangeChanges.length),
                ).toBe(7);
            });

            test("Ctrl/⌘+A selects every body cell", async ({ page }) => {
                await open(page, kind, CELLS);
                await cell(page, 1, 1).click();
                await page.keyboard.press("ControlOrMeta+a");
                await settle(page);
                expect(await selectedRange(page)).toEqual(
                    range([0, 0], [999, 19]),
                );
                await expect(cell(page, 0, 0)).toHaveAttribute(
                    "data-range-edge",
                    "top start",
                );
                // the page's text is never selected instead
                expect(
                    await page.evaluate(() =>
                        String(document.getSelection() ?? ""),
                    ),
                ).toBe("");
            });

            test("drags a range across cells, from the pressed one", async ({
                page,
            }) => {
                await open(page, kind, CELLS);
                await pressAndMove(
                    page,
                    cell(page, 1, 1),
                    await centreOf(cell(page, 4, 3)),
                );
                expect(await selectedRange(page)).toEqual(
                    range([1, 1], [4, 3]),
                );
                await expect(cell(page, 1, 1)).toBeFocused();
                await page.mouse.up();
                await settle(page);
                expect(await selectedRange(page)).toEqual(
                    range([1, 1], [4, 3]),
                );
                // no text selected on the way
                expect(
                    await page.evaluate(() =>
                        String(document.getSelection() ?? ""),
                    ),
                ).toBe("");
                // Shift+click reaches a cell from the anchor, the active cell staying
                await cell(page, 6, 0).click({ modifiers: ["Shift"] });
                await settle(page);
                expect(await selectedRange(page)).toEqual(
                    range([1, 1], [6, 0]),
                );
                await expect(cell(page, 1, 1)).toBeFocused();
                // a plain click clears it
                await cell(page, 8, 2).click();
                await settle(page);
                expect(await selectedRange(page)).toBeNull();
                expect(await active(page)).toEqual({
                    rowIndex: 8,
                    columnIndex: 2,
                });
            });

            test("scrolls the rows and the columns at the view's edges while dragging", async ({
                page,
            }) => {
                const viewport = await open(page, kind, CELLS);
                const body = await bodyBox(viewport);
                await pressAndMove(page, cell(page, 2, 2), {
                    x: body.right - 5,
                    y: body.bottom - 5,
                });
                await page.waitForFunction(() => {
                    const position = window.grid?.engine.get("scroll-position");
                    return (
                        (position?.top ?? 0) > 300 &&
                        (position?.left ?? 0) > 300
                    );
                });
                const far = await selectedRange(page);
                expect(far?.anchor).toEqual({ rowIndex: 2, columnIndex: 2 });
                expect(far?.focus.rowIndex).toBeGreaterThan(20);
                expect(far?.focus.columnIndex).toBeGreaterThan(8);
                await page.mouse.up();
                await settle(page);
                // stopped with the release
                const stopped = await page.evaluate(() =>
                    window.grid?.engine.get("scroll-position"),
                );
                await settle(page);
                expect(
                    await page.evaluate(() =>
                        window.grid?.engine.get("scroll-position"),
                    ),
                ).toEqual(stopped);
                // the range's focus on screen, marked
                const focus = (await selectedRange(page))?.focus;
                await expect(
                    cell(page, focus?.rowIndex ?? 0, focus?.columnIndex ?? 0),
                ).toHaveAttribute("data-range-edge", "bottom end");
            });

            test("selects across pinned columns, scrolling only from the scrolling columns' edges", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    ...CELLS,
                    pinned: 1,
                    pinnedEnd: 1,
                });
                await scroll(page, viewport, 0, 600);
                const left = () =>
                    page.evaluate(
                        () => window.grid?.engine.get("scroll-position").left,
                    );
                const pinnedEnd = await centreOf(cell(page, 3, 19));
                await pressAndMove(page, cell(page, 1, 8), pinnedEnd);
                expect(await selectedRange(page)).toEqual(
                    range([1, 8], [3, 19]),
                );
                // over a pinned strip: its column, nothing scrolls sideways (held there)
                const held = await left();
                await settle(page);
                expect(await left()).toBe(held);
                const pinnedStart = await centreOf(cell(page, 3, 0));
                await page.mouse.move(pinnedStart.x, pinnedStart.y);
                await settle(page);
                await settle(page);
                expect(await selectedRange(page)).toEqual(
                    range([1, 8], [3, 0]),
                );
                expect(await left()).toBe(held);
                // the scrolling columns' end zone, beside the strip pinned at the end: they scroll
                const body = await bodyBox(viewport);
                await page.mouse.move(body.right - 110, pinnedStart.y, {
                    steps: 4,
                });
                await page.waitForFunction(
                    (from) =>
                        (window.grid?.engine.get("scroll-position").left ?? 0) >
                        from + 100,
                    held ?? 0,
                );
                await page.mouse.up();
                await settle(page);
                const focus = (await selectedRange(page))?.focus;
                expect(focus?.columnIndex).toBeGreaterThan(8);
                expect(focus?.columnIndex).toBeLessThan(19);
            });

            test("selects the virtual cells under scroll scaling", async ({
                page,
            }) => {
                const viewport = await open(page, kind, {
                    ...CELLS,
                    rows: 1_000_000,
                    maxScrollSize: 1_000_000,
                });
                await scroll(page, viewport, 500_000);
                const first = await page.evaluate(
                    () => window.grid?.engine.get("row-window").visible.start,
                );
                expect(first).toBeGreaterThan(100_000);
                const from = (first ?? 0) + 2;
                await pressAndMove(
                    page,
                    cell(page, from, 1),
                    await centreOf(cell(page, from + 3, 2)),
                );
                await page.mouse.up();
                await settle(page);
                expect(await selectedRange(page)).toEqual(
                    range([from, 1], [from + 3, 2]),
                );
                await expect(cell(page, from + 3, 2)).toHaveAttribute(
                    "data-range-edge",
                    "bottom end",
                );
            });

            test("copies the range as TSV with Ctrl/⌘+C, no permission asked", async ({
                page,
                browserName,
            }) => {
                await open(page, kind, CELLS);
                await page.evaluate(() => {
                    document.addEventListener("copy", (event) => {
                        Object.assign(window, {
                            copied: {
                                text: event.clipboardData?.getData(
                                    "text/plain",
                                ),
                                prevented: event.defaultPrevented,
                            },
                        });
                    });
                });
                await cell(page, 1, 1).click();
                await page.keyboard.press("Shift+ArrowDown");
                await page.keyboard.press("Shift+ArrowRight");
                await page.keyboard.press("ControlOrMeta+c");
                await settle(page);
                expect(
                    await page.evaluate(
                        () => (window as unknown as { copied: unknown }).copied,
                    ),
                ).toEqual({ text: "1:1\t1:2\n2:1\t2:2", prevented: true });
                if (browserName === "chromium") {
                    // on the system clipboard itself
                    await page
                        .context()
                        .grantPermissions([
                            "clipboard-read",
                            "clipboard-write",
                        ]);
                    expect(
                        await page.evaluate(() =>
                            navigator.clipboard.readText(),
                        ),
                    ).toBe("1:1\t1:2\n2:1\t2:2");
                }
            });

            test("pastes once with Ctrl/⌘+V, the values parsed, from the range's first cell", async ({
                page,
                browserName,
            }) => {
                await open(page, kind, CELLS);
                // what the grid copied is on the clipboard: a real paste of it
                await cell(page, 1, 1).click();
                await page.keyboard.press("Shift+ArrowDown");
                await page.keyboard.press("Shift+ArrowRight");
                await page.keyboard.press("ControlOrMeta+c");
                await cell(page, 5, 2).click();
                await page.keyboard.press("Shift+ArrowUp");
                await page.keyboard.press("ControlOrMeta+v");
                await settle(page);
                expect(await page.evaluate(() => window.rangePastes)).toEqual([
                    {
                        range: range([4, 2], [5, 3]),
                        values: [
                            ["1:1", "1:2"],
                            ["2:1", "2:2"],
                        ],
                    },
                ]);
                // the grid writes nothing
                await expect(cell(page, 4, 2)).toHaveText("4:2");
                if (browserName !== "chromium") return;
                // a spreadsheet's text, quoted values and CRLF included (a page-made paste: Firefox
                // gives such an event no clipboard)
                const prevented = await page.evaluate(() => {
                    const data = new DataTransfer();
                    data.setData("text/plain", 'a\t"b\tc"\r\nd\te\r\n');
                    const event = new ClipboardEvent("paste", {
                        clipboardData: data,
                        bubbles: true,
                        cancelable: true,
                    });
                    document.activeElement?.dispatchEvent(event);
                    return event.defaultPrevented;
                });
                expect(prevented).toBe(true);
                expect(
                    await page.evaluate(() => window.rangePastes.at(-1)),
                ).toEqual({
                    range: range([4, 2], [5, 3]),
                    values: [
                        ["a", "b\tc"],
                        ["d", "e"],
                    ],
                });
            });

            test("asks a controlled parent and follows its range", async ({
                page,
            }) => {
                await open(page, kind, { ...CELLS, cells: "controlled" });
                await cell(page, 1, 1).click();
                await page.keyboard.press("Shift+ArrowDown");
                await settle(page);
                await expect(cell(page, 2, 1)).toHaveAttribute(
                    "data-range-edge",
                    "bottom start end",
                );
                await pressAndMove(
                    page,
                    cell(page, 5, 1),
                    await centreOf(cell(page, 6, 3)),
                );
                await page.mouse.up();
                await settle(page);
                expect(await selectedRange(page)).toEqual(
                    range([5, 1], [6, 3]),
                );
            });

            test("leaves a grid without cell selection as it was", async ({
                page,
            }) => {
                await open(page, kind, { rows: 1_000, columns: 20 });
                await cell(page, 1, 1).click();
                await page.keyboard.press("Shift+ArrowDown");
                await pressAndMove(
                    page,
                    cell(page, 3, 1),
                    await centreOf(cell(page, 5, 3)),
                );
                await page.mouse.up();
                await settle(page);
                await expect(
                    page.locator(
                        "[data-selected-cell], [data-range-edge], [aria-selected]",
                    ),
                ).toHaveCount(0);
                await expect(
                    page.locator('[data-grid-part="grid"]'),
                ).not.toHaveAttribute("aria-multiselectable");
            });
        });

        test.describe("cell editing", () => {
            const EDIT = { rows: 200, columns: 8, edit: 1 } as const;

            const editingCell = (page: Page) =>
                page.evaluate(() => window.grid?.model.get("editing-cell"));

            const cellEdits = (page: Page) =>
                page.evaluate(() => window.cellEdits);

            test("Enter, F2, typing and a double click edit, the editor focused", async ({
                page,
            }) => {
                await open(page, kind, EDIT);
                await cell(page, 2, 1).click();
                await page.keyboard.press("Enter");
                await expect(page.getByTestId("editor-2")).toBeFocused();
                await expect(cell(page, 2, 1)).toHaveAttribute(
                    "data-editing",
                    "",
                );
                await expect(page.getByTestId("editor-2")).toHaveValue("2:1");
                await page.keyboard.press("Escape");
                await expect(cell(page, 2, 1)).toBeFocused();
                await expect(cell(page, 2, 1)).not.toHaveAttribute(
                    "data-editing",
                );
                await page.keyboard.press("F2");
                await expect(page.getByTestId("editor-2")).toBeFocused();
                await page.keyboard.press("Escape");
                // typing: the editor starts from the key typed
                await page.keyboard.press("k");
                await expect(page.getByTestId("editor-2")).toHaveValue("k");
                await page.keyboard.type("ey");
                await expect(page.getByTestId("editor-2")).toHaveValue("key");
                await page.keyboard.press("Escape");
                await expect(cell(page, 2, 1)).toHaveText("2:1");
                await cell(page, 4, 1).dblclick();
                await expect(page.getByTestId("editor-4")).toBeFocused();
                expect(await editingCell(page)).toEqual({
                    rowIndex: 4,
                    columnIndex: 1,
                });
                expect(await cellEdits(page)).toEqual([]);
            });

            test("Enter and Tab commit and move, Shift moving back; the app writes the value", async ({
                page,
            }) => {
                await open(page, kind, EDIT);
                await cell(page, 2, 1).click();
                await page.keyboard.press("Enter");
                await page.getByTestId("editor-2").fill("first");
                await page.keyboard.press("Enter");
                await settle(page);
                await expect(cell(page, 2, 1)).toHaveText("first");
                await expect(cell(page, 3, 1)).toBeFocused();
                await page.keyboard.press("Enter");
                await page.getByTestId("editor-3").fill("second");
                await page.keyboard.press("Shift+Enter");
                await settle(page);
                await expect(cell(page, 3, 1)).toHaveText("second");
                await expect(cell(page, 2, 1)).toBeFocused();
                await page.keyboard.press("F2");
                await page.getByTestId("editor-2").fill("third");
                await page.keyboard.press("Tab");
                await settle(page);
                await expect(cell(page, 2, 1)).toHaveText("third");
                await expect(cell(page, 2, 2)).toBeFocused();
                // Shift+Tab in an edit (C5's picker, unchanged: nothing told) moves back
                for (let i = 0; i < 3; i++) {
                    await page.keyboard.press("ArrowRight");
                }
                await page.keyboard.press("F2");
                await expect(page.getByTestId("picker-2")).toBeFocused();
                await page.keyboard.press("Shift+Tab");
                await expect(cell(page, 2, 4)).toBeFocused();
                expect(await cellEdits(page)).toEqual([
                    { rowIndex: 2, columnKey: "c1", value: "first" },
                    { rowIndex: 3, columnKey: "c1", value: "second" },
                    { rowIndex: 2, columnKey: "c1", value: "third" },
                ]);
            });

            test("a click outside commits; a portalled picker marked as the edit's does not", async ({
                page,
            }) => {
                await open(page, kind, EDIT);
                await cell(page, 1, 1).click();
                await page.keyboard.press("Enter");
                await page.getByTestId("editor-1").fill("clicked out");
                await page.getByTestId("after").click();
                await settle(page);
                await expect(cell(page, 1, 1)).toHaveText("clicked out");
                expect(await editingCell(page)).toBeNull();
                // C5 edits even rows, by a picker whose options are outside the grid
                await cell(page, 2, 5).click();
                await page.keyboard.press("Enter");
                await page.getByTestId("picker-2").click();
                await page.getByTestId("option-blue").click();
                await settle(page);
                await expect(cell(page, 2, 5)).toHaveText("blue");
                await expect(cell(page, 2, 5)).toBeFocused();
                expect((await cellEdits(page)).at(-1)).toEqual({
                    rowIndex: 2,
                    columnKey: "c5",
                    value: "blue",
                });
            });

            test("keeps the editable rules: a column by the row, a cell with controls, a summary row and a group row", async ({
                page,
            }) => {
                await open(page, kind, { ...EDIT, controls: 1, summaryTop: 1 });
                // C5 edits even rows only
                await cell(page, 3, 5).click();
                await page.keyboard.press("Enter");
                expect(await editingCell(page)).toBeNull();
                // a cell with controls and no edit: Enter is its interaction, as before
                await page.keyboard.press("ArrowLeft");
                await page.keyboard.press("ArrowLeft");
                await page.keyboard.press("ArrowLeft");
                await expect(cell(page, 3, 2)).toBeFocused();
                await page.keyboard.press("Enter");
                await expect(page.getByTestId("edit-3")).toBeFocused();
                await page.keyboard.press("Escape");
                // a summary row's cell is never edited
                const summary = page.locator(
                    '[data-grid-part="summary-cell"][data-column-index="1"]',
                );
                await summary.first().click();
                await page.keyboard.press("Enter");
                await page.keyboard.press("x");
                expect(await editingCell(page)).toBeNull();
                // a group row's: Enter toggles its group, typing edits nothing
                await open(page, kind, { ...EDIT, rows: 50, groupBy: 1 });
                await cell(page, 0, 1).click();
                await page.keyboard.press("x");
                expect(await editingCell(page)).toBeNull();
            });

            test("keeps the editor's keys, copy and paste its own", async ({
                page,
            }) => {
                await open(page, kind, { ...EDIT, cells: 1 });
                await page.evaluate(() => {
                    document.addEventListener("copy", (event) => {
                        Object.assign(window, {
                            copied: event.clipboardData?.getData("text/plain"),
                            copyPrevented: event.defaultPrevented,
                        });
                    });
                });
                await cell(page, 2, 1).click();
                await page.keyboard.press("Enter");
                const editor = page.getByTestId("editor-2");
                await editor.fill("words");
                // the arrows and Shift+arrows are the field's: no move, no range
                await page.keyboard.press("ArrowLeft");
                await page.keyboard.press("Shift+ArrowLeft");
                await page.keyboard.press("ArrowDown");
                expect(await active(page)).toEqual({
                    rowIndex: 2,
                    columnIndex: 1,
                });
                expect(
                    await page.evaluate(() =>
                        window.grid?.model.get("selected-range"),
                    ),
                ).toBeNull();
                await page.keyboard.press("ControlOrMeta+a");
                await page.keyboard.press("ControlOrMeta+c");
                expect(
                    await page.evaluate(() => ({
                        copied: (window as unknown as { copied: unknown })
                            .copied,
                        prevented: (
                            window as unknown as { copyPrevented: unknown }
                        ).copyPrevented,
                    })),
                ).toEqual({ copied: "", prevented: false });
                await expect(editor).toHaveValue("words");
                await editor.press("Escape");
                expect(await cellEdits(page)).toEqual([]);
            });

            test("keeps the edited cell rendered while the grid scrolls", async ({
                page,
            }) => {
                const viewport = await open(page, kind, EDIT);
                await cell(page, 1, 1).click();
                await page.keyboard.press("Enter");
                await page.getByTestId("editor-1").fill("far");
                await scroll(page, viewport, 3_000);
                await expect(page.getByTestId("editor-1")).toBeAttached();
                await expect(page.getByTestId("editor-1")).toHaveValue("far");
                await page.getByTestId("editor-1").press("Enter");
                await settle(page);
                expect(await cellEdits(page)).toEqual([
                    { rowIndex: 1, columnKey: "c1", value: "far" },
                ]);
            });
        });

        test.describe("fill handle", () => {
            const FILL = {
                rows: 1_000,
                columns: 20,
                cells: 1,
                fill: 1,
            } as const;

            const fills = (page: Page) => page.evaluate(() => window.fills);

            const range = (
                anchor: [number, number],
                focus: [number, number],
            ) => ({
                anchor: { rowIndex: anchor[0], columnIndex: anchor[1] },
                focus: { rowIndex: focus[0], columnIndex: focus[1] },
            });

            /** Presses the fill handle and moves to a point, held. */
            async function dragHandle(page: Page, x: number, y: number) {
                const box = await boxOf(page.getByTestId("fill-handle"));
                await page.mouse.move(
                    box.x + box.width / 2,
                    box.y + box.height / 2,
                );
                await page.mouse.down();
                await page.mouse.move(x, y, { steps: 6 });
                await settle(page);
            }

            /** A cell's centre on the page. */
            async function centreOf(target: Locator) {
                const box = await boxOf(target);
                return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
            }

            test("fills down from the range, the target marked, once on release, the range grown", async ({
                page,
            }) => {
                await open(page, kind, FILL);
                await cell(page, 1, 1).click();
                await page.keyboard.press("Shift+ArrowDown");
                await page.keyboard.press("Shift+ArrowRight");
                await settle(page);
                // in the range's last cell only
                await expect(page.getByTestId("fill-handle")).toHaveCount(1);
                await expect(
                    cell(page, 2, 2).getByTestId("fill-handle"),
                ).toHaveAttribute("data-grid-part", "fill-handle");
                const target = await centreOf(cell(page, 5, 2));
                await dragHandle(page, target.x, target.y);
                await expect(page.getByTestId("fill-handle")).toHaveAttribute(
                    "data-filling",
                    "",
                );
                await expect(cell(page, 4, 1)).toHaveAttribute(
                    "data-fill-target",
                    "",
                );
                await expect(cell(page, 2, 1)).not.toHaveAttribute(
                    "data-fill-target",
                );
                await expect(cell(page, 4, 1)).toHaveCSS(
                    "background-color",
                    "rgb(255, 255, 221)",
                );
                expect(await fills(page)).toEqual([]);
                await page.mouse.up();
                await settle(page);
                expect(await fills(page)).toEqual([
                    {
                        source: range([1, 1], [2, 2]),
                        target: range([3, 1], [5, 2]),
                    },
                ]);
                await expect(page.locator("[data-fill-target]")).toHaveCount(0);
                // the fixture repeats the source: rows 1 and 2 in turn
                await expect(cell(page, 3, 1)).toHaveText("1:1");
                await expect(cell(page, 4, 2)).toHaveText("2:2");
                await expect(cell(page, 5, 1)).toHaveText("1:1");
                expect(
                    await page.evaluate(() =>
                        window.grid?.model.get("selected-range"),
                    ),
                ).toEqual(range([1, 1], [5, 2]));
                await expect(cell(page, 1, 1)).toBeFocused();
            });

            test("fills to the end when the pointer goes farther across, from the active cell", async ({
                page,
            }) => {
                await open(page, kind, FILL);
                await cell(page, 3, 1).click();
                const target = await centreOf(cell(page, 3, 4));
                await dragHandle(page, target.x, target.y + 5);
                await page.mouse.up();
                await settle(page);
                expect(await fills(page)).toEqual([
                    {
                        source: range([3, 1], [3, 1]),
                        target: range([3, 2], [3, 4]),
                    },
                ]);
                await expect(cell(page, 3, 4)).toHaveText("3:1");
            });

            test("cancels on Escape, and scrolls at the body's edge", async ({
                page,
            }) => {
                const viewport = await open(page, kind, FILL);
                await cell(page, 1, 1).click();
                const target = await centreOf(cell(page, 4, 1));
                await dragHandle(page, target.x, target.y);
                await page.keyboard.press("Escape");
                await settle(page);
                await expect(page.locator("[data-fill-target]")).toHaveCount(0);
                await page.mouse.up();
                await settle(page);
                expect(await fills(page)).toEqual([]);
                // held at the bottom edge: the rows scroll
                const body = await bodyBox(viewport);
                await dragHandle(page, target.x, body.bottom - 3);
                await page.waitForFunction(
                    () =>
                        (window.grid?.engine.get("scroll-position").top ?? 0) >
                        300,
                );
                await page.mouse.up();
                await settle(page);
                const [filled] = await fills(page);
                expect(filled?.source).toEqual(range([1, 1], [1, 1]));
                expect(filled?.target.focus.rowIndex).toBeGreaterThan(15);
            });
        });

        test.describe("tree data", () => {
            // 100 top rows, each with 3 rows, each of those with 2: a row's index is its place in
            // the whole tree (the top rows 0, 10, 20, …); a parent's C0 holds its toggle
            const TREE = { rows: 1_000, columns: 20, tree: 1 } as const;

            function row(page: Page, rowIndex: number) {
                return page.locator(
                    `[data-grid-part="row"][data-row-index="${rowIndex}"]`,
                );
            }

            function gridPart(page: Page) {
                return page.locator('[data-grid-part="grid"]');
            }

            test("makes a treegrid of the top rows, parents data rows that expand", async ({
                page,
            }) => {
                await open(page, kind, TREE);
                await expect(gridPart(page)).toHaveAttribute(
                    "role",
                    "treegrid",
                );
                await expect(gridPart(page)).toHaveAttribute(
                    "aria-rowcount",
                    "101",
                );
                const first = row(page, 0);
                await expect(first).toHaveAttribute("aria-level", "1");
                await expect(first).toHaveAttribute("aria-expanded", "false");
                await expect(first).toHaveAttribute("aria-setsize", "100");
                await expect(first).toHaveAttribute("aria-posinset", "1");
                await expect(first).not.toHaveAttribute("data-group-row");
                await expect(cell(page, 0, 0)).toHaveText("+ 0:0");
                await expect(cell(page, 1, 0)).toHaveText("+ 10:0");
                await expect(cell(page, 1, 2)).toHaveText("10:2");
            });

            test("expands a parent by its toggle, its rows a level down", async ({
                page,
            }) => {
                await open(page, kind, TREE);
                await page.getByTestId("group-toggle-0").click();
                await settle(page);
                await expect(gridPart(page)).toHaveAttribute(
                    "aria-rowcount",
                    "104",
                );
                await expect(row(page, 0)).toHaveAttribute(
                    "aria-expanded",
                    "true",
                );
                await expect(row(page, 0)).toHaveAttribute(
                    "data-group-expanded",
                    "",
                );
                await expect(row(page, 2)).toHaveAttribute("aria-level", "2");
                await expect(row(page, 2)).toHaveAttribute("aria-setsize", "3");
                await expect(row(page, 2)).toHaveAttribute(
                    "aria-posinset",
                    "2",
                );
                await expect(cell(page, 2, 0)).toHaveText("+ 4:0");
                await expect(cell(page, 4, 0)).toHaveText("+ 10:0");
                expect(
                    await page.evaluate(() => window.groupChanges.at(-1)),
                ).toEqual([0]);
            });

            test("expands with Space and →, goes up and collapses with ←", async ({
                page,
            }) => {
                await open(page, kind, TREE);
                await cell(page, 0, 1).click();
                // Enter stays the cell's: nothing opens
                await page.keyboard.press("Enter");
                await settle(page);
                await expect(row(page, 0)).toHaveAttribute(
                    "aria-expanded",
                    "false",
                );
                await page.keyboard.press(" ");
                await settle(page);
                await expect(row(page, 0)).toHaveAttribute(
                    "aria-expanded",
                    "true",
                );
                // on the first column, → opens a collapsed parent, then moves
                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("Home");
                await page.keyboard.press("ArrowRight");
                await settle(page);
                await expect(row(page, 1)).toHaveAttribute(
                    "aria-expanded",
                    "true",
                );
                await expect(row(page, 2)).toHaveAttribute("aria-level", "3");
                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("ArrowLeft");
                await settle(page);
                await expect(cell(page, 1, 0)).toBeFocused();
                await page.keyboard.press("ArrowLeft");
                await settle(page);
                await expect(row(page, 1)).toHaveAttribute(
                    "aria-expanded",
                    "false",
                );
                await page.keyboard.press("ArrowLeft");
                await settle(page);
                await expect(cell(page, 0, 0)).toBeFocused();
            });

            test("selects a parent alone, by its own key", async ({ page }) => {
                await open(page, kind, { ...TREE, selection: "multiple" });
                await page.getByTestId("select-0").click();
                await settle(page);
                await expect(row(page, 0)).toHaveAttribute(
                    "aria-selected",
                    "true",
                );
                expect(
                    await page.evaluate(() => window.selectionChanges.at(-1)),
                ).toEqual([0]);
                await page.getByTestId("group-toggle-0").click();
                await settle(page);
                await expect(row(page, 1)).toHaveAttribute(
                    "aria-selected",
                    "false",
                );
            });
        });
    });
}
