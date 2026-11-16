import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";

test("has no class on any part but the sizing root, and only structural inline style", async ({
    page,
}) => {
    await openExample(page, "unstyled");
    const classes = await page
        .locator('[data-grid-part]:not([data-grid-part="root"])')
        .evaluateAll(
            (parts) => parts.filter((part) => part.className !== "").length,
        );
    expect(classes).toBe(0);
    const properties = await page
        .locator("[data-grid-part]")
        .evaluateAll((parts) => [
            ...new Set(
                parts.flatMap((part) => [...(part as HTMLElement).style]),
            ),
        ]);
    for (const property of properties) {
        expect([
            "position",
            "top",
            "left",
            "width",
            "height",
            "transform",
            "display",
            "overflow",
            "overflow-x",
            "overflow-y",
            "overflow-clip-margin",
            "box-sizing",
            // the grid's layers (Epic #89, E5.2): the grid, the header and the summary rows
            "z-index",
        ]).toContain(property);
    }
    await expect(
        page.getByRole("columnheader", { name: "Email" }),
    ).toBeVisible();
});
