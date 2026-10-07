import { expect, type Locator, type Page, test } from "@playwright/test";
import {
    boxOf,
    cell,
    dragBy,
    scrollTo,
    settle,
    viewport,
} from "../../../examples/react/e2e/examples/helpers.ts";

// The combined stress spec (Epic #89, E5.3): every feature on at once (fixtures/stress-grid),
// 1,000,000 rows and 1,000 columns, both axes scaled, as a table and as divs, in Chromium, Firefox
// and WebKit. Each test checks the grid stays correct while the others' features are on: the
// right cells at the right places, ARIA counts, the active cell, no console error, and no React
// render for a scroll inside the rendered window (D9).

const KINDS = ["table", "div"] as const;
/** 1,000,000 rows, 2 header rows and a summary row at the top and at the bottom */
const ARIA_ROW_COUNT = "1000004";
/** 1,000 columns, G1's C13 shown only collapsed */
const ARIA_COLUMN_COUNT = "999";
/** a body row's `aria-rowindex`: under 2 header rows and the top summary row, 1-based */
const ariaRow = (rowIndex: number) => String(rowIndex + 4);

/** The console's errors and the page's uncaught ones, for each test: none is expected. */
let errors: string[] = [];

test.beforeEach(({ page }) => {
    errors = [];
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
});

test.afterEach(() => {
    expect(errors).toEqual([]);
});

async function open(page: Page, kind: string, query = "") {
    await page.goto(`/fixtures/stress-grid/?kind=${kind}${query}`);
    await expect(page.locator('[data-grid-part="grid"]')).toBeVisible();
    await settle(page);
}

const commits = (page: Page) => page.evaluate(() => window.commits);

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

const active = (page: Page) =>
    page.evaluate(() => window.grid?.model.get("active-position"));

/** The physical scroll, read. */
const scrollOf = (page: Page) =>
    viewport(page).evaluate((element) => ({
        top: element.scrollTop,
        left: element.scrollLeft,
    }));

const scrollPosition = (page: Page) =>
    page.evaluate(() => window.grid?.engine.get("scroll-position"));

/** The rendered ranges of both windows (what a render depends on; the visible ones move freely). */
async function rendered(page: Page) {
    const { rows, columns } = await windows(page);
    return { rows: rows.rendered, columns: columns.rendered };
}

/**
 * The wheel, a few pixels at a time, down and toward the end then back, the pointer over the
 * body: under scroll scaling the engine moves the content by exactly the wheel's delta (a native
 * scroll of a pixel would jump hundreds of rows). React renders nothing for a step that keeps the
 * rendered windows (D9), however many features are on, and once for a step that changes them
 * (variable row heights can move a rendered end by a row); most steps keep them.
 */
async function expectNoRenderOnScroll(page: Page) {
    const view = await boxOf(viewport(page));
    await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
    const start = await scrollPosition(page);
    // away from the edges it stands at: down and toward the end, or back (the wheel's x is
    // physical: right to left, toward the end is to the left)
    const rtl = await viewport(page).evaluate(
        (element) => getComputedStyle(element).direction === "rtl",
    );
    const y = (start?.top ?? 0) > 100 ? -6 : 6;
    const x = ((start?.left ?? 0) > 100 ? -6 : 6) * (rtl ? -1 : 1);
    const moves = [
        [0, y],
        [x, 0],
        [0, y],
        [x, 0],
        [0, -y],
        [-x, 0],
        [0, -y],
        [-x, 0],
    ] as const;
    let kept = 0;
    for (const [index, [dx, dy]] of moves.entries()) {
        const windowsBefore = await rendered(page);
        const before = await commits(page);
        await page.mouse.wheel(dx, dy);
        await settle(page);
        // the content moved: the wheel scrolled the grid
        if (index === 3) expect(await scrollPosition(page)).not.toEqual(start);
        const same =
            JSON.stringify(await rendered(page)) ===
            JSON.stringify(windowsBefore);
        if (same) kept += 1;
        expect(await commits(page), `step ${index}`).toBe(
            before + (same ? 0 : 1),
        );
    }
    expect(kept).toBeGreaterThanOrEqual(6);
}

/** The text a copy put on the clipboard, read from the page's copy event. */
async function listenToCopies(page: Page) {
    await page.evaluate(() => {
        document.addEventListener("copy", (event) => {
            Object.assign(window, {
                copied: event.clipboardData?.getData("text/plain"),
            });
        });
    });
}

const copied = (page: Page) =>
    page.evaluate(() => (window as unknown as { copied?: string }).copied);

/** A header cell of a column (its own, not a group's), by its index. */
const headerCell = (page: Page, columnIndex: number) =>
    page.locator(
        `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]:not([data-group])`,
    );

/** The texts of the header cells of the columns (not the groups), in their order. */
const columnNames = (page: Page) =>
    page
        .locator('[data-grid-part="header-cell"]:not([data-group])')
        .evaluateAll((cells) =>
            cells
                .map((cell) => ({
                    index: Number(cell.getAttribute("data-column-index")),
                    name: cell.textContent ?? "",
                }))
                .sort((a, b) => a.index - b.index)
                .map(({ name }) => name),
        );

/** A rendered body row by its index. */
const row = (page: Page, rowIndex: number) =>
    page.locator(`[data-grid-part="row"][data-row-index="${rowIndex}"]`);

/** Presses `from` at its centre, moves to a page point and, unless told to hold, releases. */
async function dragTo(
    page: Page,
    from: Locator,
    to: { x: number; y: number },
    { hold = false } = {},
) {
    const box = await boxOf(from);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await settle(page);
    if (!hold) {
        await page.mouse.up();
        await settle(page);
    }
}

/** A point at `fraction` of a cell's height, in its middle across. */
async function pointIn(target: Locator, fraction = 0.5) {
    const box = await boxOf(target);
    return { x: box.x + box.width / 2, y: box.y + box.height * fraction };
}

/**
 * A visible body row from the row window, at least `from` rows in and three before its end, whose
 * index fits `fits`.
 */
async function visibleRow(
    page: Page,
    fits: (rowIndex: number) => boolean,
    from = 1,
) {
    const { rows } = await windows(page);
    for (
        let index = rows.visible.start + from;
        index < rows.visible.end - 3;
        index++
    ) {
        if (fits(index)) return index;
    }
    throw new Error("no such row in view");
}

for (const kind of KINDS) {
    test.describe(`stress: ${kind}`, () => {
        test("scrolls far on both axes, scaled, the right cells in place and no render inside a window", async ({
            page,
        }) => {
            await open(page, kind);
            const grid = page.locator('[data-grid-part="grid"]');
            await expect(grid).toHaveAttribute("aria-rowcount", ARIA_ROW_COUNT);
            await expect(grid).toHaveAttribute(
                "aria-colcount",
                ARIA_COLUMN_COUNT,
            );
            // both axes scaled: the sizer is capped, the dataset is not
            const size = await viewport(page).evaluate((element) => ({
                height: element.scrollHeight,
                width: element.scrollWidth,
            }));
            expect(size.height).toBeLessThan(81_000);
            expect(size.width).toBeLessThanOrEqual(80_000);
            await expectNoRenderOnScroll(page);

            for (const at of ["50%", "100%", "25%"] as const) {
                await scrollTo(page, { top: at, left: at });
                const { rows, columns } = await windows(page);
                const rowIndex = rows.visible.start + 2;
                const columnIndex = columns.visible.start + 1;
                // the cell the windows say is in view holds its own value, at its ARIA place
                const target = cell(page, rowIndex, columnIndex);
                await expect(target).toBeVisible();
                // its column's own value: `<row>:<n>` under the header cell `C<n>`
                const name = await headerCell(page, columnIndex).textContent();
                await expect(target).toContainText(
                    `${rowIndex}:${name?.slice(1)}`,
                );
                await expect(row(page, rowIndex)).toHaveAttribute(
                    "aria-rowindex",
                    ariaRow(rowIndex),
                );
                await expect(target).toHaveAttribute(
                    "aria-colindex",
                    String(columnIndex + 1),
                );
                // the header over its column, the pinned columns at the edges
                const [header, body] = [
                    await boxOf(headerCell(page, columnIndex)),
                    await boxOf(target),
                ];
                expect(Math.abs(header.x - body.x)).toBeLessThan(1);
                const view = await boxOf(viewport(page));
                const first = await boxOf(cell(page, rowIndex, 0));
                expect(Math.abs(first.x - view.x)).toBeLessThan(1);
                await expectNoRenderOnScroll(page);
            }

            // the end is the dataset's end: the last row and the last column that scrolls
            await scrollTo(page, { top: "100%", left: "100%" });
            // (C13 is hidden while G1 is expanded: C997 is at index 996)
            const last = cell(page, 999_999, 996);
            await expect(last).toBeVisible();
            await expect(last).toContainText("999999:997");
            await expect(cell(page, 999_999, 998)).toContainText("999999:999");
            const { rows } = await windows(page);
            expect(rows.visible.end).toBe(1_000_000);
            // the bottom summary row stays at the bottom, under the last row
            const summary = page
                .locator('[data-grid-part="summary-row"]')
                .last();
            expect((await boxOf(summary)).y).toBeGreaterThanOrEqual(
                (await boxOf(last)).y + (await boxOf(last)).height - 1,
            );

            // the keys across both scaled axes: Ctrl+Home to the first cell (C0's header cell,
            // spanning both header rows), Ctrl+End back to the last, each in view and focused
            await cell(page, 999_998, 996).click();
            await page.keyboard.press("ControlOrMeta+Home");
            await settle(page);
            expect(await active(page)).toEqual({
                rowIndex: -2,
                columnIndex: 0,
            });
            await expect(headerCell(page, 0)).toBeFocused();
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("ArrowDown");
            await expect(cell(page, 0, 0)).toBeFocused();
            await expect(cell(page, 0, 0)).toContainText("0:0");
            await page.keyboard.press("ControlOrMeta+End");
            await settle(page);
            // the grid's last row: the bottom summary row, after the body's
            expect(await active(page)).toEqual({
                rowIndex: 1_000_000,
                columnIndex: 998,
            });
            await expect(
                page.locator(
                    '[data-grid-part="summary-cell"][data-row-index="1000000"][data-column-index="998"]',
                ),
            ).toBeFocused();
            await page.keyboard.press("ArrowUp");
            await expect(cell(page, 999_999, 998)).toBeFocused();
            await expect(cell(page, 999_999, 996)).toBeVisible();
        });

        test("sorts, resizes, reorders and collapses columns, far from the start", async ({
            page,
        }) => {
            await open(page, kind);
            await scrollTo(page, { top: "50%" });
            // a sort: aria-sort on its header cell, the rows as they were (the app's)
            const c2 = headerCell(page, 2);
            await c2.click();
            await expect(c2).toHaveAttribute("aria-sort", "ascending");
            await expect(c2).toHaveAttribute("data-sort", "ascending");
            await c2.click();
            await c2.click();
            await expect(c2).not.toHaveAttribute("aria-sort");
            expect(await page.evaluate(() => window.sortChanges)).toEqual([
                [{ columnKey: "c2", direction: "ascending" }],
                [{ columnKey: "c2", direction: "descending" }],
                [],
            ]);

            // a resize: the header cell and the body cells follow
            const { rows } = await windows(page);
            const rowIndex = rows.visible.start + 1;
            await dragBy(page, page.getByTestId("resizer-c2"), 50);
            expect((await boxOf(c2)).width).toBeCloseTo(150, 0);
            expect((await boxOf(cell(page, rowIndex, 2))).width).toBeCloseTo(
                150,
                0,
            );
            expect(
                await page.evaluate(() => window.widthChanges.at(-1)),
            ).toEqual({ c2: 150 });

            // a reorder with the keys: C5 after C6, the active cell following it
            await headerCell(page, 5).click();
            await page.keyboard.press("ControlOrMeta+Shift+ArrowRight");
            await settle(page);
            expect((await columnNames(page)).slice(0, 8)).toEqual([
                "C0",
                "C1",
                "C2",
                "C3",
                "C4",
                "C6",
                "C5",
                "C7",
            ]);
            expect(await active(page)).toEqual({
                rowIndex: -1,
                columnIndex: 6,
            });
            await expect(headerCell(page, 6)).toBeFocused();
            // a reorder by a drag: C998 (pinned at the end) after C999
            const c998 = headerCell(page, 997);
            await expect(c998).toHaveText("C998");
            // past C999's middle: after it
            await dragBy(page, c998, 130);
            await expect(headerCell(page, 998)).toHaveText("C998");

            // the group collapsed: C13 shown, C3–C12 hidden, the counts following
            await page.getByTestId("toggle-G1").click();
            await settle(page);
            await expect(
                page.locator('[data-grid-part="grid"]'),
            ).toHaveAttribute("aria-colcount", "990");
            expect((await columnNames(page)).slice(0, 4)).toEqual([
                "C0",
                "C1",
                "C2",
                "C13",
            ]);
            // C2 kept its width, its cells their values
            expect((await boxOf(headerCell(page, 2))).width).toBeCloseTo(
                150,
                0,
            );
            await expect(cell(page, rowIndex, 3)).toContainText(
                `${rowIndex}:13`,
            );
            await expectNoRenderOnScroll(page);
            await page.getByTestId("toggle-G1").click();
            await expect(
                page.locator('[data-grid-part="grid"]'),
            ).toHaveAttribute("aria-colcount", ARIA_COLUMN_COUNT);
            expect(await page.evaluate(() => window.collapseChanges)).toEqual([
                ["G1"],
                [],
            ]);
        });

        test("moves a row and selects rows, by checkbox and by key", async ({
            page,
        }) => {
            await open(page, kind);
            // row 1's handle dropped on row 3's lower half: after it
            await dragTo(
                page,
                page.getByTestId("handle-1"),
                await pointIn(cell(page, 3, 2), 0.75),
            );
            expect(await page.evaluate(() => window.rowMoves)).toEqual([
                { fromIndex: 1, toIndex: 3, rowKey: 1 },
            ]);
            for (const [rowIndex, id] of [
                [1, 2],
                [2, 3],
                [3, 1],
                [4, 4],
            ] as const) {
                await expect(cell(page, rowIndex, 2)).toHaveText(`${id}:2`);
            }

            // a checkbox, then Shift+click: a range of rows, by key
            await page.getByTestId("select-2").click();
            await page.getByTestId("select-5").click({ modifiers: ["Shift"] });
            for (const rowIndex of [2, 3, 4, 5]) {
                await expect(row(page, rowIndex)).toHaveAttribute(
                    "aria-selected",
                    "true",
                );
            }
            await expect(row(page, 1)).toHaveAttribute(
                "aria-selected",
                "false",
            );
            expect(
                await page.evaluate(() => window.selectionChanges.at(-1)),
            ).toEqual([3, 1, 4, 5]);

            // far down: Shift+Space toggles the active row
            await scrollTo(page, { top: "75%" });
            const rowIndex = await visibleRow(page, () => true, 2);
            await cell(page, rowIndex, 5).click();
            await page.keyboard.press("Shift+Space");
            await expect(row(page, rowIndex)).toHaveAttribute(
                "aria-selected",
                "true",
            );
            await expect(row(page, rowIndex)).toHaveAttribute(
                "data-selected",
                "",
            );
            expect(await active(page)).toEqual({ rowIndex, columnIndex: 5 });
            await expect(cell(page, rowIndex, 5)).toBeFocused();
            await expectNoRenderOnScroll(page);
        });

        test("edits, copies, pastes and fills far down, the values kept through a scroll away", async ({
            page,
        }) => {
            await open(page, kind);
            await listenToCopies(page);
            await scrollTo(page, { top: "50%" });
            // an even row, off the spanned ones (every fifth), with three more after it in view
            const rowIndex = await visibleRow(
                page,
                (index) => index % 10 === 2,
            );
            const scrolled = await scrollOf(page);

            // a text edit (C3), then a picker's (C4, even rows)
            await cell(page, rowIndex, 3).click();
            await page.keyboard.press("Enter");
            const editor = page.getByTestId(`editor-${rowIndex}`);
            await expect(editor).toBeFocused();
            await editor.fill("edited");
            await page.keyboard.press("Enter");
            await settle(page);
            await expect(cell(page, rowIndex, 3)).toHaveText("edited");
            await expect(cell(page, rowIndex + 1, 3)).toBeFocused();
            await cell(page, rowIndex, 4).click();
            await page.keyboard.press("Enter");
            await page.getByTestId(`picker-${rowIndex}`).click();
            await page.getByTestId("option-red").click();
            await settle(page);
            await expect(cell(page, rowIndex, 4)).toHaveText("red");
            expect(await page.evaluate(() => window.cellEdits)).toEqual([
                { rowIndex, columnKey: "c3", value: "edited" },
                { rowIndex, columnKey: "c4", value: "red" },
            ]);

            // a range copied as TSV, pasted two rows down
            await cell(page, rowIndex, 3).click();
            await page.keyboard.press("Shift+ArrowDown");
            await page.keyboard.press("Shift+ArrowRight");
            await expect(cell(page, rowIndex + 1, 4)).toHaveAttribute(
                "data-selected-cell",
                "",
            );
            await page.keyboard.press("ControlOrMeta+c");
            await settle(page);
            expect(await copied(page)).toBe(
                `edited\tred\n${rowIndex + 1}:3\t${rowIndex + 1}:4`,
            );
            await cell(page, rowIndex + 2, 3).click();
            await page.keyboard.press("ControlOrMeta+v");
            await settle(page);
            expect(await page.evaluate(() => window.rangePastes)).toEqual([
                {
                    range: {
                        anchor: { rowIndex: rowIndex + 2, columnIndex: 3 },
                        focus: { rowIndex: rowIndex + 3, columnIndex: 4 },
                    },
                    values: [
                        ["edited", "red"],
                        [`${rowIndex + 1}:3`, `${rowIndex + 1}:4`],
                    ],
                },
            ]);
            await expect(cell(page, rowIndex + 2, 3)).toHaveText("edited");
            await expect(cell(page, rowIndex + 3, 4)).toHaveText(
                `${rowIndex + 1}:4`,
            );

            // a fill down from two cells of C5, by the handle
            await cell(page, rowIndex, 5).click();
            await page.keyboard.press("Shift+ArrowDown");
            await settle(page);
            await expect(page.getByTestId("fill-handle")).toHaveCount(1);
            await dragTo(
                page,
                page.getByTestId("fill-handle"),
                await pointIn(cell(page, rowIndex + 3, 5)),
            );
            expect(await page.evaluate(() => window.fills)).toEqual([
                {
                    source: {
                        anchor: { rowIndex, columnIndex: 5 },
                        focus: { rowIndex: rowIndex + 1, columnIndex: 5 },
                    },
                    target: {
                        anchor: { rowIndex: rowIndex + 2, columnIndex: 5 },
                        focus: { rowIndex: rowIndex + 3, columnIndex: 5 },
                    },
                },
            ]);
            await expect(cell(page, rowIndex + 2, 5)).toHaveText(
                `${rowIndex}:5`,
            );
            await expect(cell(page, rowIndex + 3, 5)).toHaveText(
                `${rowIndex + 1}:5`,
            );

            // away to the top and back: the values written are the rows'
            await scrollTo(page, { top: 0, left: 0 });
            // (the active cell's row stays rendered: its focus is kept)
            await expect(cell(page, rowIndex + 2, 3)).toHaveCount(0);
            await scrollTo(page, scrolled);
            await expect(cell(page, rowIndex, 3)).toHaveText("edited");
            await expect(cell(page, rowIndex, 4)).toHaveText("red");
            await expect(cell(page, rowIndex + 2, 3)).toHaveText("edited");
            await expect(cell(page, rowIndex + 3, 5)).toHaveText(
                `${rowIndex + 1}:5`,
            );
            // the range stayed, grown by the fill
            expect(
                await page.evaluate(() =>
                    window.grid?.model.get("selected-range"),
                ),
            ).toEqual({
                anchor: { rowIndex, columnIndex: 5 },
                focus: { rowIndex: rowIndex + 3, columnIndex: 5 },
            });
        });

        test("expands a detail, spans cells, and turns right to left with everything on, no render on scroll", async ({
            page,
        }) => {
            await open(page, kind);
            // a span: row 5 (every fifth row) spans C6–C8, C998 its part (C998–C999)
            await expect(cell(page, 5, 6)).toHaveAttribute("aria-colspan", "3");
            await expect(cell(page, 5, 7)).toHaveCount(0);
            await expect(cell(page, 5, 997)).toHaveAttribute(
                "aria-colspan",
                "2",
            );
            // a detail below row 1, row 2 moved down by its height
            const before = (await boxOf(cell(page, 2, 2))).y;
            await page.getByTestId("expand-1").click();
            await expect(page.getByTestId("detail-1")).toBeVisible();
            expect((await boxOf(cell(page, 2, 2))).y - before).toBeCloseTo(
                120,
                0,
            );
            await expect(
                page.locator('[data-grid-part="grid"]'),
            ).toHaveAttribute("aria-rowcount", ARIA_ROW_COUNT);
            // a range and a selected row on screen too
            await cell(page, 3, 2).click();
            await page.keyboard.press("Shift+ArrowDown");
            await page.getByTestId("select-4").click();
            await expectNoRenderOnScroll(page);

            // right to left: the pinned columns at the right edge, the arrows mirrored
            await page.getByTestId("toggle-dir").click();
            await settle(page);
            await expect(viewport(page)).toHaveAttribute("dir", "rtl");
            const viewRight = await viewport(page).evaluate(
                (element) =>
                    element.getBoundingClientRect().left +
                    element.clientLeft +
                    element.clientWidth,
            );
            const first = await boxOf(cell(page, 6, 0));
            expect(Math.abs(first.x + first.width - viewRight)).toBeLessThan(1);
            await expect(page.getByTestId("detail-1")).toBeVisible();
            await cell(page, 6, 2).click();
            await page.keyboard.press("ArrowLeft");
            expect(await active(page)).toEqual({ rowIndex: 6, columnIndex: 3 });
            await expect(cell(page, 6, 3)).toBeFocused();
            await expectNoRenderOnScroll(page);
            // far into the columns, right to left: the cells in view hold their values
            await scrollTo(page, { top: "40%", left: -30_000 });
            const { rows, columns } = await windows(page);
            const target = cell(
                page,
                rows.visible.start + 1,
                columns.visible.start + 1,
            );
            await expect(target).toBeVisible();
            await expect(target).toContainText(`${rows.visible.start + 1}:`);
            await expectNoRenderOnScroll(page);
            // and back
            await page.getByTestId("toggle-dir").click();
            await settle(page);
            await expect(viewport(page)).not.toHaveAttribute("dir", "rtl");
            await expectNoRenderOnScroll(page);
        });

        test("groups 100,000 rows in memory: expands a group, scrolls to its end, collapses it", async ({
            page,
        }) => {
            await open(page, kind, "&grouped=1");
            const grid = page.locator('[data-grid-part="grid"]');
            // 7 group rows
            await expect(grid).toHaveAttribute("aria-rowcount", "11");
            await expect(cell(page, 0, 5)).toContainText("g0");
            await cell(page, 0, 5).click();
            await page.keyboard.press("Enter");
            await settle(page);
            // g0 holds 14,286 rows (index % 7 = 0 of 100,000)
            await expect(grid).toHaveAttribute(
                "aria-rowcount",
                String(7 + 14_286 + 4),
            );
            await expect(row(page, 0)).toHaveAttribute("aria-expanded", "true");
            await expect(cell(page, 1, 2)).toHaveText("0:2");
            await expect(cell(page, 2, 2)).toHaveText("7:2");
            await scrollTo(page, { top: "100%" });
            await expect(cell(page, 14_292, 5)).toContainText("g6");
            await expect(cell(page, 14_286, 2)).toHaveText("99995:2");
            await expectNoRenderOnScroll(page);
            await scrollTo(page, { top: 0 });
            await cell(page, 0, 5).click();
            await page.keyboard.press("Enter");
            await settle(page);
            await expect(grid).toHaveAttribute("aria-rowcount", "11");
        });
    });
}
