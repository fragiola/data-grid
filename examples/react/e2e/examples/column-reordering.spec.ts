import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { dragBy, header, settle } from "./helpers";

// Columns and groups moved by their header cells, an order the app keeps (controlled) and
// announces in a live region of its own: a drag, a click that still sorts, Escape, a group, the
// pinned columns, the keys and the app's reset.

const DECLARED = ["#", "Name", "Team", "Email", "City", "Joined", "Salary"];

/** The columns in order: the header's names, and the first row's values under them. */
function placed(page: Page) {
    return page.evaluate(() => {
        const texts = (selector: string) =>
            Array.from(document.querySelectorAll(selector))
                .sort(
                    (a, b) =>
                        Number(a.getAttribute("data-column-index")) -
                        Number(b.getAttribute("data-column-index")),
                )
                .map((element) => element.textContent ?? "");
        return {
            header: texts('[data-grid-part="header-cell"]:not([data-group])'),
            row: texts('[data-grid-part="cell"][data-row-index="0"]'),
        };
    });
}

/**
 * Opens the example and returns a check that the columns are in an order, the header and the
 * body alike (each column's first value as it was at the start).
 */
async function open(page: Page) {
    await openExample(page, "column-reordering");
    const start = await placed(page);
    expect(start.header).toEqual(DECLARED);
    return async (names: string[]) => {
        expect(await placed(page)).toEqual({
            header: names,
            row: names.map((name) => start.row[start.header.indexOf(name)]),
        });
    };
}

const status = (page: Page) => page.getByRole("status");

test("a header cell dragged over another moves its column on release, the drop target drawn meanwhile", async ({
    page,
}) => {
    const expectColumns = await open(page);
    await expect(header(page, "Email")).toHaveAttribute("data-reorderable", "");
    // Email (260px) from its middle to City's second half (140px): after City
    await dragBy(page, header(page, "Email"), 130 + 105, { hold: true });
    await expect(header(page, "Email")).toHaveAttribute("data-dragging", "");
    await expect(header(page, "City")).toHaveAttribute(
        "data-drop-target",
        "after",
    );
    // the app's own indicator, from that attribute: a line inside the target
    await expect(header(page, "City")).toHaveCSS("box-shadow", /inset/);
    await expect(header(page, "Email")).toHaveCSS("opacity", "0.5");
    // nothing moves before the release
    await expectColumns(DECLARED);
    await page.mouse.up();
    await settle(page);
    await expectColumns([
        "#",
        "Name",
        "Team",
        "City",
        "Email",
        "Joined",
        "Salary",
    ]);
    expect(
        await page.locator("[data-dragging], [data-drop-target]").count(),
    ).toBe(0);
    await expect(status(page)).toHaveText("Moved Email after City.");
});

test("a click still sorts, and a drag never does", async ({ page }) => {
    await open(page);
    await header(page, "City").click({ position: { x: 30, y: 10 } });
    await expect(header(page, "City")).toHaveAttribute(
        "aria-sort",
        "ascending",
    );
    // Salary (130px) from its middle to Joined's first half (120px): before Joined
    await dragBy(page, header(page, "Salary"), -65 - 90);
    await expect(header(page, "Salary")).not.toHaveAttribute("data-sort");
    await expect(header(page, "City")).toHaveAttribute(
        "aria-sort",
        "ascending",
    );
    const sorted = await placed(page);
    expect(sorted.header).toEqual([
        "#",
        "Name",
        "Team",
        "Email",
        "City",
        "Salary",
        "Joined",
    ]);
    await expect(status(page)).toHaveText("Moved Salary before Joined.");
    // the rows are sorted by city: the first row's is the first in order
    expect(sorted.row[4]).toBe("Austin");
});

test("Escape cancels a drag: nothing moves", async ({ page }) => {
    const expectColumns = await open(page);
    await dragBy(page, header(page, "Email"), 235, { hold: true });
    await expect(header(page, "City")).toHaveAttribute(
        "data-drop-target",
        "after",
    );
    await page.keyboard.press("Escape");
    await settle(page);
    await expect(header(page, "Email")).not.toHaveAttribute("data-dragging");
    await expect(header(page, "City")).not.toHaveAttribute("data-drop-target");
    // the release after Escape moves nothing
    await page.mouse.up();
    await settle(page);
    await expectColumns(DECLARED);
    await expect(status(page)).toHaveText("");
});

test("a group moves whole, and its columns only inside it", async ({
    page,
}) => {
    const expectColumns = await open(page);
    await expect(header(page, "Employment")).toHaveAttribute(
        "data-reorderable",
        "",
    );
    // Employment (250px) from its middle to Contact's first half (400px): before Contact
    await dragBy(page, header(page, "Employment"), -125 - 300);
    const grouped = ["#", "Name", "Team", "Joined", "Salary", "Email", "City"];
    await expectColumns(grouped);
    await expect(status(page)).toHaveText("Moved Employment before Contact.");
    // Email dragged over Employment's columns: it lands nowhere outside Contact
    await dragBy(page, header(page, "Email"), -300);
    await expectColumns(grouped);
    await expect(status(page)).toHaveText("Moved Employment before Contact.");
});

test("a pinned column moves only among the pinned, and # never moves", async ({
    page,
}) => {
    const expectColumns = await open(page);
    await expect(header(page, "#")).not.toHaveAttribute("data-reorderable");
    // Name dragged far right: after Team, the last pinned column
    await dragBy(page, header(page, "Name"), 500);
    const pinned = ["#", "Team", "Name", "Email", "City", "Joined", "Salary"];
    await expectColumns(pinned);
    await expect(header(page, "Name")).toHaveAttribute("data-pinned-edge", "");
    await expect(status(page)).toHaveText("Moved Name after Team.");
    // Contact dragged over the pinned columns lands nowhere among them, and # is not dragged
    await dragBy(page, header(page, "Contact"), -400);
    await dragBy(page, header(page, "#"), 300);
    await expectColumns(pinned);
});

test("Ctrl/⌘+Shift+←/→ move the active header cell's column, focus following", async ({
    page,
}) => {
    const expectColumns = await open(page);
    await header(page, "Email").click({ position: { x: 30, y: 10 } });
    await page.keyboard.press("ControlOrMeta+Shift+ArrowRight");
    await settle(page);
    const moved = ["#", "Name", "Team", "City", "Email", "Joined", "Salary"];
    await expectColumns(moved);
    await expect(header(page, "Email")).toBeFocused();
    await expect(header(page, "Email")).toHaveAttribute("data-active", "");
    await expect(status(page)).toHaveText("Moved Email after City.");
    // the last of its group: it stays
    await page.keyboard.press("ControlOrMeta+Shift+ArrowRight");
    await settle(page);
    await expectColumns(moved);
    await page.keyboard.press("ControlOrMeta+Shift+ArrowLeft");
    await settle(page);
    await expectColumns(DECLARED);
    await expect(header(page, "Email")).toBeFocused();
    await expect(status(page)).toHaveText("Moved Email before City.");
});

test("the app's reset puts every column back in its declared order", async ({
    page,
}) => {
    const expectColumns = await open(page);
    const reset = page.getByRole("button", { name: "Reset order" });
    await expect(reset).toBeDisabled();
    await dragBy(page, header(page, "Email"), 235);
    await dragBy(page, header(page, "Employment"), -425);
    await expectColumns([
        "#",
        "Name",
        "Team",
        "Joined",
        "Salary",
        "City",
        "Email",
    ]);
    await reset.click();
    await settle(page);
    await expectColumns(DECLARED);
    await expect(status(page)).toHaveText(
        "Columns back in their declared order.",
    );
    await expect(reset).toBeDisabled();
});
