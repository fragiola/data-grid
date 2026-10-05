import { expect, type Page, test } from "@playwright/test";
import { openExample, THEMES } from "../helpers";
import { scrollTo, settle, viewport } from "./helpers";

// Master-detail (Epic #41): orders expand into a detail below their cells, holding a summary and
// a grid of their items; each grid keeps its own keys and focus, and the detail stays as wide as
// the view while the orders scroll sideways.

/** The orders grid's cell: not one of an items grid, which has cells at the same indexes. */
function order(page: Page, rowIndex: number, columnIndex: number) {
    return page.locator(
        `[data-grid-part="cell"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]:not([aria-label^="Items of order"] *)`,
    );
}

const detail = (page: Page, rowIndex: number) =>
    page.locator(`[data-grid-part="row-detail"][data-row-index="${rowIndex}"]`);

const items = (page: Page, id: number) =>
    page.getByRole("grid", { name: `Items of order ${id}` });

const expander = (page: Page, id: number) =>
    page.getByRole("button", { name: new RegExp(`items of order ${id}$`) });

/** The orders grid's active cell. */
function activeOrder(page: Page) {
    return page.evaluate(() => {
        const cell = [
            ...document.querySelectorAll(
                '[data-grid-part="cell"][data-active]',
            ),
        ].find(
            (element) =>
                element.closest('[role="grid"]')?.getAttribute("aria-label") ===
                "Orders",
        );
        return cell
            ? [
                  cell.getAttribute("data-row-index"),
                  cell.getAttribute("data-column-index"),
              ]
            : null;
    });
}

test("expands and collapses an order, its detail below its cells", async ({
    page,
}) => {
    await openExample(page, "master-detail");
    // the first order starts expanded
    await expect(expander(page, 1001)).toHaveAttribute("aria-expanded", "true");
    await expect(items(page, 1001)).toBeVisible();
    await expect(expander(page, 1002)).toHaveAttribute(
        "aria-expanded",
        "false",
    );
    await expander(page, 1002).click();
    await settle(page);
    await expect(expander(page, 1002)).toHaveAttribute("aria-expanded", "true");
    const cells = await order(page, 1, 1).boundingBox();
    const box = await detail(page, 1).boundingBox();
    expect(box?.y).toBeCloseTo((cells?.y ?? 0) + (cells?.height ?? 0), 0);
    await expect(detail(page, 1)).toContainText("Total");
    await expect(items(page, 1002)).toBeVisible();
    await expander(page, 1002).click();
    await settle(page);
    await expect(detail(page, 1)).toHaveCount(0);
});

test("toggles from the keyboard, and the arrows pass over a detail", async ({
    page,
}) => {
    await openExample(page, "master-detail");
    await order(page, 0, 1).click();
    await page.keyboard.press("ArrowLeft");
    // Enter on the expander cell collapses the first order, Space expands it again
    await page.keyboard.press("Enter");
    await settle(page);
    await expect(detail(page, 0)).toHaveCount(0);
    await page.keyboard.press("Space");
    await settle(page);
    await expect(detail(page, 0)).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await settle(page);
    expect(await activeOrder(page)).toEqual(["1", "0"]);
    await expect(order(page, 1, 0)).toBeFocused();
});

test("keys inside an order's items move only that grid; Tab and Escape cross the levels", async ({
    page,
}) => {
    await openExample(page, "master-detail");
    await order(page, 0, 2).click();
    // Tab goes from the active order into its items
    await page.keyboard.press("Tab");
    const inner = items(page, 1001);
    await expect(
        inner.locator('[data-row-index="0"][data-column-index="0"]'),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await expect(
        inner.locator('[data-row-index="1"][data-column-index="1"]'),
    ).toBeFocused();
    // the orders grid stays where it was
    expect(await activeOrder(page)).toEqual(["0", "2"]);
    // Escape returns to the order, on its expander cell
    await page.keyboard.press("Escape");
    await expect(order(page, 0, 0)).toBeFocused();
    expect(await activeOrder(page)).toEqual(["0", "0"]);
});

test("keeps the detail as wide as the view while the orders scroll sideways", async ({
    page,
}) => {
    await openExample(page, "master-detail");
    const view = async () => {
        const element = await viewport(page).evaluate((root) => ({
            left: root.getBoundingClientRect().left + root.clientLeft,
            width: root.clientWidth,
        }));
        const box = await detail(page, 0).boundingBox();
        if (!box) throw new Error("no detail");
        return { left: box.x - element.left, width: box.width, view: element };
    };
    for (const left of [0, "50%", "100%"] as const) {
        await scrollTo(page, { left });
        const { left: at, width, view: element } = await view();
        expect(at, `at ${left}`).toBeCloseTo(0, 0);
        expect(width).toBeCloseTo(element.width, 0);
    }
});

for (const theme of THEMES) {
    test(`renders in the ${theme.name} theme`, async ({ page }) => {
        await openExample(page, "master-detail", { theme: theme.name });
        await expect(items(page, 1001)).toBeVisible();
        await expect(detail(page, 0)).toBeVisible();
    });
}

test("measures the details once asked: each as tall as its content, the next order right after", async ({
    page,
}) => {
    await openExample(page, "master-detail");
    await page.getByRole("switch", { name: "Measure the details" }).click();
    await settle(page);
    await expander(page, 1003).click();
    await settle(page);
    for (const rowIndex of [0, 2]) {
        const measured = await detail(page, rowIndex).evaluate((element) => {
            const content = element.firstElementChild as HTMLElement | null;
            const style = getComputedStyle(element);
            return {
                height: element.getBoundingClientRect().height,
                content:
                    (content?.getBoundingClientRect().height ?? 0) +
                    Number.parseFloat(style.borderTopWidth) +
                    Number.parseFloat(style.borderBottomWidth),
                bottom: element.getBoundingClientRect().bottom,
            };
        });
        expect(measured.height).toBeCloseTo(measured.content, 0);
        const next = await order(page, rowIndex + 1, 1).boundingBox();
        expect(Math.abs((next?.y ?? 0) - measured.bottom)).toBeLessThan(1);
    }
});
