import { test } from "vitest";
import type { Column } from "../../src";
import { createLocalRows, filterRows, sortRows } from "../../src/local";

// Informative, not a gate (`pnpm bench`): the local pipeline over 100,000 rows in memory.

interface Row {
    id: number;
    name: string;
    score: number;
    team: string;
}

const TEAMS = ["Core", "Design", "Growth", "Platform", "Support"];
const rows: Row[] = Array.from({ length: 100_000 }, (_, id) => ({
    id,
    name: `Person ${(id * 7_919) % 100_000}`,
    score: (id * 104_729) % 1_000,
    team: TEAMS[id % TEAMS.length] ?? "Core",
}));
const columns: Column<Row>[] = [
    { key: "name", width: 100 },
    { key: "score", width: 100 },
    { key: "team", width: 100 },
];

// sorting 100k rows many times takes a while: a longer timeout than a test's
test("sorting 100k rows", async ({ bench }) => {
    await bench.compare(
        bench("by a number", () => {
            sortRows(
                rows,
                [{ columnKey: "score", direction: "ascending" }],
                columns,
            );
        }),
        bench("by text, then a number", () => {
            sortRows(
                rows,
                [
                    { columnKey: "name", direction: "ascending" },
                    { columnKey: "score", direction: "descending" },
                ],
                columns,
            );
        }),
    );
}, 300_000);

test("filtering 100k rows", async ({ bench }) => {
    await bench.compare(
        bench("a text", () => {
            filterRows(rows, { name: "person 9" }, columns);
        }),
        bench("a list", () => {
            filterRows(rows, { team: ["Core", "Platform"] }, columns);
        }),
    );
});

test("the pipeline: a page turn after a sort", async ({ bench }) => {
    const local = createLocalRows<Row>({
        defaultSortColumns: [{ columnKey: "score", direction: "ascending" }],
        pageSize: 50,
    });
    local.derive(rows, columns);
    let page = 0;
    await bench("turning a page of 100k sorted rows", () => {
        page = (page + 1) % 2_000;
        local.setPageIndex(page);
        local.derive(rows, columns);
    }).run({ iterations: 200 });
});
