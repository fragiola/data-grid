import { test } from "vitest";
import { createAxis } from "../../src/axis/axis";
import { windowFor } from "../../src/viewport/window";

// Informative, not a gate (`pnpm bench`): the numbers go in the PR and the skeleton report.

const size = (index: number) => 20 + (index % 13);

test("building variable offsets", async ({ bench }) => {
    await bench("variable sizes: build 10M offsets", () => {
        createAxis(10_000_000, size);
    }).run({ iterations: 5 });
});

test("lookups", async ({ bench }) => {
    const variable = createAxis(10_000_000, size);
    const fixed = createAxis(100_000_000, 32);
    let offset = 0;
    await bench.compare(
        bench("variable sizes: indexAt over 10M", () => {
            offset = (offset + 7_919_113) % variable.totalSize;
            variable.indexAt(offset);
        }),
        bench("windowFor over 10M variable rows", () => {
            offset = (offset + 7_919_113) % variable.totalSize;
            windowFor(variable, offset, 800, 3);
        }),
        bench("windowFor over 100M fixed rows", () => {
            offset = (offset + 7_919_113) % fixed.totalSize;
            windowFor(fixed, offset, 800, 3);
        }),
    );
});
