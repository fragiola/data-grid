import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { boxOf, cell, dragBy, header, scrollTo, settle } from "./helpers";

// Handles the app renders (useColumnResizer), widths it keeps (controlled): a drag, the keys,
// Escape during a drag, a double click, a group, a pinned column and the app's reset.

const COLUMN = { "#": 0, Name: 1, Email: 2, City: 3, Team: 4, Joined: 5 };

/** A header cell's resize handle, by the name the app gives it. */
const handle = (page: Page, name: string) =>
    page.getByRole("separator", { name: `Resize ${name}` });

/** The widths on screen of a column's header cell and its first body cell. */
async function widths(page: Page, name: keyof typeof COLUMN) {
    return [
        (await boxOf(header(page, name))).width,
        (await boxOf(cell(page, 0, COLUMN[name]))).width,
    ];
}

const readout = (page: Page) => page.getByTestId("widths");

test("a column follows its handle live as it is dragged, within its limits", async ({
    page,
}) => {
    await openExample(page, "column-resizing");
    // "#" keeps its width: no handle, no state
    await expect(header(page, "#")).not.toHaveAttribute("data-resizable");
    await expect(header(page, "#").getByRole("separator")).toHaveCount(0);
    await expect(header(page, "Email")).toHaveAttribute("data-resizable", "");

    await dragBy(page, handle(page, "Email"), 60, { hold: true });
    // before the release: the header, the body and the app's readout follow
    expect(await widths(page, "Email")).toEqual([300, 300]);
    await expect(header(page, "Email")).toHaveAttribute("data-resizing", "");
    await expect(handle(page, "Email")).toHaveAttribute("data-resizing", "");
    await expect(handle(page, "Email")).toHaveAttribute("aria-valuenow", "300");
    await expect(readout(page)).toHaveText("Resizing Email to 300px");
    await page.mouse.up();
    await settle(page);
    await expect(header(page, "Email")).not.toHaveAttribute("data-resizing");
    await expect(readout(page)).toHaveText("Email 300px");

    // Team: between 80 and 200
    await expect(handle(page, "Team")).toHaveAttribute("aria-valuemin", "80");
    await expect(handle(page, "Team")).toHaveAttribute("aria-valuemax", "200");
    await dragBy(page, handle(page, "Team"), -100);
    expect(await widths(page, "Team")).toEqual([80, 80]);
    await dragBy(page, handle(page, "Team"), 300);
    expect(await widths(page, "Team")).toEqual([200, 200]);
});

test("F2 on a header reaches its handle, the arrows resize, Escape gives the keys back", async ({
    page,
}) => {
    await openExample(page, "column-resizing");
    await header(page, "Email").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("F2");
    const email = handle(page, "Email");
    await expect(email).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(email).toHaveAttribute("aria-valuenow", "250");
    await page.keyboard.press("Shift+ArrowRight");
    await expect(email).toHaveAttribute("aria-valuenow", "300");
    await page.keyboard.press("ArrowLeft");
    await expect(email).toHaveAttribute("aria-valuenow", "290");
    expect(await widths(page, "Email")).toEqual([290, 290]);
    // no maximum: End goes to the one it reports (the view's width), then Home to its minimum
    await page.keyboard.press("End");
    const valueMax = await email.getAttribute("aria-valuemax");
    await expect(email).toHaveAttribute("aria-valuenow", String(valueMax));
    await page.keyboard.press("Home");
    await expect(email).toHaveAttribute("aria-valuenow", "160");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await expect(header(page, "Email")).toBeFocused();
    expect(await widths(page, "Email")).toEqual([170, 170]);
    await expect(readout(page)).toHaveText("Email 170px");
});

test("Escape during a drag restores the width, and a double click resets it", async ({
    page,
}) => {
    await openExample(page, "column-resizing");
    await dragBy(page, handle(page, "City"), 50, { hold: true });
    expect(await widths(page, "City")).toEqual([190, 190]);
    await page.keyboard.press("Escape");
    await settle(page);
    expect(await widths(page, "City")).toEqual([140, 140]);
    await page.mouse.up();
    await settle(page);
    expect(await widths(page, "City")).toEqual([140, 140]);
    await expect(readout(page)).toHaveText("Every column at its own width");

    await dragBy(page, handle(page, "City"), 70);
    expect(await widths(page, "City")).toEqual([210, 210]);
    await handle(page, "City").dblclick();
    await settle(page);
    expect(await widths(page, "City")).toEqual([140, 140]);
    await expect(readout(page)).toHaveText("Every column at its own width");
});

test("a group's handle resizes its columns together", async ({ page }) => {
    await openExample(page, "column-resizing");
    const work = handle(page, "Work");
    await expect(work).toHaveAttribute("aria-valuenow", "360");
    await dragBy(page, work, 60);
    // three columns of 120: each takes a third
    for (const name of ["Team", "Joined"] as const) {
        expect(await widths(page, name)).toEqual([140, 140]);
    }
    expect((await boxOf(header(page, "Work"))).width).toBe(420);
    await expect(work).toHaveAttribute("aria-valuenow", "420");
    await expect(readout(page)).toHaveText(
        "Team 140px · Joined 140px · Salary 140px",
    );
    await work.dblclick();
    await settle(page);
    expect(await widths(page, "Team")).toEqual([120, 120]);
    await expect(work).toHaveAttribute("aria-valuenow", "360");
});

test("a pinned column resizes and stays pinned", async ({ page }) => {
    // narrower than the columns: the grid scrolls sideways
    await page.setViewportSize({ width: 640, height: 600 });
    await openExample(page, "column-resizing");
    await dragBy(page, handle(page, "Name"), 40);
    expect(await widths(page, "Name")).toEqual([220, 220]);
    await scrollTo(page, { left: 300 });
    const start = (await boxOf(header(page, "#"))).x;
    for (const target of [header(page, "Name"), cell(page, 0, COLUMN.Name)]) {
        const box = await boxOf(target);
        expect(box.x).toBe(start + 64);
        expect(box.width).toBe(220);
    }
    await expect(header(page, "Name")).toHaveAttribute("data-pinned-edge", "");
});

test("the app's reset puts every column back to its own width", async ({
    page,
}) => {
    await openExample(page, "column-resizing");
    const reset = page.getByRole("button", { name: "Reset widths" });
    await expect(reset).toBeDisabled();
    await dragBy(page, handle(page, "Email"), 60);
    await dragBy(page, handle(page, "Name"), -40);
    await expect(readout(page)).toHaveText("Email 300px · Name 140px");
    await reset.click();
    await settle(page);
    expect(await widths(page, "Email")).toEqual([240, 240]);
    expect(await widths(page, "Name")).toEqual([180, 180]);
    await expect(readout(page)).toHaveText("Every column at its own width");
    await expect(reset).toBeDisabled();
});
