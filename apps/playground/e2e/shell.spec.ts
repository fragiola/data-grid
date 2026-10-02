import { expect, test } from "@playwright/test";

// The shell around the examples of examples/react: sidebar, theme, stage, source panel. The
// examples' own behaviour is covered by examples/react's e2e; the grid's by the fixtures' specs.

test("renders the sidebar and switches the example theme, restoring it from the URL", async ({
    page,
}) => {
    await page.goto("/");
    await expect(
        page
            .getByRole("navigation", { name: "Playground" })
            .getByRole("heading", { name: "Data Grid playground" }),
    ).toBeVisible();
    const body = page.locator("body");
    await expect(body).toHaveAttribute("data-example-theme", "light");

    await page.getByRole("button", { name: "Terminal" }).click();
    await expect(body).toHaveAttribute("data-example-theme", "terminal");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page).toHaveURL(/theme=terminal/);

    await page.reload();
    await expect(body).toHaveAttribute("data-example-theme", "terminal");
    await expect(
        page.getByRole("button", { name: "Terminal" }),
    ).toHaveAttribute("aria-pressed", "true");
});

test("the shell keeps its own palette whatever the example theme", async ({
    page,
}) => {
    const shellIn = async (theme: string) => {
        await page.goto(`/?theme=${theme}`);
        await expect(page.locator("body")).toHaveAttribute(
            "data-example-theme",
            theme,
        );
        return page
            .locator("body")
            .evaluate((el) => getComputedStyle(el).backgroundColor);
    };
    // dark and ide share the dark scheme: the shell looks the same in both
    expect(await shellIn("dark")).toBe(await shellIn("ide"));
});

test("says so for an unknown example", async ({ page }) => {
    await page.goto("/?example=nope");
    await expect(page.getByText("No example with id “nope”.")).toBeVisible();
});
