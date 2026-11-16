import { expect, type Page, test } from "@playwright/test";
import { collectErrors, EXAMPLES } from "./helpers";

// The examples as fragiola.com shows them: in an iframe of a same-origin page (e2e/serve.ts,
// /host.html), talking to it with the site export's messages (contract v1.2, §5.2).

interface Message {
    type: string;
    id?: string;
    height?: number;
}

async function openHosted(page: Page, query: Record<string, string>) {
    await page.goto(`/host.html?${new URLSearchParams(query)}`);
    return page.frameLocator('[data-testid="frame"]');
}

const messages = (page: Page) =>
    page.evaluate(
        () => (window as unknown as { messages: Message[] }).messages,
    );

test("an unknown example says so, and is still ready", async ({ page }) => {
    const frame = await openHosted(page, { id: "nope" });
    await expect(frame.getByRole("alert")).toHaveText('Unknown example "nope"');
    await expect
        .poll(() => messages(page))
        .toContainEqual({ type: "fragiola:example:ready", id: "nope" });
    await expect(page.getByTestId("frame")).toHaveCSS("opacity", "1");
});

test("the theme is applied before the first paint, and follows the site's message", async ({
    page,
}) => {
    const frame = await openHosted(page, { id: "nope", theme: "paper" });
    const body = frame.locator("body");
    const html = frame.locator("html");
    await expect(body).toHaveAttribute("data-example-theme", "paper");
    await expect(html).toHaveAttribute("data-theme", "light");

    const send = (theme: string) =>
        page.evaluate((theme) => {
            document
                .querySelector("iframe")
                ?.contentWindow?.postMessage(
                    { type: "fragiola:example:theme", theme },
                    location.origin,
                );
        }, theme);

    await send("terminal");
    await expect(body).toHaveAttribute("data-example-theme", "terminal");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(html).toHaveClass(/\bdark\b/);

    // an unknown theme is ignored
    await send("nope");
    await page.waitForTimeout(100);
    await expect(body).toHaveAttribute("data-example-theme", "terminal");
});

test("a missing or unknown theme falls back to the first light theme", async ({
    page,
}) => {
    const queries: Record<string, string>[] = [
        { id: "nope" },
        { id: "nope", theme: "nope" },
    ];
    for (const query of queries) {
        const frame = await openHosted(page, query);
        await expect(frame.locator("body")).toHaveAttribute(
            "data-example-theme",
            "light",
        );
        await expect(frame.locator("html")).toHaveAttribute(
            "data-theme",
            "light",
        );
    }
});

for (const { slug } of EXAMPLES) {
    test(`${slug} runs in a frame and says ready once`, async ({ page }) => {
        const errors = collectErrors(page);
        const frame = await openHosted(page, { id: slug, theme: "dark" });
        await expect(
            frame.locator('[data-grid-part="root"]').first(),
        ).toBeVisible();
        await expect
            .poll(() => messages(page))
            .toContainEqual({ type: "fragiola:example:ready", id: slug });
        await page.waitForTimeout(200);
        expect(
            (await messages(page)).filter(
                (m) => m.type === "fragiola:example:ready",
            ),
        ).toHaveLength(1);
        expect(errors).toEqual([]);
    });
}
