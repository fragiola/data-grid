import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";
import { settle, viewport } from "./helpers";

test("loads a page each time the end comes near, keeping the scroll position", async ({
    page,
}) => {
    await openExample(page, "infinite-loading");
    const loaded = page.getByTestId("loaded");
    await expect(loaded).toHaveText("50");
    for (const expected of ["100", "150", "200"]) {
        const top = await viewport(page).evaluate((element) => {
            element.scrollTop = element.scrollHeight;
            return element.scrollTop;
        });
        await settle(page);
        await expect(loaded).toHaveText(expected);
        await settle(page);
        // the rows were appended below: the view did not move
        expect(
            await viewport(page).evaluate((element) => element.scrollTop),
        ).toBe(top);
    }
});
