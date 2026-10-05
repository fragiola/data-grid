import { test } from "vitest";
import { MeasuredHeights } from "../../src/engine/measure";
import { windowFor } from "../../src/viewport/window";

// Informative, not a gate (`pnpm bench`): measured heights (Epic #86, E2.2) through a scroll of
// 5,000 window changes down 100k rows, each one a batch of the rows it renders measured, the axis
// made again and the next window worked out over it.

const ROWS = 100_000;
const ESTIMATE = 35;
const height = (index: number) => 18 + (index % 5) * 16;

/** One window change: 30 rendered rows, 20 of them new, then the window over the new axis. */
function scrollOnce(store: MeasuredHeights, step: number) {
    const from = step * 20;
    store.set(
        Array.from({ length: 30 }, (_, i) => ({
            index: from + i,
            height: height(from + i),
            key: from + i,
        })),
    );
    const axis = store.axis(ROWS, ESTIMATE);
    windowFor(axis, axis.offsetOf(from + 10), 800, 4);
}

test("measured heights: 5,000 window changes over 100k rows", async ({
    bench,
}) => {
    await bench("5,000 window changes, every row measured once", () => {
        const store = new MeasuredHeights();
        for (let step = 0; step < 5_000; step++)
            scrollOnce(store, step % 4_998);
    }).run({ iterations: 5 });
});
