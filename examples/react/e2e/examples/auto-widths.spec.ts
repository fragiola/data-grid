import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { boxOf, cell, contentWidth, header, settle, viewport } from "./helpers";

// Widths the grid gives (Epic #80): Name fits its content at the start (`autoSize`), Email and
// City share what the others leave of the grid's width and follow it (`flex`), a double click
// or Enter on a handle and the app's "Fit all" fit columns to their content, and "Reset widths"
// gives the grid's widths back.

const COLUMN = { "#": 0, Name: 1, Email: 2, City: 3, Team: 4, Salary: 5 };

type Name = keyof typeof COLUMN;

/** A header cell's resize handle, by the name the app gives it. */
const handle = (page: Page, name: Name) =>
    page.getByRole("separator", { name: `Resize ${name}` });

/** The widths on screen of a column's header cell and its first body cell. */
async function widths(page: Page, name: Name) {
    return [
        (await boxOf(header(page, name))).width,
        (await boxOf(cell(page, 0, COLUMN[name]))).width,
    ];
}

/** Every column's width on screen, in order. */
async function allWidths(page: Page) {
    const all: number[] = [];
    for (const name of Object.keys(COLUMN) as Name[]) {
        all.push((await boxOf(header(page, name))).width);
    }
    return all;
}

/** The width a fit gives a column: its content's, within its limits. */
async function fitted(page: Page, name: Name, min = 40, max = Infinity) {
    return Math.min(Math.max(await contentWidth(page, COLUMN[name]), min), max);
}

const sum = (all: number[]) => all.reduce((total, width) => total + width, 0);

const viewWidth = (page: Page) =>
    viewport(page).evaluate((element) => element.clientWidth);

const kept = (page: Page) => page.getByTestId("widths");

test("Name fits its content at the start, a width the grid keeps to itself", async ({
    page,
}) => {
    await openExample(page, "auto-widths");
    const name = await contentWidth(page, COLUMN.Name);
    // wider than its 140px: its names are long
    expect(name).toBeGreaterThan(140);
    expect(await widths(page, "Name")).toEqual([name, name]);
    await expect(handle(page, "Name")).toHaveAttribute(
        "aria-valuenow",
        String(name),
    );
    await expect(page.getByTestId("auto-widths")).toContainText(
        `Name ${name}px`,
    );
    await expect(kept(page)).toHaveText("Set by a person: none");
});

test("Email and City share the width left, and follow the grid's width", async ({
    page,
}) => {
    await openExample(page, "auto-widths");
    let view = await viewWidth(page);
    // City at its 240px maximum, Email the rest: the columns fill the view
    expect(await widths(page, "City")).toEqual([240, 240]);
    expect(sum(await allWidths(page))).toBe(view);
    const [wide = 0] = await widths(page, "Email");

    await page.getByLabel("Grid width").fill("80");
    await settle(page);
    view = await viewWidth(page);
    expect(sum(await allWidths(page))).toBe(view);
    const [email = 0] = await widths(page, "Email");
    const [city = 0] = await widths(page, "City");
    expect(email).toBeLessThan(wide);
    expect(email).toBeGreaterThanOrEqual(220);
    expect(city).toBeGreaterThanOrEqual(120);
    await expect(handle(page, "Email")).toHaveAttribute(
        "aria-valuenow",
        String(email),
    );
    await expect(page.getByTestId("auto-widths")).toContainText(
        `Email ${email}px · City ${city}px`,
    );
    await expect(kept(page)).toHaveText("Set by a person: none");
});

test("a double click fits a column and stops it flexing; Reset widths makes it flex again", async ({
    page,
}) => {
    await openExample(page, "auto-widths");
    await handle(page, "City").dblclick();
    await settle(page);
    const city = await fitted(page, "City", 40, 240);
    expect(city).toBeLessThan(240);
    expect(await widths(page, "City")).toEqual([city, city]);
    await expect(kept(page)).toHaveText(`Set by a person: City ${city}px`);
    // fixed: Email alone takes what the view leaves, and City keeps its width as the view narrows
    expect(sum(await allWidths(page))).toBe(await viewWidth(page));
    await page.getByLabel("Grid width").fill("85");
    await settle(page);
    expect(await widths(page, "City")).toEqual([city, city]);

    await page.getByRole("button", { name: "Reset widths" }).click();
    await settle(page);
    expect(sum(await allWidths(page))).toBe(await viewWidth(page));
    await expect(kept(page)).toHaveText("Set by a person: none");
    await expect(
        page.getByRole("button", { name: "Reset widths" }),
    ).toBeDisabled();
});

test("Enter on a focused handle fits its column", async ({ page }) => {
    await openExample(page, "auto-widths");
    await header(page, "Team").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("F2");
    await expect(handle(page, "Team")).toBeFocused();
    await page.keyboard.press("Enter");
    await settle(page);
    const team = await fitted(page, "Team");
    expect(team).toBeLessThan(140);
    expect(await widths(page, "Team")).toEqual([team, team]);
    await expect(handle(page, "Team")).toHaveAttribute(
        "aria-valuenow",
        String(team),
    );
    await expect(kept(page)).toHaveText(`Set by a person: Team ${team}px`);
});

test("Fit all fits every resizable column in one change, Reset widths gives the grid's widths back", async ({
    page,
}) => {
    await openExample(page, "auto-widths");
    const name = await contentWidth(page, COLUMN.Name);
    await page.getByRole("button", { name: "Fit all" }).click();
    await settle(page);
    const email = await fitted(page, "Email", 160);
    const city = await fitted(page, "City", 40, 240);
    const team = await fitted(page, "Team");
    // the premise: Salary's content is narrower than its 90px minimum
    expect(await contentWidth(page, COLUMN.Salary)).toBeLessThan(90);
    // "#" does not resize; Name already fits: its automatic width needs no entry
    expect(await allWidths(page)).toEqual([64, name, email, city, team, 90]);
    await expect(kept(page)).toHaveText(
        `Set by a person: Email ${email}px · City ${city}px · Team ${team}px · Salary 90px`,
    );

    await page.getByRole("button", { name: "Reset widths" }).click();
    await settle(page);
    expect(await widths(page, "Name")).toEqual([name, name]);
    expect(await widths(page, "City")).toEqual([240, 240]);
    expect(sum(await allWidths(page))).toBe(await viewWidth(page));
    await expect(kept(page)).toHaveText("Set by a person: none");
});
