import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";
import { cell, renderedRows, scrollTo } from "./helpers";

test("lays rows of four heights end to end, anywhere in the list", async ({
    page,
}) => {
    await openExample(page, "variable-row-height");
    for (const top of [0, "37%", "100%"] as const) {
        await scrollTo(page, { top });
        const rows = await renderedRows(page);
        const heights = new Set<number>();
        for (let i = 0; i < Math.min(rows.length - 1, 10); i++) {
            const a = await cell(page, rows[i] ?? 0, 0).boundingBox();
            const b = await cell(page, rows[i + 1] ?? 0, 0).boundingBox();
            expect(
                Math.abs((a?.y ?? 0) + (a?.height ?? 0) - (b?.y ?? 1)),
            ).toBeLessThan(1);
            heights.add(Math.round(a?.height ?? 0));
        }
        for (const height of heights)
            expect([36, 56, 76, 96]).toContain(height);
    }
});
